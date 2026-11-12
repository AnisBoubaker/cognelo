import { describe, expect, it } from "vitest";
import { SYSTEM_ERRORS } from "@cognelo/contracts";
import { getMessage, locales, translateMessage } from "./i18n";
import { localizedSystemError } from "./system-errors";

describe("localized system errors", () => {
  it.each(locales)("has translations for every support code in %s", (locale) => {
    for (const code of Object.keys(SYSTEM_ERRORS)) {
      expect(typeof getMessage(locale, `systemErrors.${code}`)).toBe("string");
    }
  });

  it("displays only the code in production and adds guidance only in development", () => {
    const t = (key: string, vars?: Record<string, string | number>) => translateMessage("en", key, vars);
    expect(localizedSystemError("SYS-002", t, false)).toBe("System error (SYS-002).");
    expect(localizedSystemError("SYS-002", t, true)).toContain("docker compose up -d db");
    expect(localizedSystemError("SYS-002", (key, vars) => translateMessage("fr", key, vars), false)).toBe("Erreur système (SYS-002).");
  });
});
