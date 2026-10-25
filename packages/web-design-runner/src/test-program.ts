import ts from "typescript";
import { expect, type Page } from "@playwright/test";

type Capability = { kind: "page" | "locator" | "assertion"; target: unknown };
const locators = new Set(["locator", "getByRole", "getByText", "getByLabel", "getByPlaceholder", "getByTestId", "getByAltText", "getByTitle", "first", "last", "nth", "filter"]);
const actions = new Set(["click", "dblclick", "fill", "check", "uncheck", "selectOption", "press", "hover", "focus", "textContent", "innerText", "inputValue", "getAttribute", "count", "isVisible", "isEnabled", "isChecked"]);
const assertions = new Set(["toBe", "toEqual", "toStrictEqual", "toBeTruthy", "toBeFalsy", "toBeNull", "toBeDefined", "toBeUndefined", "toContain", "toHaveLength", "toBeGreaterThan", "toBeGreaterThanOrEqual", "toBeLessThan", "toBeLessThanOrEqual", "toBeCloseTo", "toBeVisible", "toBeHidden", "toBeEnabled", "toBeDisabled", "toBeChecked", "toHaveText", "toContainText", "toHaveValue", "toHaveCount", "toHaveAttribute", "toHaveClass", "toHaveCSS", "toHaveTitle"]);
const forbiddenKeys = new Set(["__proto__", "prototype", "constructor"]);

/** An interpreter for a bounded Playwright command language, never Node eval/vm. */
export async function runTestProgram(page: Page, source: string, timeoutMs: number) {
  const ast = ts.createSourceFile("test.js", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  if ((ast as ts.SourceFile & { parseDiagnostics: unknown[] }).parseDiagnostics.length) throw new Error("Invalid test syntax.");
  const capabilities = new WeakSet<object>();
  function capability(kind: Capability["kind"], target: unknown): Capability {
    const value = { kind, target }; capabilities.add(value); return value;
  }
  function isCapability(value: unknown): value is Capability {
    return typeof value === "object" && value !== null && capabilities.has(value);
  }
  const variables = new Map<string, unknown>([["page", capability("page", page)]]);
  const deadline = Date.now() + timeoutMs;
  let steps = 0;
  function unsupported(): never { throw new Error("Unsupported test syntax or operation. Use the documented Playwright command subset."); }
  function plain(value: unknown): unknown {
    if (isCapability(value)) return unsupported();
    if (Array.isArray(value)) return value.map(plain);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plain(item)]));
    return value;
  }
  async function evaluate(node: ts.Node): Promise<unknown> {
    if (++steps > 2000 || Date.now() >= deadline) throw new Error("Test execution limit reached.");
    if (ts.isParenthesizedExpression(node) || ts.isAwaitExpression(node)) return evaluate(node.expression);
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (node.kind === ts.SyntaxKind.NullKeyword) return null;
    if (ts.isIdentifier(node)) {
      if (node.text === "undefined") return undefined;
      if (!variables.has(node.text)) return unsupported();
      return variables.get(node.text);
    }
    if (ts.isArrayLiteralExpression(node)) return Promise.all(node.elements.map(evaluate));
    if (ts.isObjectLiteralExpression(node)) {
      const value: Record<string, unknown> = Object.create(null);
      for (const property of node.properties) {
        if (!ts.isPropertyAssignment(property) || !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) return unsupported();
        const key = property.name.text;
        if (forbiddenKeys.has(key)) return unsupported();
        value[key] = plain(await evaluate(property.initializer));
      }
      return value;
    }
    if (ts.isPrefixUnaryExpression(node)) {
      const value = await evaluate(node.operand);
      if (node.operator === ts.SyntaxKind.ExclamationToken) return !value;
      if (node.operator === ts.SyntaxKind.MinusToken && typeof value === "number") return -value;
      return unsupported();
    }
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const target = await evaluate(node.expression);
      const key = ts.isPropertyAccessExpression(node) ? node.name.text : String(await evaluate(node.argumentExpression));
      if (forbiddenKeys.has(key)) return unsupported();
      if (isCapability(target)) {
        if (target.kind === "assertion" && key === "not") return capability("assertion", (target.target as { not: unknown }).not);
        return unsupported();
      }
      if (typeof target === "string" && key === "length") return target.length;
      if (target && typeof target === "object" && Object.hasOwn(target, key)) return (target as Record<string, unknown>)[key];
      return unsupported();
    }
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression) && node.expression.text === "expect") {
        if (node.arguments.length !== 1) return unsupported();
        const value = await evaluate(node.arguments[0]);
        return capability("assertion", expect(isCapability(value) ? value.target : plain(value)));
      }
      if (!ts.isPropertyAccessExpression(node.expression)) return unsupported();
      const receiver = await evaluate(node.expression.expression);
      const method = node.expression.name.text;
      if (!isCapability(receiver)) return unsupported();
      if ((receiver.kind === "page" || receiver.kind === "locator") && method === "evaluate") {
        const fn = node.arguments[0];
        if (!fn || !(ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) || node.arguments.length > 2) return unsupported();
        // Source is interpreted only by Chromium, in the untrusted document.
        const argument = node.arguments[1] ? plain(await evaluate(node.arguments[1])) : undefined;
        if (receiver.kind === "page") return page.evaluate(`(${fn.getText(ast)})(${JSON.stringify(argument) ?? "undefined"})`);
        return (receiver.target as ReturnType<Page["locator"]>).evaluate(`(${fn.getText(ast)})`, argument);
      }
      const args = [];
      for (const arg of node.arguments) args.push(plain(await evaluate(arg)));
      const target = receiver.target as Record<string, (...args: unknown[]) => unknown>;
      if ((receiver.kind === "page" || receiver.kind === "locator") && locators.has(method)) return capability("locator", target[method](...args));
      if (receiver.kind === "locator" && actions.has(method)) return target[method](...args);
      if (receiver.kind === "page" && (method === "title" || method === "setViewportSize")) return target[method](...args);
      if (receiver.kind === "assertion" && assertions.has(method)) return target[method](...args);
      return unsupported();
    }
    return unsupported();
  }
  for (const statement of ast.statements) {
    if (ts.isExpressionStatement(statement)) await evaluate(statement.expression);
    else if (ts.isVariableStatement(statement) && statement.declarationList.flags & ts.NodeFlags.Const) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer || variables.has(declaration.name.text) || declaration.name.text === "expect") return unsupported();
        variables.set(declaration.name.text, await evaluate(declaration.initializer));
      }
    } else if (!ts.isEmptyStatement(statement)) return unsupported();
  }
}
