import { describe, expect, it } from "vitest";
import { defaultGradeExportFileName, formatGradeExportTimestamp, gradeExportBaseName } from "./gradebook-export";

describe("gradebook export filenames", () => {
  it("builds the default name from course, group, activity, and dialog timestamp", () => {
    const shownAt = new Date(2026, 9, 6, 14, 5, 9);

    expect(defaultGradeExportFileName("Linear Algebra", "Group 2", "Matrix: inverse", shownAt)).toBe(
      "Linear Algebra-Group 2-Matrix- inverse-2026-10-06-140509"
    );
  });

  it("formats timestamps in local time and removes a manually entered extension", () => {
    const shownAt = new Date(2026, 0, 2, 3, 4, 5);
    expect(formatGradeExportTimestamp(shownAt)).toBe("2026-01-02-030405");
    expect(gradeExportBaseName("My export.xlsx")).toBe("My export");
  });
});
