"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { messages } from "./i18n/messages";
import { locales, type Locale, type MessageTree } from "./i18n/types";
export { locales, type Locale, type MessageTree } from "./i18n/types";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function getMessage(locale: Locale, key: string) {
  const message = key.split(".").reduce<string | MessageTree | undefined>((current, part) => {
    if (!current || typeof current === "string") {
      return current;
    }
    return current[part];
  }, messages[locale]);

  if (message !== undefined || locale === "en") {
    return message;
  }

  return key.split(".").reduce<string | MessageTree | undefined>((current, part) => {
    if (!current || typeof current === "string") {
      return current;
    }
    return current[part];
  }, messages.en);
}

export function interpolate(message: string, vars?: Record<string, string | number>) {
  if (!vars) {
    return message;
  }

  return message.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`));
}

export function detectInitialLocale() {
  if (typeof window === "undefined") {
    return "en" as Locale;
  }

  const saved = window.localStorage.getItem("cognelo-locale");
  if (saved && locales.includes(saved as Locale)) {
    return saved as Locale;
  }

  const browser = window.navigator.language.toLowerCase();
  if (browser.startsWith("fr")) {
    return "fr";
  }
  if (browser.startsWith("zh")) {
    return "zh";
  }
  if (browser.startsWith("ar")) {
    return "ar";
  }
  return "en";
}

export function translateMessage(locale: Locale, key: string, vars?: Record<string, string | number>) {
  const message = getMessage(locale, key);
  return typeof message === "string" ? interpolate(message, vars) : key;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    setLocaleState(detectInitialLocale());
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    window.localStorage.setItem("cognelo-locale", locale);
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale: (nextLocale) => setLocaleState(nextLocale),
      t: (key, vars) => translateMessage(locale, key, vars)
    }),
    [locale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider.");
  }
  return context;
}
