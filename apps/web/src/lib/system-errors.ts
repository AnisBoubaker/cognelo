import { type SystemErrorCode } from "@cognelo/contracts";
import { locales, translateMessage, type Locale } from "./i18n";

export function localizedSystemError(
  code: SystemErrorCode,
  t: (key: string, vars?: Record<string, string | number>) => string,
  development = process.env.NODE_ENV === "development"
) {
  const message = t("systemErrors.message", { code });
  return development ? `${message} ${t(`systemErrors.${code}`)}` : message;
}

export function currentSystemError(code: SystemErrorCode) {
  const language = typeof document === "undefined" ? "en" : document.documentElement.lang;
  const locale = locales.includes(language as Locale) ? language as Locale : "en";
  return localizedSystemError(code, (key, vars) => translateMessage(locale, key, vars));
}
