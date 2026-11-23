import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { CodeRenderer } from "./code-renderer";

describe("syntax-highlighted code with inline controls", () => {
  beforeAll(() => vi.stubGlobal("React", React));

  it("highlights C code around a blank without rendering its placeholder", () => {
    const code = "int result = PLACEHOLDER;\nreturn result;";
    const start = code.indexOf("PLACEHOLDER");
    const html = renderToStaticMarkup(createElement(CodeRenderer, { code, language: "c", inlineSlots: [{
      key: "answer", start, end: start + 11, content: createElement("input", { "aria-label": "Blank 1", type: "text" })
    }] }));
    expect(html).toContain("token keyword");
    expect(html).toContain('aria-label="Blank 1"');
    expect(html).not.toContain("PLACEHOLDER");
    expect(html).toContain("result");
  });

  it("preserves string/comment token context and supports multiple blanks in one token", () => {
    const code = 'print("Hello FIRST and SECOND!")';
    const html = renderToStaticMarkup(createElement(CodeRenderer, { code, language: "python", inlineSlots: ["FIRST", "SECOND"].map((name, index) => ({
      key: name, start: code.indexOf(name), end: code.indexOf(name) + name.length,
      content: createElement("input", { "aria-label": `Blank ${index + 1}`, type: "text" })
    })) }));
    expect(html.match(/<input /g)).toHaveLength(2);
    expect(html).toContain("token string");
    expect(html).toContain("Hello");
    expect(html).toContain("and");
    expect(html).not.toMatch(/FIRST|SECOND/);
  });

  it("retains literal code after a slot split across tokenizer boundaries and CRLF lines", () => {
    const code = 'int x;\r\nreturn left + right;';
    const start = code.indexOf("left");
    const html = renderToStaticMarkup(createElement(CodeRenderer, { code, language: "c", inlineSlots: [{
      key: "expression", start, end: code.indexOf(";", start), content: createElement("input", { type: "text" })
    }] }));
    expect(html.match(/<input /g)).toHaveLength(1);
    expect(html).not.toMatch(/left|right/);
    expect(html).toContain("return");
    expect(html).toContain("token punctuation");
  });
});
