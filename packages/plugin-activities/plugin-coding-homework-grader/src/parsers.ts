import type {
  CodingHomeworkLanguageKey,
  CodingHomeworkParsedFunction,
  CodingHomeworkParserAdapter,
  CodingHomeworkParserDiagnostic,
  CodingHomeworkParseResult,
  CodingHomeworkSourceFile
} from "./algorithm";

type ParsedCSignature = {
  functionName: string;
  parameters: string[];
  returnType: string;
};

type SignatureRange = {
  signature: string;
  startIndex: number;
};

const C_KEYWORDS = new Set(["do", "else", "for", "if", "return", "sizeof", "switch", "while"]);
const C_TYPE_DEFINITION_PREFIX = /^(struct|union|enum|typedef)\b/;
const C_MULTI_CHAR_OPERATORS = [
  "<<=",
  ">>=",
  "++",
  "--",
  "->",
  "==",
  "!=",
  "<=",
  ">=",
  "&&",
  "||",
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "&=",
  "|=",
  "^=",
  "<<",
  ">>"
];

export const codingHomeworkCParserAdapter: CodingHomeworkParserAdapter = {
  languageKey: "c",
  async parse(files) {
    const diagnostics: CodingHomeworkParserDiagnostic[] = [];
    const functions: CodingHomeworkParsedFunction[] = [];

    for (const file of files) {
      if (file.languageKey !== "c") {
        diagnostics.push({
          code: "UNSUPPORTED_LANGUAGE",
          message: `The C parser adapter cannot parse ${file.languageKey} files.`,
          path: file.path,
          severity: "warning"
        });
        continue;
      }

      const result = parseCFile(file);
      diagnostics.push(...result.diagnostics);
      functions.push(...result.functions);
    }

    return { diagnostics, functions };
  }
};

export function createCodingHomeworkParserRegistry(adapters: readonly CodingHomeworkParserAdapter[] = [codingHomeworkCParserAdapter]) {
  const byLanguage = new Map<CodingHomeworkLanguageKey, CodingHomeworkParserAdapter>();
  for (const adapter of adapters) {
    if (byLanguage.has(adapter.languageKey)) {
      throw new Error(`Parser adapter already registered for ${adapter.languageKey}`);
    }
    byLanguage.set(adapter.languageKey, adapter);
  }

  return {
    get(languageKey: CodingHomeworkLanguageKey) {
      return byLanguage.get(languageKey) ?? null;
    },
    list() {
      return [...byLanguage.values()];
    },
    async parse(files: CodingHomeworkSourceFile[]): Promise<CodingHomeworkParseResult> {
      const groups = new Map<CodingHomeworkLanguageKey, CodingHomeworkSourceFile[]>();
      for (const file of files) {
        groups.set(file.languageKey, [...(groups.get(file.languageKey) ?? []), file]);
      }

      const diagnostics: CodingHomeworkParserDiagnostic[] = [];
      const functions: CodingHomeworkParsedFunction[] = [];
      for (const [languageKey, groupFiles] of groups) {
        const adapter = byLanguage.get(languageKey);
        if (!adapter) {
          diagnostics.push(
            ...groupFiles.map((file) => ({
              code: "PARSER_ADAPTER_NOT_FOUND",
              message: `No parser adapter is registered for ${languageKey}.`,
              path: file.path,
              severity: "warning" as const
            }))
          );
          continue;
        }
        const result = await adapter.parse(groupFiles);
        diagnostics.push(...result.diagnostics);
        functions.push(...result.functions);
      }

      return { diagnostics, functions };
    }
  };
}

export const codingHomeworkParserRegistry = createCodingHomeworkParserRegistry();

export function getCodingHomeworkParserAdapter(languageKey: CodingHomeworkLanguageKey) {
  return codingHomeworkParserRegistry.get(languageKey);
}

export async function parseCodingHomeworkSourceFiles(files: CodingHomeworkSourceFile[]) {
  return codingHomeworkParserRegistry.parse(files);
}

function parseCFile(file: CodingHomeworkSourceFile): CodingHomeworkParseResult {
  const masked = maskCNonCode(file.content);
  const diagnostics: CodingHomeworkParserDiagnostic[] = [];
  const functions: CodingHomeworkParsedFunction[] = [];
  let index = 0;
  let topLevelBoundary = 0;

  while (index < masked.length) {
    const char = masked[index];
    if (char === ";") {
      topLevelBoundary = index + 1;
      index += 1;
      continue;
    }
    if (char === "}") {
      diagnostics.push({
        code: "C_UNMATCHED_CLOSING_BRACE",
        line: lineAt(file.content, index),
        message: "Found a closing brace without a matching opening brace.",
        path: file.path,
        severity: "error"
      });
      topLevelBoundary = index + 1;
      index += 1;
      continue;
    }
    if (char !== "{") {
      index += 1;
      continue;
    }

    const signatureRange = readSignatureRange(masked, topLevelBoundary, index);
    const signature = parseCSignature(signatureRange.signature);
    const closeIndex = findMatchingBrace(masked, index);
    if (closeIndex < 0) {
      diagnostics.push({
        code: signature ? "C_UNMATCHED_FUNCTION_BRACE" : "C_UNMATCHED_BRACE",
        line: lineAt(file.content, index),
        message: signature
          ? `Function ${signature.functionName} has an opening brace without a matching closing brace.`
          : "Found an opening brace without a matching closing brace.",
        path: file.path,
        severity: "error"
      });
      break;
    }

    if (signature) {
      const sourceStart = firstNonWhitespaceIndex(file.content, signatureRange.startIndex, index);
      const sourceEnd = closeIndex + 1;
      const functionCode = file.content.slice(sourceStart, sourceEnd).trim();
      functions.push({
        astText: serializeCFunctionAst(signature, file.content.slice(index + 1, closeIndex)),
        endLine: lineAt(file.content, closeIndex),
        functionCode,
        functionName: signature.functionName,
        languageKey: "c",
        sourcePath: file.path,
        startLine: lineAt(file.content, sourceStart)
      });
    }

    index = closeIndex + 1;
    topLevelBoundary = index;
  }

  if (!functions.length && !diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    diagnostics.push({
      code: "C_NO_FUNCTIONS_FOUND",
      message: "No C function definitions were found.",
      path: file.path,
      severity: "warning"
    });
  }

  return { diagnostics, functions };
}

function parseCSignature(signature: string): ParsedCSignature | null {
  const normalized = normalizeWhitespace(signature);
  if (!normalized || normalized.includes("=") || C_TYPE_DEFINITION_PREFIX.test(normalized)) {
    return null;
  }

  const match = normalized.match(/([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)\s*$/);
  if (!match?.index) {
    return null;
  }

  const functionName = match[1] as string;
  if (C_KEYWORDS.has(functionName)) {
    return null;
  }

  const returnType = normalizeCType(normalized.slice(0, match.index));
  if (!returnType || C_KEYWORDS.has(returnType)) {
    return null;
  }

  return {
    functionName,
    parameters: parseCParameters(match[2] ?? ""),
    returnType
  };
}

function parseCParameters(parameters: string) {
  const normalized = normalizeWhitespace(parameters);
  if (!normalized || normalized === "void") {
    return [];
  }
  return splitTopLevelComma(normalized).map(normalizeCType);
}

function serializeCFunctionAst(signature: ParsedCSignature, body: string) {
  const bodyTokens = tokenizeC(body).join(" ");
  return [
    "c-ast-v1",
    `function:${signature.functionName}`,
    `return:${signature.returnType}`,
    `params:${signature.parameters.length ? signature.parameters.join("|") : "void"}`,
    `body:${bodyTokens}`
  ].join("\n");
}

function tokenizeC(source: string) {
  const tokens: string[] = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index] as string;
    const next = source[index + 1];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (char === "/" && next === "/") {
      const newlineIndex = source.indexOf("\n", index + 2);
      index = newlineIndex < 0 ? source.length : newlineIndex + 1;
      continue;
    }
    if (char === "/" && next === "*") {
      const endIndex = source.indexOf("*/", index + 2);
      index = endIndex < 0 ? source.length : endIndex + 2;
      continue;
    }
    if (char === "\"" || char === "'") {
      const result = readCStringLiteral(source, index, char);
      tokens.push(char === "\"" ? "<string>" : "<char>");
      index = result.endIndex;
      continue;
    }
    const identifier = source.slice(index).match(/^[A-Za-z_][A-Za-z0-9_]*/)?.[0];
    if (identifier) {
      tokens.push(identifier);
      index += identifier.length;
      continue;
    }
    const number = source.slice(index).match(/^(?:0[xX][0-9A-Fa-f]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)[uUlLfF]*/)?.[0];
    if (number) {
      tokens.push("<number>");
      index += number.length;
      continue;
    }
    const operator = C_MULTI_CHAR_OPERATORS.find((candidate) => source.startsWith(candidate, index));
    if (operator) {
      tokens.push(operator);
      index += operator.length;
      continue;
    }
    tokens.push(char);
    index += 1;
  }
  return tokens;
}

function maskCNonCode(source: string) {
  const chars = source.split("");
  let index = 0;
  while (index < chars.length) {
    const char = chars[index] as string;
    const next = chars[index + 1];
    if (char === "/" && next === "/") {
      const start = index;
      index += 2;
      while (index < chars.length && chars[index] !== "\n") index += 1;
      maskRange(chars, start, index);
      continue;
    }
    if (char === "/" && next === "*") {
      const start = index;
      index += 2;
      while (index < chars.length && !(chars[index] === "*" && chars[index + 1] === "/")) index += 1;
      index = Math.min(chars.length, index + 2);
      maskRange(chars, start, index);
      continue;
    }
    if (char === "\"" || char === "'") {
      const start = index;
      const result = readCStringLiteral(source, index, char);
      index = result.endIndex;
      maskRange(chars, start, index);
      continue;
    }
    index += 1;
  }
  return chars.join("");
}

function readCStringLiteral(source: string, startIndex: number, quote: string) {
  let index = startIndex + 1;
  while (index < source.length) {
    const char = source[index];
    if (char === "\\") {
      index += 2;
      continue;
    }
    index += 1;
    if (char === quote) {
      break;
    }
  }
  return { endIndex: index };
}

function maskRange(chars: string[], startIndex: number, endIndex: number) {
  for (let index = startIndex; index < endIndex; index += 1) {
    if (chars[index] !== "\n") {
      chars[index] = " ";
    }
  }
}

function readSignatureRange(masked: string, boundaryIndex: number, braceIndex: number): SignatureRange {
  let startIndex = boundaryIndex;
  while (startIndex < braceIndex) {
    const nextNewline = masked.indexOf("\n", startIndex);
    const lineEnd = nextNewline < 0 || nextNewline > braceIndex ? braceIndex : nextNewline;
    const line = masked.slice(startIndex, lineEnd).trim();
    if (line && !line.startsWith("#")) {
      break;
    }
    startIndex = lineEnd + 1;
  }
  return {
    signature: masked.slice(startIndex, braceIndex).trim(),
    startIndex
  };
}

function findMatchingBrace(masked: string, openIndex: number) {
  let depth = 0;
  for (let index = openIndex; index < masked.length; index += 1) {
    const char = masked[index];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return -1;
}

function splitTopLevelComma(value: string) {
  const items: string[] = [];
  let startIndex = 0;
  let depth = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === "(" || char === "[" || char === "<") depth += 1;
    if (char === ")" || char === "]" || char === ">") depth = Math.max(0, depth - 1);
    if (char === "," && depth === 0) {
      items.push(value.slice(startIndex, index));
      startIndex = index + 1;
    }
  }
  items.push(value.slice(startIndex));
  return items.filter((item) => item.trim());
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeCType(value: string) {
  return normalizeWhitespace(value.replace(/\s*([*[\]])\s*/g, "$1"));
}

function firstNonWhitespaceIndex(source: string, startIndex: number, endIndex: number) {
  for (let index = startIndex; index < endIndex; index += 1) {
    if (!/\s/.test(source[index] as string)) {
      return index;
    }
  }
  return startIndex;
}

function lineAt(source: string, index: number) {
  let line = 1;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (source[cursor] === "\n") {
      line += 1;
    }
  }
  return line;
}
