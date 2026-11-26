import { beforeEach, expect, it, vi } from "vitest";
import { unzipSync } from "fflate";
import type { CurrentUser } from "@cognelo/contracts";
import type { StudentCourseExportBundle } from "@cognelo/core";
const mocks = vi.hoisted(() => ({ render: vi.fn() }));
vi.mock("./answer-export-pdf", async original => ({ ...await original<object>(), withAnswerExportRenderer: async (_user: unknown, _locale: unknown, signal: AbortSignal | undefined, work: (value: object) => Promise<unknown>) => work({ render: mocks.render, css: "", signal: signal ?? new AbortController().signal }) }));
import { createStudentCourseExportFile, studentCourseArchiveName, studentCourseDocumentHtml } from "./student-course-export-file";
import { studentCourseExportLabels } from "./student-course-export-labels";
import { blockHtml } from "./answer-export-pdf";
const user = { id: "student" } as CurrentUser;
const bundle = (): StudentCourseExportBundle => ({ courseTitle: "École / Programming", subjectTitle: "Computing", studentName: "Sam", timeZone: "UTC", locale: "en", exportedAt: "2026-11-25T12:00:00Z",
  labels: studentCourseExportLabels("en"), directories: [["001-Week 1"]], files: [{ path: ["001-Week 1", "002-Files", "001-starter.zip"], bytes: new Uint8Array([1, 2, 3]) }],
  documents: [{ path: ["001-Week 1", "001-Lesson"], title: "Lesson <script>", groupTitle: "Section A", prompt: [{ kind: "markdown", text: "A **lesson**" }, { kind: "link", url: "https://example.test/reference", text: "Reference" }], attempts: [] }],
  revalidate: vi.fn().mockResolvedValue(undefined), authorizeImage: vi.fn().mockResolvedValue(false) });
beforeEach(() => { vi.clearAllMocks(); mocks.render.mockImplementation(async (html: string) => Buffer.from("%PDF-" + html)); });
it("preserves ordered course folders, produces an index and retains original file bytes", async () => {
  const data = bundle();
  const result = await createStudentCourseExportFile(async () => data, user, "en");
  const entries = unzipSync(result.bytes);
  const names = Object.keys(entries);
  expect(names).toEqual(["Course-École - Programming/000-Course contents.pdf", "Course-École - Programming/001-Week 1/", "Course-École - Programming/001-Week 1/002-Files/001-starter.zip", "Course-École - Programming/001-Week 1/001-Lesson.pdf"]);
  expect(entries[names[2]]).toEqual(new Uint8Array([1, 2, 3]));
  expect(Buffer.from(entries[names[0]]).toString()).toContain("001-Week 1/001-Lesson.pdf");
  expect(data.revalidate).toHaveBeenCalledOnce();
});
it("discards rendered output when delivery authorization changes", async () => {
  const data = bundle(); data.revalidate = async () => { throw new Error("Course export disabled"); };
  await expect(createStudentCourseExportFile(async () => data, user, "en")).rejects.toThrow("Course export disabled");
  expect(mocks.render).toHaveBeenCalled();
});
it("does not publish a late result after cancellation", async () => {
  const controller = new AbortController();
  mocks.render.mockImplementation(async () => { controller.abort(); return Buffer.from("%PDF-"); });
  await expect(createStudentCourseExportFile(async () => bundle(), user, "en", controller.signal)).rejects.toHaveProperty("name", "AbortError");
});
it("prints released totals independently of saved attempt scores, and escapes submitted code", () => {
  const data = bundle(), document = data.documents[0];
  document.grade = "95 / 100";
  document.attempts = [{ number: 2, submittedAt: null, score: "80 / 100", sections: [{ title: "Source", prompt: [], answer: [{ kind: "code", text: "<script>alert(1)</script>" }], grading: [] }] }];
  const html = studentCourseDocumentHtml(data, document);
  expect(html).toContain("95 / 100"); expect(html).toContain("80 / 100");
  expect(html).toContain('<bdi dir="ltr">95 / 100</bdi>');
  expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;"); expect(html).not.toContain("<script>");
});
it("keeps hyperlinks printable and rejects active or credential-bearing URLs", () => {
  expect(blockHtml({ kind: "link", text: "Repository", url: "https://github.com/example/course" })).toContain('href="https://github.com/example/course"');
  expect(blockHtml({ kind: "link", text: "Repository", url: "https://github.com/example/course" })).toContain('dir="ltr">https://github.com/example/course');
  for (const url of ["javascript:alert(1)", "file:///etc/passwd", "https://user:password@example.test"]) expect(blockHtml({ kind: "link", url, text: "Link" })).not.toContain("href=");
});
it.each(["../../etc/passwd", "a\\b\u0000\n", ".", "CON.zip", "é".repeat(200) + ".zip", "😀".repeat(100) + ".pdf"])("bounds archive names without traversal or broken UTF-8 (%s)", value => {
  const name = studentCourseArchiveName(value);
  expect(name).not.toMatch(/[\/\\\x00-\x1f]/); expect(name).not.toContain("..");
  expect(Buffer.byteLength(name)).toBeLessThanOrEqual(120); expect(name).not.toContain("�");
  if (/\.(zip|pdf)$/.test(value)) expect(name).toMatch(/\.(zip|pdf)$/);
  expect(name).not.toMatch(/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i);
});
it("appends identical prompt PDF artwork only once per activity", async () => {
  const { PDFDocument } = await import("pdf-lib"), fixture = await PDFDocument.create(); fixture.addPage();
  const bytes = await fixture.save(); mocks.render.mockResolvedValue(Buffer.from(bytes));
  const data = bundle(), attachment = { name: "Assignment.pdf", bytes };
  data.documents[0].promptPdfs = [attachment];
  data.documents[0].attempts = [{ number: 1, submittedAt: null, sections: [{ title: "Homework", prompt: [], answer: [], grading: [], promptPdfs: [attachment] }] }];
  const result = await createStudentCourseExportFile(async () => data, user, "en");
  const archive = unzipSync(result.bytes), item = Object.entries(archive).find(([name]) => name.endsWith("001-Lesson.pdf"))![1];
  expect((await PDFDocument.load(item)).getPageCount()).toBe(2);
});
