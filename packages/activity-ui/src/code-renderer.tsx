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
};

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
