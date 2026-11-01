/** Conservative declaration normalization; it never compiles or executes learner code. */
const builtin = new Set(["void", "char", "short", "int", "long", "float", "double", "signed", "unsigned", "_Bool", "bool", "const", "volatile", "restrict"]);
export type CFunctionSignature = { returnType: string; parameterTypes: string[] };

export function normalizeCReturnType(value: string) {
  return canonicalType(value.replace(/\b(?:static|extern|inline|register|auto|_Noreturn)\b/g, " "));
}
export function normalizeCParameter(value: string): string {
  let text = value.trim().replace(/\b(?:register|static)\b/g, " ");
  if (text === "...") return text;
  // Function-pointer parameters: erase only the declarator identifier and normalize nested arguments.
  const pointer = text.match(/^(.*?)\(\s*\*\s*(?:const\s+)?([A-Za-z_]\w*)?\s*\)\s*\((.*)\)$/s);
  if (pointer) return `${canonicalType(pointer[1])}(*)(${splitCParameters(pointer[3]).map(normalizeCParameter).join(",")})`;
  const arrayPointer = text.match(/^(.*?)\(\s*\*\s*(?:[A-Za-z_]\w*)?\s*\)((?:\s*\[[^\]]*\])+)/s);
  if (arrayPointer) return `${canonicalType(arrayPointer[1])}(*)${arrayPointer[2].replace(/\s+/g, "")}`;
  const arrayStart = text.indexOf("[");
  const arrays = arrayStart >= 0 ? text.slice(arrayStart).replace(/\s+/g, "") : "";
  if (arrayStart >= 0) text = text.slice(0, arrayStart).trim();
  const last = text.match(/([A-Za-z_]\w*)\s*$/);
  if (last && !builtin.has(last[1])) {
    const prefix = text.slice(0, last.index).trim();
    const identifiers = prefix.match(/[A-Za-z_]\w*/g) ?? [];
    // A lone typedef name, or a struct/enum tag without a declarator, is a type.
    if (prefix && !(identifiers.length === 1 && ["struct", "enum", "union", "const", "volatile"].includes(identifiers[0]))) text = prefix;
  }
  if (arrays) {
    const remaining = arrays.replace(/^\[[^\]]*\]/, "");
    text += remaining ? `(*)${remaining}` : "*";
  }
  // Top-level parameter qualifiers do not alter a C function's argument type.
  if (!text.includes("*")) text = text.replace(/\b(?:const|volatile|restrict)\b/g, " ");
  else text = text.replace(/\*\s*(?:(?:const|volatile|restrict)\s*)+$/, "*");
  return canonicalType(text);
}
export function normalizeCSignature(returnType: string, parameters: string[]): CFunctionSignature {
  return { returnType: normalizeCReturnType(returnType), parameterTypes: parameters.map(normalizeCParameter) };
}
export function splitCParameters(text: string) {
  if (!text.trim() || text.trim() === "void") return [];
  const parts: string[] = []; let start = 0, depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "(" || text[i] === "[") depth++;
    else if (text[i] === ")" || text[i] === "]") depth--;
    else if (text[i] === "," && depth === 0) { parts.push(text.slice(start, i)); start = i + 1; }
  }
  parts.push(text.slice(start)); return parts.filter(part => part.trim());
}
function canonicalType(value: string) {
  let text = value.replace(/\s+/g, " ").trim().replace(/\s*([*()[\],])\s*/g, "$1");
  const match = text.match(/^((?:(?:const|volatile|signed|unsigned|short|long|int|char|float|double|void|_Bool|bool)\s*)+)(.*)$/);
  if (match && (!match[2] || /^[*([]/.test(match[2]))) {
    const words = match[1].trim().split(/\s+/);
    const qualifiers = ["const", "volatile"].filter(word => words.includes(word));
    const sign = words.includes("unsigned") ? ["unsigned"] : words.includes("signed") && words.includes("char") ? ["signed"] : [];
    const longs = words.filter(word => word === "long");
    const size = words.includes("short") ? ["short"] : longs;
    const base = ["void", "char", "float", "double", "_Bool", "bool"].find(word => words.includes(word));
    text = [...qualifiers, ...sign, ...size, ...(base ? [base] : size.length ? [] : ["int"])].join(" ") + match[2];
  }
  return text;
}
