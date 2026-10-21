export function defaultGradeExportFileName(
  courseTitle: string,
  groupName: string,
  activityTitle: string,
  shownAt: Date,
  timeZone = "UTC"
) {
  return [courseTitle, groupName, activityTitle, formatGradeExportTimestamp(shownAt, timeZone)]
    .map(sanitizeGradeExportFileNamePart)
    .filter(Boolean)
    .join("-")
    .slice(0, 160)
    .replace(/[. ]+$/g, "");
}

export function formatGradeExportTimestamp(value: Date, timeZone = "UTC") {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  }).formatToParts(value).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}-${parts.hour}${parts.minute}${parts.second}`;
}

export function sanitizeGradeExportFileNamePart(value: string) {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim();
}

export function gradeExportBaseName(value: string) {
  return sanitizeGradeExportFileNamePart(value.replace(/\.(csv|xlsx)$/i, "")).slice(0, 160) || "grades";
}
