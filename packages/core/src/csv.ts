/** Keep untrusted text literal when CSV consumers trim whitespace/control prefixes. */
export function escapeCsvCell(value: string | number | null | undefined) {
  if (typeof value === "number") return String(value);
  const text = value ?? "";
  const safe = /^[\s\u0000-\u001f]*[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
