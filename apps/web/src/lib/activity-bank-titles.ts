export function defaultDuplicateBankActivityTitle(title: string) {
  const match = title.match(/^(.*) \(copy(?: #(\d+))?\)$/);
  const suffix = match ? ` (copy #${match[2] ? Number.parseInt(match[2], 10) + 1 : 2})` : " (copy)";
  const baseTitle = (match?.[1] ?? title).slice(0, 160 - suffix.length).trimEnd();
  return `${baseTitle}${suffix}`;
}
