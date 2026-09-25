import { locales, type Locale } from "./i18n/types";

export const localeStorageKey = "cognelo-locale";

export const documentLocaleBootstrapScript = `(() => {
  try {
    const supported = ${JSON.stringify(locales)};
    const saved = window.localStorage.getItem(${JSON.stringify(localeStorageKey)});
    const browserLanguage = window.navigator.language.toLowerCase();
    const locale = supported.includes(saved)
      ? saved
      : supported.find((candidate) => browserLanguage.startsWith(candidate)) || "en";
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  } catch {}
})();`;

export function applyDocumentLocale(locale: Locale) {
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  window.localStorage.setItem(localeStorageKey, locale);
}
