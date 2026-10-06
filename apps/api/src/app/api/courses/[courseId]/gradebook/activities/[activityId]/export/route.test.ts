import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  createCsv: vi.fn(),
  createXlsx: vi.fn(),
  disposition: vi.fn(),
  getRows: vi.fn(),
  requireUser: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  AppError: class AppError extends Error {
    constructor(public readonly status: number, public readonly code: string, message: string) {
      super(message);
    }
  }
}));
vi.mock("@/lib/activity-grade-export", () => ({
  getActivityFinalGradeExportRows: mocks.getRows
}));
vi.mock("@/lib/activity-grade-export-file", () => ({
  activityGradeExportContentDisposition: mocks.disposition,
  createActivityGradeCsv: mocks.createCsv,
  createActivityGradeXlsx: mocks.createXlsx
}));
vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  options: () => new Response(null, { status: 204 }),
  requireUser: mocks.requireUser
}));

const { GET } = await import("./route");
const params = { params: Promise.resolve({ courseId: "course-1", activityId: "activity-1" }) };

describe("activity grade export route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "teacher-1", roles: ["teacher"] });
    mocks.getRows.mockResolvedValue([{ email: "student@example.test", firstName: "Ada", lastName: "Student", grade: 9 }]);
    mocks.disposition.mockImplementation((fileName: string, format: string) => `attachment; filename="${fileName}.${format}"`);
    mocks.createCsv.mockReturnValue("csv-body");
    mocks.createXlsx.mockReturnValue(new Uint8Array([1, 2, 3]));
  });

  it("returns a named CSV for the selected activity and group", async () => {
    const response = await GET(new NextRequest(
      "http://test.local/api/courses/course-1/gradebook/activities/activity-1/export?format=csv&groupId=group-1&fileName=Course-Group-Activity"
    ), params);

    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="Course-Group-Activity.csv"');
    await expect(response.text()).resolves.toBe("csv-body");
    expect(mocks.getRows).toHaveBeenCalledWith(
      { id: "teacher-1", roles: ["teacher"] },
      "course-1",
      "activity-1",
      "group-1"
    );
  });

  it("returns an XLSX workbook when requested", async () => {
    const response = await GET(new NextRequest(
      "http://test.local/api/courses/course-1/gradebook/activities/activity-1/export?format=xlsx&fileName=Grades"
    ), params);

    expect(response.headers.get("content-type")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(mocks.createXlsx).toHaveBeenCalledOnce();
  });

  it("rejects unsupported formats", async () => {
    await expect(GET(new NextRequest(
      "http://test.local/api/courses/course-1/gradebook/activities/activity-1/export?format=pdf"
    ), params)).rejects.toMatchObject({ status: 400, code: "INVALID_GRADE_EXPORT_FORMAT" });
  });
});
