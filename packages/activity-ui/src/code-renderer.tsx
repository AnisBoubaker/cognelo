"use client";

import { Highlight, Prism, themes } from "prism-react-renderer";

type CodeRendererProps = {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  startingLineNumber?: number;
  className?: string;
  contentOffset?: number;
};

export const codeLanguageOptions = [
  { value: "actionscript", label: "ActionScript" },
  { value: "c", label: "C" },
  { value: "coffee", label: "CoffeeScript" },
  { value: "cpp", label: "C++" },
  { value: "css", label: "CSS" },
  { value: "go", label: "Go" },
  { value: "graphql", label: "GraphQL" },
  { value: "html", label: "HTML" },
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

const languageAliases: Record<string, string> = {
  csharp: "clike",
  cs: "clike",
  js: "javascript",
  py: "python",
  sh: "bash",
  shell: "bash",
  ts: "typescript"
};

const supportedLanguages = new Set<string>([
  ...codeLanguageOptions.map((option) => option.value),
  "clike",
  "html",
  "xml",
  "svg"
]);

export function CodeRenderer({
  code,
  language = "text",
  showLineNumbers = false,
  startingLineNumber = 1,
  className,
  contentOffset = 0
}: CodeRendererProps) {
  const normalizedLanguage = normalizeCodeLanguage(language);

  return (
    <Highlight code={code} language={normalizedLanguage} prism={Prism} theme={themes.github}>
      {({ className: highlightClassName, getLineProps, getTokenProps, tokens }) => (
        <div className={`code-renderer ${className ?? ""}`.trim()}>
          <pre className={`${highlightClassName} code-renderer-pre`}>
            {tokens.map((line, index) => {
              const lineProps = getLineProps({ line });
              const lineNumber = startingLineNumber + index;
              return (
                <div key={lineNumber} {...lineProps} className={`${lineProps.className} code-renderer-line`.trim()}>
                  {showLineNumbers ? <span className="code-renderer-line-number">{lineNumber}</span> : null}
                  <span className="code-renderer-line-content" style={contentOffset ? { paddingLeft: `${contentOffset}px` } : undefined}>
                    {line.map((token, tokenIndex) => {
                      const tokenProps = getTokenProps({ token });
                      return <span key={tokenIndex} {...tokenProps} />;
                    })}
                  </span>
                </div>
              );
            })}
          </pre>
        </div>
      )}
    </Highlight>
  );
}

export function normalizeCodeLanguage(language: string) {
  const normalized = language.trim().toLowerCase();
  const mapped = languageAliases[normalized] ?? normalized;
  return supportedLanguages.has(mapped) ? mapped : "text";
}
