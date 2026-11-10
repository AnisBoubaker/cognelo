import { createHash } from "node:crypto";
import { prisma } from "@cognelo/db";
import type { APIRequestContext, Page } from "@playwright/test";
import type { StudentGroupingDto } from "@cognelo/contracts";
import type { CourseActivityAssignmentSettings, CourseTestItem, CourseTestRuntime } from "../../apps/web/src/lib/api";
import { buildSafeExamBrowserConfiguration } from "../../apps/api/src/lib/safe-exam-browser";
import { test, expect, ORIGINAL_SOURCE } from "./fixtures/bank-course";
import { assignCourseTest, responseJson, type ActivitySuiteData } from "./fixtures/activity-suite";
import { createAuthenticatedApi, credentialsFor } from "./fixtures/auth";

const minute = 60_000;
const cSource = '#include <stdio.h>\nint main(void) { printf("42\\n"); return 0; }\n';

async function exam(data: ActivitySuiteData, teacher: APIRequestContext, options: { elapsed?: number; windowMinutes?: number; openEnded?: boolean; coding?: boolean } = {}) {
  const now = Date.now(), elapsed = options.elapsed ?? 5;
  const title = `Buffered three-hour exam ${data.token}`;
  const { test: created } = await responseJson<{ test: { activity: { id: string } } }>(await teacher.post(`/api/courses/${data.courseId}/tests`, { data: {
    title, lifecycle: "published", settings: { timeLimitMinutes: 180, navigationMode: "free", randomizeItems: false, allowResume: true }, contentPlacement: { isVisible: true }
  } }));
  const id = created.activity.id, base = `/api/courses/${data.courseId}/activities/${id}`;
  const items: CourseTestItem[] = [];
  for (let index = 0; index < (options.coding ? 6 : 1); index++) {
    const { item } = await responseJson<{ item: CourseTestItem }>(await teacher.post(`${base}/test/items`, { data: {
      source: "local", activityTypeKey: options.coding ? "coding-exercise" : "mcq", title: options.coding ? `C question ${index + 1}` : "Exam question",
      config: options.coding ? { language: "c", prompt: "Print the number 42.", starterCode: "", sampleTests: [] } : { source: ORIGINAL_SOURCE, randomizeChoices: false }, pointsPossible: 10
    } }));
    items.push(item);
    if (options.coding) await responseJson(await teacher.put(`/api/courses/${data.courseId}/activities/${item.activityId}/coding-exercises/hidden-tests`, { data: {
      tests: [], referenceSolution: cSource, privateConfig: { templateSource: "{{ STUDENT_CODE }}" }
    } }));
  }
  await assignCourseTest(data, id, title);
  const { settings } = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await teacher.get(`${base}/assign-all-groups`));
  settings.general.availableFrom = new Date(now - elapsed * minute).toISOString();
  settings.general.availableUntil = options.openEnded ? null : new Date(now + ((options.windowMinutes ?? 195) - elapsed) * minute).toISOString();
  settings.general.timeLimitMinutes = 180;
  const section = settings.groups.find(group => group.groupId === data.groupId)!;
  section.overrideFields = [];
  const student = section.students.find(person => person.email === credentialsFor("student").email)!;
  // Keep asynchronous response parsing explicit; no fixture writes touch the imported course.
  const persist = async () => responseJson(await teacher.post(`${base}/assign-all-groups`, { data: { ...settings.general, groupAssignments: settings.groups, confirmActiveStudents: true } }));
  await persist();
  const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${id}`;
  const runtime = async (api: APIRequestContext) => (await responseJson<{ runtime: CourseTestRuntime }>(await api.get(`${assigned}/test`))).runtime;
  return { id, title, base, items, assigned, settings, section, student, save: persist, runtime };
}

async function start(page: Page, assigned: string) {
  await page.goto(assigned.replace(/^\/api/, ""));
  await page.getByRole("button", { name: "Start Test", exact: true }).click();
  await page.getByRole("dialog", { name: "Start this Test now?" }).getByRole("button", { name: "Start Test", exact: true }).click();
  await expect(page.getByRole("timer")).toBeVisible();
}

async function timerMatches(page: Page, deadline: string) {
  await expect.poll(async () => {
    const match = (await page.getByRole("timer").innerText()).match(/(\d{2}):(\d{2}):(\d{2})/);
    if (!match) return Infinity;
    const displayed = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
    return Math.abs(displayed - Math.max(0, Math.ceil((Date.parse(deadline) - Date.now()) / 1000)));
  }).toBeLessThanOrEqual(4);
}

const cases = [
  { name: "180 minutes inside a 195-minute window", minutes: 180, elapsed: 0, extend: 0, durationWins: true },
  { name: "180 minutes inside a 190-minute window", minutes: 180, elapsed: 0, windowMinutes: 190, extend: 0, durationWins: true },
  { name: "a five-minute late start still receives the full 180 minutes", minutes: 180, elapsed: 5, extend: 0, durationWins: true },
  { name: "late start is capped by closing time", minutes: 180, elapsed: 20, extend: 0, durationWins: false },
  { name: "late start is capped by a 190-minute window", minutes: 180, elapsed: 20, windowMinutes: 190, extend: 0, durationWins: false },
  { name: "180 minutes with no closing date", minutes: 180, elapsed: 5, openEnded: true, extend: 0, durationWins: true },
  { name: "240-minute accommodation with an extended closing date", minutes: 240, elapsed: 5, extend: 60, durationWins: true },
  { name: "270-minute accommodation with an extended closing date", minutes: 270, elapsed: 5, extend: 90, durationWins: true },
  { name: "extra minutes alone cannot pass the unchanged closing date", minutes: 240, elapsed: 5, extend: 0, durationWins: false }
];
for (const scenario of cases) test(`exam window: ${scenario.name}`, { tag: "@regression" }, async ({ bankCourse: data, teacherApi, teacherPage: author, studentPage: page }) => {
  const student = await createAuthenticatedApi("student");
  try {
    const ex = await exam(data, teacherApi, scenario);
    if (scenario.minutes !== 180) {
      const { grouping } = await responseJson<{ grouping: StudentGroupingDto }>(await teacherApi.post(`/api/courses/${data.courseId}/groups/${data.groupId}/groupings`, { data: {
        title: "Exam accommodations", visibleToStudents: false, teams: [{ title: "Extended time", participantIds: [ex.student.id] }]
      } }));
      ex.section.exceptions = [{ ...ex.settings.general, teamId: grouping.teams[0].id, participantId: null, overrideFields: ["timeLimit", "availableUntil"],
        timeLimitMinutes: scenario.minutes, availableUntil: new Date(Date.parse(ex.settings.general.availableUntil!) + scenario.extend * minute).toISOString() }];
      await ex.save();
    } else {
      await author.goto(`/courses/${data.courseId}/gradebook/activities/${ex.id}?settings=1`);
      const dialog = author.getByRole("dialog", { name: ex.title, exact: true });
      await expect(dialog.getByLabel("Time limit (minutes)", { exact: true })).toHaveValue("180");
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    }
    await start(page, ex.assigned);
    const initial = await ex.runtime(student);
    expect(initial.timing.timeLimitMinutes).toBe(scenario.minutes);
    const until = ex.section.exceptions[0]?.availableUntil ?? ex.settings.general.availableUntil;
    const expected = scenario.durationWins ? new Date(Date.parse(initial.attempt!.startedAt) + scenario.minutes * minute).toISOString() : until!;
    expect(initial.timing.expiresAt).toBe(expected);
    await timerMatches(page, expected);
    await page.getByLabel("Four", { exact: true }).check();
    const saved = () => prisma.testItemAttempt.findFirst({ where: { parentAttemptId: initial.attempt!.id } });
    await expect.poll(async () => JSON.stringify((await saved())?.result)).toContain("question-1-choice-1");
    await page.reload();
    await expect(page.getByLabel("Four", { exact: true })).toBeChecked();
    expect((await ex.runtime(student)).attempt).toMatchObject({ id: initial.attempt!.id, startedAt: initial.attempt!.startedAt });
    await timerMatches(page, expected);
  } finally { await student.dispose(); }
});

test("exam dates deny an early start, open without expiring, and deny a new start after closing", async ({ bankCourse: data, teacherApi, studentPage: page }) => {
  const student = await createAuthenticatedApi("student");
  try {
    const ex = await exam(data, teacherApi);
    ex.settings.general.availableFrom = new Date(Date.now() + minute).toISOString(); await ex.save();
    expect((await student.post(`${ex.assigned}/test`, { data: { sessionId: "early" } })).status()).toBe(403);
    expect(await prisma.activityAttempt.count({ where: { activityId: ex.id } })).toBe(0);
    ex.settings.general.availableFrom = new Date(Date.now() - 1000).toISOString(); await ex.save();
    await page.goto(ex.assigned.replace(/^\/api/, ""));
    await expect(page.getByRole("button", { name: "Start Test", exact: true })).toBeEnabled();
    expect((await ex.runtime(student)).availability.canStart).toBe(true);
    ex.settings.general.availableFrom = new Date(Date.now() - minute).toISOString();
    ex.settings.general.availableUntil = new Date(Date.now() - 1000).toISOString(); await ex.save();
    const closed = await student.post(`${ex.assigned}/test`, { data: { sessionId: "late" } });
    expect(closed.status()).toBe(400);
    expect(await closed.json()).toMatchObject({ error: { code: "ATTEMPT_DUE_DATE_PASSED" } });
    expect(await prisma.activityAttempt.count({ where: { activityId: ex.id } })).toBe(0);
  } finally { await student.dispose(); }
});

test("individual exam accommodations outrank team rules and remain live from the original start", async ({ bankCourse: data, teacherApi, studentPage: page }) => {
  const student = await createAuthenticatedApi("student");
  try {
    const ex = await exam(data, teacherApi), teamIds: string[] = [];
    for (const number of [1, 2]) {
      const { grouping } = await responseJson<{ grouping: StudentGroupingDto }>(await teacherApi.post(`/api/courses/${data.courseId}/groups/${data.groupId}/groupings`, { data: {
        title: `Accommodation priority ${number}`, teams: [{ title: "Exam group", participantIds: [ex.student.id] }]
      } })); teamIds.push(grouping.teams[0].id);
    }
    ex.section.exceptions = teamIds.map((teamId, index): CourseActivityAssignmentSettings["groups"][number]["exceptions"][number] => ({ ...ex.settings.general, teamId, participantId: null, overrideFields: ["timeLimit", "availableUntil"],
      timeLimitMinutes: index ? 240 : 270, availableUntil: new Date(Date.now() + 300 * minute).toISOString() }));
    ex.section.exceptions.push({ ...ex.settings.general, teamId: null, participantId: ex.student.id, overrideFields: ["timeLimit", "availableUntil"], timeLimitMinutes: 210, availableUntil: new Date(Date.now() + 220 * minute).toISOString() });
    await ex.save(); await start(page, ex.assigned);
    const initial = await ex.runtime(student), began = Date.parse(initial.attempt!.startedAt);
    expect(initial.timing.expiresAt).toBe(new Date(began + 210 * minute).toISOString());
    ex.section.exceptions.pop(); await ex.save();
    expect((await ex.runtime(student)).timing.expiresAt).toBe(new Date(began + 270 * minute).toISOString());
    ex.section.exceptions.reverse(); await ex.save();
    expect((await ex.runtime(student)).timing.expiresAt).toBe(new Date(began + 240 * minute).toISOString());
    await page.evaluate(() => window.dispatchEvent(new Event("focus"))); await timerMatches(page, new Date(began + 240 * minute).toISOString());
    expect((await ex.runtime(student)).attempt!.startedAt).toBe(initial.attempt!.startedAt);
  } finally { await student.dispose(); }
});

test("exam inclusion exceptions permit selected students while an individual exclusion blocks access", async ({ bankCourse: data, teacherApi, studentPage: page }) => {
  const student = await createAuthenticatedApi("student");
  try {
    const ex = await exam(data, teacherApi);
    ex.settings.general.contentPlacement = { ...ex.settings.general.contentPlacement, isVisible: false }; await ex.save();
    expect((await student.get(`${ex.assigned}/test`)).status()).toBe(403);
    ex.section.exceptions = [{ ...ex.settings.general, participantId: ex.student.id, teamId: null, overrideFields: ["visibility"], contentPlacement: { isVisible: true, metadata: {} } }];
    await ex.save(); await start(page, ex.assigned);
    const initial = await ex.runtime(student);
    await page.getByLabel("Four", { exact: true }).check();
    await expect.poll(async () => JSON.stringify((await prisma.testItemAttempt.findFirst({ where: { parentAttemptId: initial.attempt!.id } }))?.result)).toContain("question-1-choice-1");
    ex.section.exceptions[0].contentPlacement.isVisible = false; await ex.save();
    expect((await student.get(`${ex.assigned}/test`)).status()).toBe(403);
    expect((await student.put(`${ex.assigned}/test/items/${ex.items[0].id}`, { data: { parentAttemptId: initial.attempt!.id, sessionId: "excluded", state: { answers: {} } } })).ok()).toBe(false);
    expect(await prisma.activityAttempt.count({ where: { activityId: ex.id } })).toBe(1);
  } finally { await student.dispose(); }
});

for (const expiry of ["duration", "closing date"] as const) test(`six-question C exam preserves answers, resumes and auto-submits at its ${expiry}`, async ({ bankCourse: data, teacherApi, studentPage: page }) => {
  test.setTimeout(120_000);
  const student = await createAuthenticatedApi("student");
  try {
    const ex = await exam(data, teacherApi, { coding: true });
    ex.settings.general.requireSafeExamBrowser = true; await ex.save();
    await page.goto(ex.assigned.replace(/^\/api/, ""));
    await expect(page.getByRole("dialog", { name: "Open this activity in Safe Exam Browser?" })).toBeVisible();
    expect(await prisma.activityAttempt.count({ where: { activityId: ex.id } })).toBe(0);
    expect((await student.post(`${ex.assigned}/test`, { data: { sessionId: "outside-seb" } })).status()).toBe(403);
    const { launch } = await responseJson<{ launch: { downloadUrl: string } }>(await student.post(`${ex.assigned}/seb`, { data: {} }));
    const token = new URL(launch.downloadUrl).searchParams.get("token")!;
    const config = buildSafeExamBrowserConfiguration({ courseId: data.courseId, groupId: data.groupId, activityId: ex.id }, token);
    const proof = createHash("sha256").update(`${config.startUrl}${config.configKey}`).digest("hex");
    await responseJson(await student.post(`${ex.assigned}/seb/activate`, { data: { token, configKeyHash: proof } }));
    const cookies = (await student.storageState()).cookies;
    for (const name of ["cognelo_session", "cognelo_seb_access"]) {
      const cookie = cookies.find(cookie => cookie.name === name)!;
      expect(cookie).toBeDefined();
      // Both the browser cookie and server token must cover the longest accommodation.
      expect(cookie.expires - Date.now() / 1000).toBeGreaterThan(270 * 60);
      const claims = JSON.parse(Buffer.from(cookie.value.split(".")[1], "base64url").toString()) as { exp: number; iat: number };
      expect(claims.exp - claims.iat).toBeGreaterThan(270 * 60);
    }
    await page.context().addCookies(cookies);
    await page.addInitScript(value => { (window as unknown as { SafeExamBrowser: unknown }).SafeExamBrowser = { version: "e2e", security: { configKey: value } }; }, proof);
    await start(page, config.startUrl);
    await expect(page.getByRole("dialog", { name: "Open this activity in Safe Exam Browser?" })).toBeHidden();
    const initial = await ex.runtime(student);
    expect(initial.timing.timeLimitMinutes).toBe(180); await timerMatches(page, initial.timing.expiresAt!);
    const savedSource = async (index: number) => ((await prisma.testItemAttempt.findUnique({ where: { parentAttemptId_testItemId: { parentAttemptId: initial.attempt!.id, testItemId: ex.items[index].id } } }))?.result as { state?: { sourceCode?: string } } | null)?.state?.sourceCode;
    for (const index of [0, 1]) {
      const code = page.getByRole("textbox", { name: `C question ${index + 1}`, exact: true }); await expect(code).toBeEditable();
      await code.focus(); await page.keyboard.press("ControlOrMeta+A"); await page.keyboard.insertText(cSource);
      await expect.poll(async () => (await savedSource(index))?.replace(/\r\n?/g, "\n")).toBe(cSource);
      if (index === 0) {
        await page.getByRole("button", { name: "Run test", exact: true }).click();
        await expect(page.getByLabel("Test output", { exact: true })).toContainText("42", { timeout: 60_000 });
        await page.getByRole("button", { name: "Next activity", exact: true }).click();
      }
    }
    await page.reload();
    expect((await ex.runtime(student)).attempt!.id).toBe(initial.attempt!.id);
    await page.getByRole("button", { name: "1", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "C question 1", exact: true })).toBeEditable();
    await expect.poll(async () => (await savedSource(0))?.replace(/\r\n?/g, "\n")).toBe(cSource);
    await expect(page.locator(".coding-exercise-editor-pane .view-lines")).toContainText("printf");
    const savedBeforeExpiry = await Promise.all([savedSource(0), savedSource(1)]);
    if (expiry === "duration") await prisma.activityAttempt.update({ where: { id: initial.attempt!.id }, data: { startedAt: new Date(Date.now() - 180 * minute - 2000) } });
    else { ex.settings.general.availableUntil = new Date(Date.now() - 1000).toISOString(); await ex.save(); }
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect.poll(async () => (await prisma.activityAttempt.findUniqueOrThrow({ where: { id: initial.attempt!.id } })).lifecycle, { timeout: 30_000 }).toBe("submitted");
    await expect(page).toHaveURL(new RegExp(`/courses/${data.courseId}/groups/${data.groupId}$`));
    const attempt = await prisma.activityAttempt.findUniqueOrThrow({ where: { id: initial.attempt!.id }, include: { testItemAttempts: true } });
    expect(attempt.testItemAttempts).toHaveLength(6);
    expect(attempt.testItemAttempts.every(item => item.lifecycle === "submitted")).toBe(true);
    for (const item of attempt.testItemAttempts.filter(item => ex.items.slice(2).some(question => question.id === item.testItemId))) {
      expect(((item.result as { state?: { sourceCode?: string } })?.state?.sourceCode ?? "").trim()).toBe("");
    }
    expect(await savedSource(0)).toBe(savedBeforeExpiry[0]); expect(await savedSource(1)).toBe(savedBeforeExpiry[1]);
    expect(attempt.metadata).toMatchObject({ submittedTimeLimitMinutes: 180 });
    const deadline = expiry === "duration" ? attempt.startedAt.getTime() + 180 * minute : Date.parse(ex.settings.general.availableUntil!);
    expect(attempt.submittedAt!.getTime()).toBeGreaterThanOrEqual(deadline);
    // Completed autosaves acknowledge the existing snapshot, allowing an in-flight save to drain.
    const late = await responseJson(await student.put(`${ex.assigned}/test/items/${ex.items[0].id}`, { data: { parentAttemptId: attempt.id, sessionId: "late-write", state: { sourceCode: "SHOULD NOT SAVE" } } }));
    expect(JSON.stringify(late)).not.toContain("SHOULD NOT SAVE");
    expect(await prisma.testItemAttempt.findUniqueOrThrow({ where: { parentAttemptId_testItemId: { parentAttemptId: attempt.id, testItemId: ex.items[0].id } } })).toEqual(attempt.testItemAttempts.find(item => item.testItemId === ex.items[0].id));
    expect(await savedSource(0)).toBe(savedBeforeExpiry[0]);
  } finally { await student.dispose(); }
});
