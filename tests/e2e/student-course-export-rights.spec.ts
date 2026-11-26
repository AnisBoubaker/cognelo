import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { unzipSync } from "fflate";
import { PDFDocument } from "pdf-lib";
import { prisma } from "@cognelo/db";
import type { CurrentUser, StudentCourseExportPolicy } from "@cognelo/contracts";
import type { TestInfo } from "@playwright/test";
import { test, expect } from "./fixtures/bank-course";
import { createAuthenticatedApi, createAuthenticatedApiWithCredentials } from "./fixtures/auth";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";
import { ensureContentTypePluginEnabled } from "./fixtures/content-plugins";

async function inspectArchive(bytes: Uint8Array, testInfo: TestInfo, label: string, studentName: string, confidential: boolean, original: Uint8Array) {
  const archive = unzipSync(bytes), texts: Record<string, string> = {};
  const directory = testInfo.outputPath(label); await mkdir(directory, { recursive: true });
  for (const [index, [name, content]] of Object.entries(archive).entries()) {
    if (!name.endsWith(".pdf")) continue;
    if (name.endsWith("original.pdf")) { expect(Buffer.from(content)).toEqual(Buffer.from(original)); continue; }
    const file = `${directory}/${index}.pdf`; await writeFile(file, content);
    const pdf = await PDFDocument.load(content);
    for (let page = 1; page <= pdf.getPageCount(); page++) {
      const text = execFileSync("pdftotext", ["-f", String(page), "-l", String(page), "-raw", file, "-"], { encoding: "utf8" });
      expect(text, `${name}, page ${page}`).toContain(studentName);
      expect(text, `${name}, page ${page}`).toContain("Tous droits réservés");
      expect(text.replace(/\s/g, "").includes("Confidential"), `${name}, page ${page}`).toBe(confidential);
    }
    texts[name] = execFileSync("pdftotext", ["-layout", file, "-"], { encoding: "utf8" });
  }
  return { archive, texts, all: Object.values(texts).join("\n") };
}

test("site and course usage rights, read-only locks, translated rights PDF and every-page copyright/watermark", async ({ bankCourse: data, teacherApi, teacherPage, adminPage, studentPage }, testInfo) => {
  test.setTimeout(240_000);
  const admin = await createAuthenticatedApi("admin"), student = await createAuthenticatedApi("student");
  const policyPath = "/api/settings/course-exports", coursePath = `/api/courses/${data.courseId}`;
  const originalPolicy = await responseJson<StudentCourseExportPolicy>(await admin.get(policyPath));
  const studentUser = (await responseJson<{ user: CurrentUser }>(await student.get("/api/users/me"))).user;
  const studentName = [studentUser.firstName, studentUser.lastName].filter(Boolean).join(" ") || studentUser.name || studentUser.email;
  try {
    const siteTerms = `Site rights ${data.token}`, courseTerms = `Teacher rights ${data.token}`, lockedTerms = `Mandatory site rights ${data.token}`;
    await adminPage.goto("/settings/course-exports");
    const siteField = adminPage.getByLabel("Site-wide usage rights", { exact: true }), teacherEditing = adminPage.getByRole("switch", { name: "Allow teachers to edit usage rights", exact: true });
    await expect(siteField).toHaveValue(originalPolicy.usageRights);
    await siteField.fill("Unsaved site rights"); await adminPage.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(siteField).toHaveValue(originalPolicy.usageRights);
    await siteField.fill(siteTerms); await teacherEditing.check();
    await adminPage.getByRole("button", { name: "Save", exact: true }).click();
    await expect(adminPage.getByRole("status")).toContainText("Course export policy saved.");
    await adminPage.reload(); await expect(siteField).toHaveValue(siteTerms); await expect(teacherEditing).toBeChecked();
    for (const actor of [teacherApi, student]) expect((await actor.put(policyPath, { data: { usageRights: "Forged", allowTeacherEditing: true } })).status()).toBe(403);
    await responseJson(await teacherApi.patch(`/api/subjects/${data.subjectId}`, { data: { teachingLanguage: "fr" } }));
    await teacherPage.goto(`/courses/${data.courseId}?tab=settings&section=general`);
    const enabled = teacherPage.getByRole("switch", { name: "Allow students to export course content", exact: true });
    const courseField = teacherPage.getByLabel("Usage rights", { exact: true });
    const watermark = teacherPage.getByRole("switch", { name: "Watermark PDFs with “Confidential”", exact: true });
    await expect(courseField).toHaveCount(0);
    await enabled.check(); await expect(courseField).toHaveValue(siteTerms); await expect(courseField).toBeEditable();
    await courseField.fill(courseTerms); await watermark.check(); await teacherPage.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(courseField).toHaveCount(0); await expect(enabled).not.toBeChecked();
    await enabled.check(); await expect(courseField).toHaveValue(siteTerms); await courseField.fill(courseTerms); await watermark.check();
    await teacherPage.getByRole("button", { name: "Save course", exact: true }).click();
    await expect(teacherPage.getByRole("status")).toContainText("General course settings saved.");
    await teacherPage.reload(); await expect(courseField).toHaveValue(courseTerms); await expect(watermark).toBeChecked();
    await ensureContentTypePluginEnabled("text-content"); await ensureContentTypePluginEnabled("file-content");
    const body = "# Course notes\n\n" + Array.from({ length: 95 }, (_, index) => `Paragraph ${index + 1}. Course content with a short explanation to check repeated notices on multiple PDF pages.\n`).join("\n");
    await responseJson(await teacherApi.post(`${coursePath}/content-resources`, { data: { contentTypeKey: "text", payload: { title: "Long course notes", body } } }));
    const original = await PDFDocument.create(); original.addPage().drawText("ORIGINAL PDF - unchanged"); original.addPage().drawText("Second original page"); const originalBytes = await original.save();
    const { resource } = await responseJson<{ resource: { id: string } }>(await teacherApi.post(`${coursePath}/content-resources`, { data: { contentTypeKey: "file", payload: { title: "Original PDF" } } }));
    await responseJson(await teacherApi.put(`${coursePath}/content-resources/${resource.id}/upload`, { multipart: { title: "Original PDF", file: { name: "original.pdf", mimeType: "application/pdf", buffer: Buffer.from(originalBytes) } } }));
    const attemptsBefore = await prisma.activityAttempt.findMany({ where: { courseId: data.courseId } });
    const gradesBefore = await prisma.grade.findMany({ where: { gradebookItem: { courseId: data.courseId } } });
    await studentPage.goto(`/courses/${data.courseId}/groups/${data.groupId}`);
    const downloadPromise = studentPage.waitForEvent("download", { timeout: 120_000 });
    await studentPage.getByRole("button", { name: "Export course content", exact: true }).click();
    const download = await downloadPromise; await download.saveAs(testInfo.outputPath("course-rights.zip"));
    const first = await inspectArchive(await readFile(testInfo.outputPath("course-rights.zip")), testInfo, "custom-watermarked", studentName, true, originalBytes);
    const rightsPath = Object.keys(first.archive)[0]; expect(rightsPath).toMatch(/000-Droits d’utilisation.pdf$/);
    expect(first.texts[rightsPath]).toContain(courseTerms); expect(first.texts[rightsPath]).not.toContain(siteTerms);
    expect(Object.entries(first.texts).filter(([name]) => name !== rightsPath).every(([, value]) => !value.includes(courseTerms))).toBe(true);
    expect((await PDFDocument.load(first.archive[Object.keys(first.archive).find(name => name.endsWith("Long course notes.pdf"))!])).getPageCount()).toBeGreaterThan(1);
    // Keep the teacher's form open with an editable draft while the administrator locks it.
    await courseField.fill("Stale teacher draft");
    await siteField.fill(lockedTerms); await teacherEditing.uncheck(); await adminPage.getByRole("button", { name: "Save", exact: true }).click();
    await expect(adminPage.getByRole("status")).toContainText("Course export policy saved.");
    await teacherPage.getByRole("button", { name: "Save course", exact: true }).click();
    await expect(courseField).not.toBeEditable(); await expect(courseField).toHaveValue(lockedTerms);
    expect((await teacherApi.patch(coursePath, { data: { studentCourseExportUsageRights: "Forged after lock" } })).status()).toBe(403);
    expect((await prisma.course.findUniqueOrThrow({ where: { id: data.courseId } })).studentCourseExportUsageRights).toBe(courseTerms);
    await watermark.uncheck(); await teacherPage.getByRole("button", { name: "Save course", exact: true }).click();
    await expect(teacherPage.getByRole("status")).toContainText("General course settings saved.");
    const lockedDownload = await student.post(`${coursePath}/student-export`, { data: { locale: "en" }, timeout: 120_000 }); expect(lockedDownload.ok()).toBe(true);
    const locked = await inspectArchive(await lockedDownload.body(), testInfo, "locked-unwatermarked", studentName, false, originalBytes);
    expect(locked.texts[Object.keys(locked.archive)[0]]).toContain(lockedTerms); expect(locked.all).not.toContain(courseTerms);
    await teacherEditing.check(); await adminPage.getByRole("button", { name: "Save", exact: true }).click();
    await expect(adminPage.getByRole("status")).toContainText("Course export policy saved.");
    await teacherPage.reload(); await expect(courseField).toBeEditable(); await expect(courseField).toHaveValue(courseTerms);
    await teacherPage.getByRole("button", { name: "Use site default", exact: true }).click(); await expect(courseField).toHaveValue(lockedTerms);
    await teacherPage.getByRole("button", { name: "Save course", exact: true }).click(); await expect(teacherPage.getByRole("status")).toContainText("General course settings saved.");
    expect((await prisma.course.findUniqueOrThrow({ where: { id: data.courseId } })).studentCourseExportUsageRights).toBeNull();
    expect(await prisma.activityAttempt.findMany({ where: { courseId: data.courseId } })).toEqual(attemptsBefore);
    expect(await prisma.grade.findMany({ where: { gradebookItem: { courseId: data.courseId } } })).toEqual(gradesBefore);
    await adminPage.setViewportSize({ width: 390, height: 844 }); await teacherPage.setViewportSize({ width: 390, height: 844 });
    for (const page of [adminPage, teacherPage]) expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await teacherPage.screenshot({ path: testInfo.outputPath("course-export-rights-mobile.png") });
  } finally { await responseJson(await admin.put(policyPath, { data: originalPolicy })); await admin.dispose(); await student.dispose(); }
});

test("Chinese and Arabic rights and student names remain readable on appended PDF pages", async ({ bankCourse: data, teacherApi }, testInfo) => {
  test.setTimeout(180_000);
  const admin = await createAuthenticatedApi("admin"), course = `/api/courses/${data.courseId}`;
  const originalPolicy = await responseJson<StudentCourseExportPolicy>(await admin.get("/api/settings/course-exports"));
  let student: Awaited<ReturnType<typeof createAuthenticatedApi>> | undefined, userId: string | undefined;
  try {
    await responseJson(await admin.put("/api/settings/course-exports", { data: { usageRights: "Multilingual course terms", allowTeacherEditing: true } }));
    const account = { email: `rights-${data.token}@cognelo.local`, password: "ExportRights123!" };
    const { user } = await responseJson<{ user: { id: string } }>(await admin.post("/api/users", { data: { ...account, firstName: "李明", lastName: "علي Élève", roles: ["student"] } }));
    userId = user.id; await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date(), mustChangePassword: false } });
    await responseJson(await teacherApi.post(`${course}/groups/${data.groupId}/participants`, { data: { email: account.email, role: "student" } }));
    student = await createAuthenticatedApiWithCredentials(account);
    const id = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Multilingual assignment", config: {} });
    const original = await PDFDocument.create(); original.addPage().drawText("Original assignment artwork"); const originalBytes = await original.save();
    await responseJson(await teacherApi.post(`${course}/activities/${id}/coding-homework-grader/assignment-pdf`, { data: { fileName: "assignment.pdf", mimeType: "application/pdf", base64: Buffer.from(originalBytes).toString("base64") } }));
    await responseJson(await teacherApi.post(`${course}/groups/${data.groupId}/activities`, { data: { activityId: id, metadata: { assessmentMode: "summative" } } }));
    await responseJson(await teacherApi.patch(course, { data: { studentCourseExportEnabled: true, studentCourseExportConfidential: true } }));
    for (const [language, title, copyright] of [["zh", "使用权", "版权所有者"], ["ar", "حقوق الاستخدام", "حقوق النشر"]] as const) {
      await responseJson(await teacherApi.patch(`/api/subjects/${data.subjectId}`, { data: { teachingLanguage: language } }));
      const response = await student.post(`${course}/student-export`, { data: { locale: "en" }, timeout: 120_000 }); expect(response.ok()).toBe(true);
      const archive = unzipSync(await response.body()); expect(Object.keys(archive)[0]).toMatch(new RegExp(`000-${title}.pdf$`));
      const directory = testInfo.outputPath(language); await mkdir(directory, { recursive: true });
      for (const [index, [name, bytes]] of Object.entries(archive).entries()) {
        if (!name.endsWith(".pdf")) continue;
        if (/(?:^|\/)\d+-assignment\.pdf$/.test(name)) { expect(Buffer.from(bytes)).toEqual(Buffer.from(originalBytes)); continue; }
        const file = `${directory}/${index}.pdf`; await writeFile(file, bytes);
        const pages = (await PDFDocument.load(bytes)).getPageCount();
        for (let page = 1; page <= pages; page++) {
          const text = execFileSync("pdftotext", ["-f", String(page), "-l", String(page), "-raw", file, "-"], { encoding: "utf8" }).normalize("NFKC").replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "");
          for (const word of copyright.split(" ")) expect(text).toContain(word); expect(text).toContain("李明"); expect(text).toContain("Élève");
          expect(text.replace(/\s/g, "")).toContain("Confidential");
        }
      }
    }
    expect(await prisma.activityAttempt.count({ where: { courseId: data.courseId } })).toBe(0);
  } finally { await responseJson(await admin.put("/api/settings/course-exports", { data: originalPolicy })); await student?.dispose(); await admin.dispose(); if (userId) await prisma.user.delete({ where: { id: userId } }); }
});
