import { describe, expect, it } from "vitest";
import { renderMarkdownToHtml } from "./markdown";

describe("shared Markdown rendering", () => {
  it("renders standard Markdown and fenced code", () => {
    const html = renderMarkdownToHtml([
      "## Requirements",
      "",
      "Use **two values**:",
      "",
      "- read both values",
      "- print the result",
      "",
      "```c",
      "printf(\"done\\n\");",
      "```"
    ].join("\n"));

    expect(html).toContain("<h2>Requirements</h2>");
    expect(html).toContain("<strong>two values</strong>");
    expect(html).toContain("<ul>");
    expect(html).toContain('<code class="language-c">');
  });

  it("renders display and inline LaTeX without exposing their delimiters", () => {
    const html = renderMarkdownToHtml([
      "The inline value is $r^2$ or \\(m + 1\\).",
      "",
      "$$",
      "V = \\sqrt{\\frac{2mg}{0.5\\rho\\pi r^2}}",
      "$$"
    ].join("\n"));

    expect(html).toContain('class="markdown-math-inline"');
    expect(html).toContain('class="markdown-math-display"');
    expect(html).toContain('class="katex-display"');
    expect(html).toContain("<math");
    expect(html).not.toContain("$$");
  });

  it("can protect rendered LaTeX while retaining its original Markdown source", () => {
    const displaySource = ["$$", "V = \\sqrt{r^2}", "$$"].join("\n");
    const markdown = `The radius is $r^2$.\n\n${displaySource}`;
    const protectedHtml = renderMarkdownToHtml(markdown, { protectMath: true });
    const studentHtml = renderMarkdownToHtml(markdown);

    expect(protectedHtml).toContain('contenteditable="false"');
    expect(protectedHtml).toContain('data-markdown-math-display="true"');
    expect(protectedHtml).toContain(`data-markdown-math-source="${encodeURIComponent(displaySource)}"`);
    expect(protectedHtml).toContain(`data-markdown-math-source="${encodeURIComponent("$r^2$")}"`);
    expect(studentHtml).not.toContain("data-markdown-math-source");
    expect(studentHtml).not.toContain("contenteditable");
  });

  it("does not treat ordinary currency as inline math", () => {
    const html = renderMarkdownToHtml("The prices are $5 and $ 10.");

    expect(html).toContain("$5 and $ 10.");
    expect(html).not.toContain('class="markdown-math-inline"');
  });

  it("leaves math delimiters inside code spans and fences untouched", () => {
    const html = renderMarkdownToHtml([
      "Use `$$not math$$` literally.",
      "",
      "```text",
      "$$also not math$$",
      "```"
    ].join("\n"));

    expect(html).toContain("$$not math$$");
    expect(html).toContain("$$also not math$$");
    expect(html).not.toContain('class="markdown-math-display"');
    expect(html).not.toContain('class="markdown-math-inline"');
  });

  it("renders invalid LaTeX as a non-throwing KaTeX error", () => {
    expect(() => renderMarkdownToHtml("$$\\notARealCommand{x}$$")).not.toThrow();
    expect(renderMarkdownToHtml("$$\\notARealCommand{x}$$")).toContain("\\notARealCommand");
  });
});
