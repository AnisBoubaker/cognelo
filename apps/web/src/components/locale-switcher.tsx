"use client";

import { locales, useI18n } from "@/lib/i18n";

export function LocaleSwitcher({ showLabel = true }: { showLabel?: boolean }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <label className="locale-switcher">
      {showLabel ? <span>{t("locale.label")}</span> : null}
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
