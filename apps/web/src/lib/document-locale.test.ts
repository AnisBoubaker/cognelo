import { afterEach, describe, expect, it, vi } from "vitest";
import { applyDocumentLocale, documentLocaleBootstrapScript, localeStorageKey } from "./document-locale";

describe("document locale", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("applies and persists the selected Cognelo locale", () => {
    const documentElement = { dir: "", lang: "" };
    const setItem = vi.fn();
    vi.stubGlobal("document", { documentElement });
    vi.stubGlobal("window", { localStorage: { setItem } });

    applyDocumentLocale("ar");

    expect(documentElement).toEqual({ dir: "rtl", lang: "ar" });
    expect(setItem).toHaveBeenCalledWith(localeStorageKey, "ar");
  });

  it("sets the saved locale before the application renders", () => {
    const documentElement = { dir: "", lang: "en" };
    vi.stubGlobal("document", { documentElement });
    vi.stubGlobal("window", {
      localStorage: { getItem: () => "fr" },
      navigator: { language: "en-CA" }
    });

    Function(documentLocaleBootstrapScript)();

    expect(documentElement).toEqual({ dir: "ltr", lang: "fr" });
  });
});
