export function defaultDuplicateActivityTitle(title: string, maxLength = 180) {
  const match = title.match(/^(.*) \(copy(?: #(\d+))?\)$/);
  const suffix = match ? ` (copy #${match[2] ? Number.parseInt(match[2], 10) + 1 : 2})` : " (copy)";
  const baseTitle = (match?.[1] ?? title).slice(0, maxLength - suffix.length).trimEnd();
  return `${baseTitle}${suffix}`;
}

export const defaultDuplicateBankActivityTitle = (title: string) => defaultDuplicateActivityTitle(title, 160);

export function defaultVariationBankActivityTitle(
  title: string,
  locale: "en" | "fr" | "zh" | "ar"
) {
  const suffix = locale === "fr" ? " (variante)" : locale === "zh" ? "（变体）" : locale === "ar" ? " (نسخة متنوعة)" : " (variation)";
  return `${title.slice(0, 160 - suffix.length).trimEnd()}${suffix}`;
}
