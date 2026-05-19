import { afterEach, describe, expect, it, vi } from "vitest";
import { detectInitialLocale, getMessage, interpolate, translateMessage } from "./i18n";

describe("i18n helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to English without a browser environment", () => {
    vi.stubGlobal("window", undefined);

    expect(detectInitialLocale()).toBe("en");
  });

  it("prefers saved locale over browser language", () => {
    vi.stubGlobal("window", {
      localStorage: { getItem: vi.fn(() => "fr") },
      navigator: { language: "zh-CN" }
    });

    expect(detectInitialLocale()).toBe("fr");
  });

  it("detects supported browser language prefixes", () => {
    vi.stubGlobal("window", {
      localStorage: { getItem: vi.fn(() => null) },
      navigator: { language: "zh-Hans-CN" }
    });
    expect(detectInitialLocale()).toBe("zh");

    vi.stubGlobal("window", {
      localStorage: { getItem: vi.fn(() => null) },
      navigator: { language: "fr-CA" }
    });
    expect(detectInitialLocale()).toBe("fr");

    vi.stubGlobal("window", {
      localStorage: { getItem: vi.fn(() => null) },
      navigator: { language: "ar-MA" }
    });
    expect(detectInitialLocale()).toBe("ar");
  });

  it("interpolates messages and preserves unknown variables", () => {
    expect(interpolate("Hello {name}, {missing}", { name: "Ada" })).toBe("Hello Ada, {missing}");
    expect(translateMessage("en", "dashboard.roles", { roles: "teacher" })).toBe("Roles: teacher");
  });

  it("returns keys for missing translations and keeps subject wording stable", () => {
    expect(translateMessage("en", "missing.key")).toBe("missing.key");
    expect(getMessage("fr", "subjects.listTitle")).toBe("Matières disponibles");
    expect(getMessage("zh", "subjects.listTitle")).toBe("可用学科");
  });

  it("returns Arabic messages and falls back to English for missing Arabic keys", () => {
    expect(getMessage("ar", "locale.label")).toBe("اللغة");
    expect(getMessage("ar", "subjectDetail.activityBanksTitle")).toBe("بنوك الأنشطة");
    expect(getMessage("ar", "courseDetail.activitiesTitle")).toBe("الأنشطة المرفقة");
    expect(getMessage("ar", "courseDetail.gradebookTitle")).toBe("دفتر درجات المقرر");
    expect(getMessage("ar", "materialKinds.github_repo")).toBe("GitHub repo");
  });
});
