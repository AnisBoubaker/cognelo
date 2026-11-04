import { describe, expect, it } from "vitest";
import { assertReadableLinkMaterial, extractHtmlMaterialContent } from "./embedding-content";

describe("teaching-content extraction", () => {
  it.each([
    '<title>A long page title is not a lesson</title><nav><a href="/">Home</a> Courses Login</nav><h1>Programming course</h1>',
    '<h1>Programming</h1><main id="app">Loading…</main><script src="app.js"></script>',
    '<main><h1>Lesson</h1><iframe src="lesson"></iframe></main>',
    '<h1>Sign in</h1><form>Email <input>Password <input><button>Continue</button></form>',
    '<div>Please enable JavaScript to view this application.</div>',
    '<main>Checking your browser before continuing.</main>',
    '<main><a href="/one">First lecture</a><a href="/two">Second lecture</a></main>'
  ])("rejects shells/navigation without substantive lesson text: %s", html => {
    expect(() => assertReadableLinkMaterial(extractHtmlMaterialContent(html).evidence)).toThrow(/readable teaching content/);
  });

  it("keeps article prose/code while excluding navigation and hidden/interactive chrome", () => {
    const html = '<title>Course</title><nav>UNWANTED_MENU</nav><main><h1>Pointers</h1><p>A pointer stores an address.</p><pre>#include &lt;stdio.h&gt;\nint *p;</pre><div hidden>HIDDEN</div><button>BUTTON</button></main><footer>FOOTER</footer>';
    const result = extractHtmlMaterialContent(html);
    expect(result.text).toContain("Pointers");
    expect(result.text).toContain("A pointer stores an address.");
    expect(result.text).toContain("#include <stdio.h>");
    expect(result.text).not.toMatch(/UNWANTED_MENU|HIDDEN|BUTTON|FOOTER/);
    expect(() => assertReadableLinkMaterial(result.evidence)).not.toThrow();
  });

  it("accepts concise lessons and non-Reveal HTML without imposing an arbitrary word count", () => {
    for (const html of ['<p>x = y + 2</p>', '<div>Une variable conserve une valeur.</div>', '<section><h2>Bounds</h2><ul><li>Check i &lt; n before indexing.</li></ul></section>']) {
      expect(() => assertReadableLinkMaterial(extractHtmlMaterialContent(html).evidence)).not.toThrow();
    }
    expect(() => assertReadableLinkMaterial('# Heading only')).toThrow();
    expect(() => assertReadableLinkMaterial('The phrase “loading” is displayed while a request is pending.')).not.toThrow();
  });

  it("retains inert slide Markdown but never executable scripts", () => {
    const content = extractHtmlMaterialContent('<section data-markdown><script type="text/template"># Addition\nThe expression a + b adds two values.</script></section><script>EXECUTABLE()</script>');
    expect(content.text).toContain("The expression a + b");
    expect(content.text).not.toContain("EXECUTABLE");
    expect(() => assertReadableLinkMaterial(content.evidence)).not.toThrow();
  });
});
