"use client";

export const codeLanguageOptions = [
  { value: "actionscript", label: "ActionScript" },
  { value: "c", label: "C" },
  { value: "coffee", label: "CoffeeScript" },
  { value: "cpp", label: "C++" },
  { value: "css", label: "CSS" },
  { value: "go", label: "Go" },
  { value: "graphql", label: "GraphQL" },
  { value: "html", label: "HTML" },
  { value: "java", label: "Java" },
  { value: "javascript", label: "JavaScript" },
  { value: "json", label: "JSON" },
  { value: "jsx", label: "JSX" },
  { value: "kotlin", label: "Kotlin" },
  { value: "markdown", label: "Markdown" },
  { value: "objectivec", label: "Objective-C" },
  { value: "python", label: "Python" },
  { value: "reason", label: "Reason" },
  { value: "rust", label: "Rust" },
  { value: "sql", label: "SQL" },
  { value: "swift", label: "Swift" },
  { value: "typescript", label: "TypeScript" },
  { value: "tsx", label: "TSX" },
  { value: "xml", label: "XML" },
  { value: "yaml", label: "YAML" }
] as const;

const prismLanguageAliases: Record<string, string> = {
  csharp: "clike",
  cs: "clike",
  js: "javascript",
  py: "python",
  sh: "bash",
  shell: "bash",
  ts: "typescript"
};

const supportedPrismLanguages = new Set<string>([
  ...codeLanguageOptions.map((option) => option.value),
  "clike",
  "html",
  "xml",
  "svg"
]);

const monacoLanguageAliases: Record<string, string> = {
  actionscript: "javascript",
  basic: "vb",
  bash: "shell",
  coffee: "coffeescript",
  "common-lisp": "scheme",
  cpp: "cpp",
  csharp: "csharp",
  cs: "csharp",
  fsharp: "fsharp",
  js: "javascript",
  objectivec: "objective-c",
  python2: "python",
  py: "python",
  reason: "plaintext",
  shell: "shell",
  sh: "shell",
  text: "plaintext",
  ts: "typescript",
  vbnet: "vb"
};

const supportedMonacoLanguages = new Set<string>([
  "c",
  "coffeescript",
  "clojure",
  "cpp",
  "csharp",
  "css",
  "elixir",
  "fsharp",
  "go",
  "graphql",
  "html",
  "java",
  "javascript",
  "json",
  "kotlin",
  "lua",
  "markdown",
  "objective-c",
  "pascal",
  "perl",
  "php",
  "plaintext",
  "python",
  "r",
  "ruby",
  "rust",
  "scala",
  "scheme",
  "shell",
  "sql",
  "swift",
  "typescript",
  "vb",
  "xml",
  "yaml"
]);

export function normalizeCodeLanguage(language: string) {
  const normalized = normalizeProgrammingLanguageKey(language);
  const mapped = prismLanguageAliases[normalized] ?? normalized;
  return supportedPrismLanguages.has(mapped) ? mapped : "text";
}

export function normalizeMonacoLanguage(language: string) {
  const normalized = normalizeProgrammingLanguageKey(language);
  const mapped = monacoLanguageAliases[normalized] ?? normalized;
  return supportedMonacoLanguages.has(mapped) ? mapped : "plaintext";
}

function normalizeProgrammingLanguageKey(language: string) {
  return language.trim().toLowerCase().replace(/\s+\([^()]+\)\s*$/, "");
}
