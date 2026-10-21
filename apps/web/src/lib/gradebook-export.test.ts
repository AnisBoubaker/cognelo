import { describe, expect, it } from "vitest";
import { defaultGradeExportFileName, formatGradeExportTimestamp, gradeExportBaseName } from "./gradebook-export";

describe("gradebook export filenames", () => {
  it("builds the default name from course, group, activity, and dialog timestamp", () => {
    const shownAt = new Date("2026-10-06T18:05:09Z");

    expect(defaultGradeExportFileName("Linear Algebra", "Group 2", "Matrix: inverse", shownAt, "America/Toronto")).toBe(
      "Linear Algebra-Group 2-Matrix- inverse-2026-10-06-140509"
    );
  });

  it("formats timestamps in the configured timezone and removes a manually entered extension", () => {
    const shownAt = new Date("2026-01-02T08:04:05Z");
    expect(formatGradeExportTimestamp(shownAt, "America/Toronto")).toBe("2026-01-02-030405");
    expect(gradeExportBaseName("My export.xlsx")).toBe("My export");
  });
});
