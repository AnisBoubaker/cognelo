import { expect, it } from "vitest";
import { extractTeachingPage } from "./indexing";
it("extracts inline slide Markdown and same-origin external slide sources without running scripts", () => {
  const result = extractTeachingPage('<div class="slides"><section data-markdown><script type="text/template"># Pointers\nint *p;</script></section><section data-markdown="chapter.md"></section></div><script>privateExecutable()</script>', "https://example.test/slides/");
  expect(result.text).toContain("int *p;"); expect(result.text).not.toContain("privateExecutable");
  expect(result.markdownUrls).toEqual(["https://example.test/slides/chapter.md"]);
  expect(() => extractTeachingPage('<section data-markdown="https://other.example/private"></section>', "https://example.test/")).toThrow(/same origin/);
});
