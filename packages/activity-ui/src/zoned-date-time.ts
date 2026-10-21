import { Temporal } from "@js-temporal/polyfill";

export type DateTimeValue = string | number | Date;
export function formatZonedDateTime(value: DateTimeValue, timeZone: string, locale?: string, options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" }) {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(new Date(value));
}
export function toZonedDateTimeInput(value: DateTimeValue | null | undefined, timeZone: string) {
  if (value === null || value === undefined || value === "") return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return Temporal.Instant.from(date.toISOString()).toZonedDateTimeISO(timeZone).toPlainDateTime().toString({ smallestUnit: "minute" });
}
export function fromZonedDateTimeInput(value: string, timeZone: string) {
  if (!value) return null;
  return Temporal.PlainDateTime.from(value, { overflow: "reject" }).toZonedDateTime(timeZone, { disambiguation: "compatible" }).toInstant().toString({ fractionalSecondDigits: 3 });
}
export function isZonedMidnight(value: DateTimeValue, timeZone: string) {
  const date = Temporal.Instant.from(new Date(value).toISOString()).toZonedDateTimeISO(timeZone);
  return date.hour === 0 && date.minute === 0 && date.second === 0 && date.millisecond === 0;
}
