import { describe, expect, it } from "vitest";
import { normalizeCodeLanguage, normalizeMonacoLanguage } from "./code-language";

describe("code language normalization", () => {
  it("maps Judge0 language keys to Monaco languages when available", () => {
    expect(normalizeMonacoLanguage("bash")).toBe("shell");
    expect(normalizeMonacoLanguage("csharp")).toBe("csharp");
    expect(normalizeMonacoLanguage("common-lisp")).toBe("scheme");
    expect(normalizeMonacoLanguage("python2")).toBe("python");
    expect(normalizeMonacoLanguage("vbnet")).toBe("vb");
  });

  it("falls back safely when Monaco or Prism has no matching grammar", () => {
    expect(normalizeMonacoLanguage("cobol")).toBe("plaintext");
    expect(normalizeCodeLanguage("COBOL (GnuCOBOL 2.2)")).toBe("text");
  });
});
