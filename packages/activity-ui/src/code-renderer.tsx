"use client";

import { Highlight, Prism, themes } from "prism-react-renderer";
import { normalizeCodeLanguage } from "./code-language";

type CodeRendererProps = {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  startingLineNumber?: number;
  className?: string;
  contentOffset?: number;
  getLineClassName?: (lineIndex: number) => string | undefined;
};

export function CodeRenderer({
  code,
  language = "text",
  showLineNumbers = false,
  startingLineNumber = 1,
  className,
  contentOffset = 0,
  getLineClassName
}: CodeRendererProps) {
  const normalizedLanguage = normalizeCodeLanguage(language);

  if (normalizedLanguage === "markdown") {
    return (
      <MarkdownCodeRenderer
        code={code}
        showLineNumbers={showLineNumbers}
        startingLineNumber={startingLineNumber}
        className={className}
        contentOffset={contentOffset}
        getLineClassName={getLineClassName}
      />
    );
  }

  return (
    <Highlight code={code} language={normalizedLanguage} prism={Prism} theme={themes.github}>
      {({ className: highlightClassName, getLineProps, getTokenProps, tokens }) => (
        <div className={`code-renderer ${className ?? ""}`.trim()}>
          <pre className={`${highlightClassName} code-renderer-pre`}>
            {tokens.map((line, index) => {
              const lineProps = getLineProps({ line });
              const lineNumber = startingLineNumber + index;
              const customLineClassName = getLineClassName?.(index) ?? "";
              return (
                <div
                  key={lineNumber}
                  {...lineProps}
                  className={`${lineProps.className} code-renderer-line ${customLineClassName}`.trim()}
                >
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

function MarkdownCodeRenderer({
  code,
  showLineNumbers,
  startingLineNumber,
  className,
  contentOffset,
  getLineClassName
}: Required<Pick<CodeRendererProps, "code" | "showLineNumbers" | "startingLineNumber" | "contentOffset">> &
  Pick<CodeRendererProps, "className" | "getLineClassName">) {
  const lines = code.split("\n");
  const languagesByLine = getMarkdownLineLanguages(lines);

  return (
    <div className={`code-renderer ${className ?? ""}`.trim()}>
      <pre className="prism-code language-markdown code-renderer-pre">
        {lines.map((line, index) => (
          <HighlightedLine
            key={index}
            code={line || " "}
            language={languagesByLine[index] ?? "markdown"}
            lineIndex={index}
            lineNumber={startingLineNumber + index}
            showLineNumbers={showLineNumbers}
            contentOffset={contentOffset}
            getLineClassName={getLineClassName}
          />
        ))}
      </pre>
    </div>
  );
}

function HighlightedLine({
  code,
  language,
  lineIndex,
  lineNumber,
  showLineNumbers,
  contentOffset,
  getLineClassName
}: {
  code: string;
  language: string;
  lineIndex: number;
  lineNumber: number;
  showLineNumbers: boolean;
  contentOffset: number;
  getLineClassName?: (lineIndex: number) => string | undefined;
}) {
  return (
    <Highlight code={code} language={normalizeCodeLanguage(language)} prism={Prism} theme={themes.github}>
      {({ getLineProps, getTokenProps, tokens }) => {
        const line = tokens[0] ?? [];
        const lineProps = getLineProps({ line });
        const customLineClassName = getLineClassName?.(lineIndex) ?? "";
        return (
          <div {...lineProps} className={`${lineProps.className} code-renderer-line ${customLineClassName}`.trim()}>
            {showLineNumbers ? <span className="code-renderer-line-number">{lineNumber}</span> : null}
            <span className="code-renderer-line-content" style={contentOffset ? { paddingLeft: `${contentOffset}px` } : undefined}>
              {line.map((token, tokenIndex) => {
                const tokenProps = getTokenProps({ token });
                return <span key={tokenIndex} {...tokenProps} />;
              })}
            </span>
          </div>
        );
      }}
    </Highlight>
  );
}

function getMarkdownLineLanguages(lines: string[]) {
  const languages: string[] = [];
  let inFence = false;
  let fenceLanguage = "text";

  for (const line of lines) {
    const trimmed = line.trim();

    if (!inFence) {
      languages.push("markdown");
      const openingLanguage = getOpeningFenceLanguage(trimmed);
      if (openingLanguage !== null) {
        inFence = true;
        fenceLanguage = openingLanguage || "text";
      }
      continue;
    }

    if (trimmed.startsWith("```")) {
      languages.push("markdown");
      inFence = false;
      fenceLanguage = "text";
      continue;
    }

    languages.push(fenceLanguage);
  }

  return languages;
}

function getOpeningFenceLanguage(trimmedLine: string) {
  const directFence = trimmedLine.match(/^```(.*)$/);
  if (directFence) {
    return directFence[1].trim();
  }

  const choiceFence = trimmedLine.match(/^[-*]\s+\[(?:x|X| )\]\s*```(.*)$/);
  return choiceFence ? choiceFence[1].trim() : null;
}
