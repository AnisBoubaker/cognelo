export function defaultGradeExportFileName(
  courseTitle: string,
  groupName: string,
  activityTitle: string,
  shownAt: Date
) {
  return [courseTitle, groupName, activityTitle, formatGradeExportTimestamp(shownAt)]
    .map(sanitizeGradeExportFileNamePart)
    .filter(Boolean)
    .join("-")
    .slice(0, 160)
    .replace(/[. ]+$/g, "");
}

export function formatGradeExportTimestamp(value: Date) {
  return [
    String(value.getFullYear()).padStart(4, "0"),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0")
  ].join("-") + `-${[
    String(value.getHours()).padStart(2, "0"),
    String(value.getMinutes()).padStart(2, "0"),
    String(value.getSeconds()).padStart(2, "0")
  ].join("")}`;
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
