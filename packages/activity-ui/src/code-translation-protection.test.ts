import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { CodeEditor } from "./code-editor";
import { CodeRenderer } from "./code-renderer";

describe("code translation protection", () => {
  beforeAll(() => {
    vi.stubGlobal("React", React);
  });

  it("marks rendered code as non-translatable", () => {
    const html = renderToStaticMarkup(createElement(CodeRenderer, {
      code: "while (true) {}",
      language: "javascript"
    }));

    expect(html).toContain('class="code-renderer notranslate"');
    expect(html).toContain('translate="no"');
  });

  it("disables browser writing assistance on editable code", () => {
    const html = renderToStaticMarkup(createElement(CodeEditor, {
      value: "while (true) {}",
      onChange: () => undefined,
      language: "javascript"
    }));
    const normalizedHtml = html.toLowerCase();

    expect(html).toContain('class="code-editor notranslate"');
    expect(normalizedHtml).toContain('autocapitalize="off"');
    expect(normalizedHtml).toContain('autocomplete="off"');
    expect(normalizedHtml).toContain('autocorrect="off"');
    expect(normalizedHtml).toContain('spellcheck="false"');
    expect(normalizedHtml).toContain('translate="no"');
    expect(normalizedHtml).toContain('writingsuggestions="false"');
    expect(normalizedHtml).toContain('data-gramm="false"');
    expect(normalizedHtml).toContain('data-ms-editor="false"');
  });
});
