"use client";

import { locales, useI18n } from "@/lib/i18n";

export function LocaleSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <label className="locale-switcher">
      <span>{t("locale.label")}</span>
      <select value={locale} onChange={(event) => setLocale(event.target.value as (typeof locales)[number])}>
        {locales.map((option) => (
          <option key={option} value={option}>
            {t(`locale.${option}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
