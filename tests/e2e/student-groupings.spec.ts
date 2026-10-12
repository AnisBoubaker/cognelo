import type { StudentGroupingDto, StudentGroupingStudent } from "@cognelo/contracts";
import { prisma } from "@cognelo/db";
import { test as base, expect, createAuthenticatedApi, confirmSharedDialog } from "./fixtures/auth";
import { provisionActivitySuite, removeActivitySuite, responseJson, setSeedStudentParticipantRole, type ActivitySuiteData } from "./fixtures/activity-suite";

type Scenario = ActivitySuiteData & { otherSectionId: string; students: StudentGroupingStudent[]; outsiderId: string };
const test = base.extend<{ groupingsData: Scenario }>({
  groupingsData: async ({}, provide) => {
    const data = await provisionActivitySuite();
    const api = await createAuthenticatedApi("teacher");
    try {
      const { group } = await responseJson<{ group: { id: string } }>(await api.post(`/api/courses/${data.courseId}/groups`, { data: { title: "Other section" } }));
      await responseJson(await api.post(`/api/courses/${data.courseId}/groups/${data.groupId}/participants`, {
        data: { email: `groupings-${data.token}@example.test`, firstName: "Pending", lastName: "Student", role: "student" }
      }));
      const { participant } = await responseJson<{ participant: { id: string } }>(await api.post(`/api/courses/${data.courseId}/groups/${group.id}/participants`, {
        data: { email: `outside-${data.token}@example.test`, firstName: "Outside", lastName: "Student", role: "student" }
      }));
      const { students } = await responseJson<{ students: StudentGroupingStudent[] }>(await api.get(`/api/courses/${data.courseId}/groups/${data.groupId}/groupings`));
      await provide({ ...data, otherSectionId: group.id, outsiderId: participant.id, students });
    } finally {
      await api.dispose();
      await removeActivitySuite(data);
    }
  }
});
const pathFor = (data: Scenario, sectionId = data.groupId) => `/api/courses/${data.courseId}/groups/${sectionId}/groupings`;
const studentLabel = (student: StudentGroupingStudent) => new RegExp(student.email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

test.describe("section groupings and teams", { tag: "@regression" }, () => {
  test("creates independent groupings, edits teams, persists assignments, and removes without unenrolling", async ({ teacherPage: page, groupingsData: data }) => {
    const api = await createAuthenticatedApi("teacher");
    const [first, second] = data.students;
    try {
      await page.goto(`/courses/${data.courseId}?tab=groupings`);
      await page.getByLabel("Section", { exact: true }).selectOption(data.groupId);
      await page.getByRole("button", { name: "Create grouping", exact: true }).click();
      await page.getByLabel("Grouping name").fill("Project teams");
      await page.getByLabel("Description (optional)").fill("Semester project");
      await page.getByRole("button", { name: "Add team", exact: true }).click();
      await expect(page.getByLabel("Team 1 name")).toHaveValue("Team 1");
      await page.getByLabel("Team 1 name").fill("Blue");
      await page.getByRole("button", { name: "Add team", exact: true }).click();
      await expect(page.getByLabel("Team 2 name")).toHaveValue("Team 2");
      await page.getByLabel("Team 2 name").fill("Green");
      await page.getByLabel(studentLabel(first!)).selectOption({ label: "Blue" });
      await page.getByLabel("Search students").fill(second!.email);
      await expect(page.getByLabel(studentLabel(first!))).toBeHidden();
      await page.getByLabel(studentLabel(second!)).selectOption({ label: "Green" });
      await page.getByRole("button", { name: "Create grouping", exact: true }).click();
      await expect(page.getByText("Everything is saved.", { exact: true })).toBeVisible();
      const original = (await responseJson<{ groupings: StudentGroupingDto[] }>(await api.get(pathFor(data)))).groupings[0]!;
      await page.getByRole("button", { name: "Close", exact: true }).click();
      await page.getByRole("button", { name: "Create grouping", exact: true }).click();
      await page.getByLabel("Grouping name").fill("Lab teams");
      await page.getByRole("button", { name: "Add team", exact: true }).click();
      await page.getByLabel("Team 1 name").fill("Lab partners");
      await page.getByLabel(studentLabel(first!)).selectOption({ label: "Lab partners" });
      await page.getByLabel(studentLabel(second!)).selectOption({ label: "Lab partners" });
      await page.getByRole("button", { name: "Create grouping", exact: true }).click();
      await expect(page.getByText("Everything is saved.", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Close", exact: true }).click();
      await page.reload();
      await page.getByLabel("Section", { exact: true }).selectOption(data.groupId);
      const projects = page.getByRole("article", { name: "Project teams", exact: true });
      await expect(projects.getByRole("heading", { name: "Blue (1)" })).toBeVisible();
      await projects.getByRole("button", { name: "Edit", exact: true }).click();
      await page.getByLabel("Team 1 name").fill("Red");
      await page.getByLabel(studentLabel(first!)).selectOption({ label: "Green" });
      await page.getByRole("button", { name: "Save grouping", exact: true }).click();
      await expect(page.getByText("Everything is saved.", { exact: true })).toBeVisible();
      const updated = (await responseJson<{ groupings: StudentGroupingDto[] }>(await api.get(pathFor(data)))).groupings.find((grouping) => grouping.id === original.id)!;
      expect(updated.teams.find((team) => team.title === "Red")?.id).toBe(original.teams.find((team) => team.title === "Blue")?.id);
      expect(updated.teams.find((team) => team.title === "Green")?.participantIds).toHaveLength(2);
      await page.getByRole("button", { name: "Remove team 1", exact: true }).click();
      await page.getByRole("button", { name: "Save grouping", exact: true }).click();
      await expect(page.getByText("Everything is saved.", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Close", exact: true }).click();
      await projects.getByRole("button", { name: "Remove", exact: true }).click();
      await confirmSharedDialog(page, "Remove");
      await expect(projects).toBeHidden();
      await expect(page.getByRole("article", { name: "Lab teams" })).toBeVisible();
      const remaining = await responseJson<{ groupings: StudentGroupingDto[]; students: StudentGroupingStudent[] }>(await api.get(pathFor(data)));
      expect(remaining.groupings).toHaveLength(1);
      expect(remaining.groupings[0]?.teams[0]?.participantIds).toHaveLength(2);
      expect(remaining.students).toHaveLength(2);
      await page.getByLabel("Section", { exact: true }).selectOption(data.otherSectionId);
      await expect(page.getByRole("article", { name: "Lab teams" })).toBeHidden();
    } finally { await api.dispose(); }
  });

  test("uses the course teaching language for editable team names and avoids collisions after removal", async ({ teacherPage: page, groupingsData: data }) => {
    const api = await createAuthenticatedApi("teacher");
    try {
      await responseJson(await api.patch(`/api/subjects/${data.subjectId}`, { data: { teachingLanguage: "fr" } }));
      // The teacher's interface stays English while the course is taught in French.
      await page.goto(`/courses/${data.courseId}?tab=groupings`);
      await page.getByLabel("Section", { exact: true }).selectOption(data.groupId);
      await page.getByRole("button", { name: "Create grouping", exact: true }).click();
      await page.getByLabel("Grouping name").fill("Travail en équipe");
      await page.getByRole("button", { name: "Add team", exact: true }).click();
      await expect(page.getByLabel("Team 1 name")).toHaveValue("Équipe 1");
      await page.getByRole("button", { name: "Add team", exact: true }).click();
      await expect(page.getByLabel("Team 2 name")).toHaveValue("Équipe 2");
      await page.getByRole("button", { name: "Remove team 1", exact: true }).click();
      await page.getByRole("button", { name: "Add team", exact: true }).click();
      await expect(page.getByLabel("Team 1 name")).toHaveValue("Équipe 2");
      await expect(page.getByLabel("Team 2 name")).toHaveValue("Équipe 3");
      await page.getByLabel("Team 1 name").fill("Les explorateurs");
      await page.getByRole("button", { name: "Create grouping", exact: true }).click();
      await expect(page.getByText("Everything is saved.", { exact: true })).toBeVisible();
      await page.reload();
      await page.getByLabel("Section", { exact: true }).selectOption(data.groupId);
      const grouping = page.getByRole("article", { name: "Travail en équipe", exact: true });
      await expect(grouping.getByRole("heading", { name: "Les explorateurs (0)" })).toBeVisible();
      await expect(grouping.getByRole("heading", { name: "Équipe 3 (0)" })).toBeVisible();
    } finally { await api.dispose(); }
  });

  test("randomly balances the whole section, supports cancel, and saves only when requested", async ({ teacherPage: page, groupingsData: data }) => {
    const api = await createAuthenticatedApi("teacher");
    try {
      for (let index = 0; index < 3; index++) {
        await responseJson(await api.post(`/api/courses/${data.courseId}/groups/${data.groupId}/participants`, {
          data: { email: `random-${index}-${data.token}@example.test`, firstName: "Random", lastName: `Student ${index}`, role: "student" }
        }));
      }
      const { students } = await responseJson<{ students: StudentGroupingStudent[] }>(await api.get(pathFor(data)));
      const { grouping } = await responseJson<{ grouping: StudentGroupingDto }>(await api.post(pathFor(data), {
        data: { title: "Random teams", teams: [{ title: "Blue", participantIds: students.map((student) => student.id) }, { title: "Green", participantIds: [] }] }
      }));
      const { grouping: other } = await responseJson<{ grouping: StudentGroupingDto }>(await api.post(pathFor(data), {
        data: { title: "Independent grouping", teams: [{ title: "Partners", participantIds: [students[0]!.id] }] }
      }));
      await page.goto(`/courses/${data.courseId}?tab=groupings`);
      await page.getByLabel("Section", { exact: true }).selectOption(data.groupId);
      await page.getByRole("button", { name: "Create grouping", exact: true }).click();
      const randomize = page.getByRole("button", { name: "Randomly assign", exact: true });
      await expect(randomize).toBeDisabled();
      await page.getByRole("button", { name: "Close", exact: true }).click();
      await page.getByRole("article", { name: "Random teams", exact: true }).getByRole("button", { name: "Edit", exact: true }).click();
      await page.getByLabel("Search students").fill(students[0]!.email);
      await page.getByLabel("Show unassigned students only").check();
      await randomize.click();
      await expect(page.getByLabel("Search students")).toHaveValue("");
      await expect(page.getByLabel("Show unassigned students only")).not.toBeChecked();
      await expect(page.getByText("Students: 3", { exact: true })).toBeVisible();
      await expect(page.getByText("Students: 2", { exact: true })).toBeVisible();
      for (const student of students) await expect(page.getByLabel(studentLabel(student))).not.toHaveValue("");
      // Randomization changes the draft, not the stored grouping.
      let stored = (await responseJson<{ groupings: StudentGroupingDto[] }>(await api.get(pathFor(data)))).groupings;
      expect(stored.find((item) => item.id === grouping.id)).toEqual(grouping);
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(page.getByText("Students: 5", { exact: true })).toBeVisible();
      for (const student of students) await expect(page.getByLabel(studentLabel(student))).toHaveValue(grouping.teams.find((team) => team.title === "Blue")!.id);
      await randomize.click();
      await page.getByRole("button", { name: "Save grouping", exact: true }).click();
      await expect(page.getByText("Everything is saved.", { exact: true })).toBeVisible();
      await page.reload();
      await page.getByLabel("Section", { exact: true }).selectOption(data.groupId);
      await expect(page.getByRole("article", { name: "Random teams", exact: true }).getByText("Unassigned students: 0", { exact: true })).toBeVisible();
      stored = (await responseJson<{ groupings: StudentGroupingDto[] }>(await api.get(pathFor(data)))).groupings;
      const saved = stored.find((item) => item.id === grouping.id)!;
      expect(saved.teams.map((team) => team.participantIds.length).sort()).toEqual([2, 3]);
      expect(saved.teams.flatMap((team) => team.participantIds).sort()).toEqual(students.map((student) => student.id).sort());
      expect(saved.teams.map((team) => ({ id: team.id, title: team.title }))).toEqual(grouping.teams.map((team) => ({ id: team.id, title: team.title })));
      expect(stored.find((item) => item.id === other.id)).toEqual(other);
    } finally { await api.dispose(); }
  });

  test("rejects cross-section members, duplicate assignments, foreign team IDs, and concurrent writes atomically", async ({ groupingsData: data }) => {
    const api = await createAuthenticatedApi("teacher");
    const path = pathFor(data);
    const studentId = data.students[0]!.id;
    const input = { title: "Projects", teams: [{ title: "A", participantIds: [studentId] }, { title: "B", participantIds: [] }] };
    try {
      for (const participantIds of [[data.outsiderId], [studentId, studentId]]) {
        expect((await api.post(path, { data: { ...input, teams: [{ title: "A", participantIds }] } })).status()).toBe(400);
      }
      expect((await api.post(path, { data: { title: "Duplicate members", teams: [{ title: "A", participantIds: [studentId] }, { title: "B", participantIds: [studentId] }] } })).status()).toBe(400);
      const { grouping } = await responseJson<{ grouping: StudentGroupingDto }>(await api.post(path, { data: input }));
      expect((await api.post(path, { data: input })).status()).toBe(409);
      // The same name is valid in a different section.
      const { grouping: other } = await responseJson<{ grouping: StudentGroupingDto }>(await api.post(pathFor(data, data.otherSectionId), { data: { title: input.title, teams: [{ title: "Other", participantIds: [data.outsiderId] }] } }));
      expect((await api.patch(`${path}/${grouping.id}`, { data: { ...grouping, teams: other.teams } })).status()).toBe(400);
      expect((await api.patch(`${path}/${other.id}`, { data: grouping })).status()).toBe(404);
      expect((await api.delete(`${path}/${other.id}`, { data: { revision: 1 } })).status()).toBe(404);
      // A single successful save wins; the competing editor must reload.
      const writes = await Promise.all(["First edit", "Second edit"].map((description) => api.patch(`${path}/${grouping.id}`, { data: { ...grouping, description } })));
      expect(writes.map((response) => response.status()).sort()).toEqual([200, 409]);
      expect((await api.delete(`${path}/${grouping.id}`, { data: { revision: 1 } })).status()).toBe(409);
      let current = (await responseJson<{ groupings: StudentGroupingDto[] }>(await api.get(path))).groupings[0]!;
      expect(current.revision).toBe(2);
      expect(current.teams[0]?.participantIds).toEqual([studentId]);
      // Swapping names must retain the identity of both teams.
      const ids = current.teams.map((team) => team.id);
      current = (await responseJson<{ grouping: StudentGroupingDto }>(await api.patch(`${path}/${grouping.id}`, { data: { ...current, teams: current.teams.map((team) => ({ ...team, title: team.title === "A" ? "B" : "A" })) } }))).grouping;
      expect(current.teams.map((team) => team.id).sort()).toEqual(ids.sort());
      expect(current.teams.find((team) => team.title === "B")?.participantIds).toEqual([studentId]);
      const audits = await prisma.courseAuditEvent.findMany({ where: { courseId: data.courseId, targetId: grouping.id } });
      expect(audits.map((audit) => audit.eventType).sort()).toEqual(["student_grouping_created", "student_grouping_updated", "student_grouping_updated"]);
    } finally { await api.dispose(); }
  });

  test("preserves failed drafts, guards navigation, and reloads stale edits on a narrow screen", async ({ teacherPage: page, groupingsData: data }) => {
    const api = await createAuthenticatedApi("teacher");
    const path = pathFor(data);
    try {
      const { grouping } = await responseJson<{ grouping: StudentGroupingDto }>(await api.post(path, { data: { title: "Projects", teams: [{ title: "Team A", participantIds: [data.students[0]!.id] }] } }));
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/courses/${data.courseId}?tab=groupings`);
      await page.getByLabel("Section", { exact: true }).selectOption(data.groupId);
      await page.getByRole("article", { name: "Projects" }).getByRole("button", { name: "Edit", exact: true }).click();
      await page.getByLabel("Grouping name").fill("My draft");
      await page.route(`**${path}/${grouping.id}`, (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "TEMPORARY_FAILURE", message: "Temporary test failure" } }) }), { times: 1 });
      await page.getByRole("button", { name: "Save grouping", exact: true }).click();
      await expect(page.getByRole("tabpanel", { name: "Groupings", exact: true }).getByRole("alert")).toContainText("Unable to load or save groupings");
      await expect(page.getByLabel("Grouping name")).toHaveValue("My draft");
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(page.getByLabel("Grouping name")).toHaveValue("Projects");
      await page.getByLabel("Grouping name").fill("Unsaved project");
      await page.getByRole("tab", { name: "Participants", exact: true }).click();
      const guard = page.getByRole("dialog");
      await expect(guard).toBeVisible();
      await guard.getByRole("button", { name: /continue editing/i }).click();
      await expect(page.getByLabel("Grouping name")).toHaveValue("Unsaved project");
      await responseJson(await api.patch(`${path}/${grouping.id}`, { data: { ...grouping, title: "Colleague's change" } }));
      await page.getByRole("button", { name: "Save grouping", exact: true }).click();
      await expect(page.getByRole("tabpanel", { name: "Groupings", exact: true }).getByRole("alert")).toContainText("changed since you opened it");
      await expect(page.getByLabel("Grouping name")).toHaveValue("Unsaved project");
      await page.getByRole("button", { name: "Reload groupings", exact: true }).click();
      await confirmSharedDialog(page, "Discard changes");
      await expect(page.getByLabel("Grouping name")).toHaveValue("Colleague's change");
      await expect(page.getByText("Everything is saved.", { exact: true })).toBeVisible();
      await page.screenshot({ path: test.info().outputPath("grouping-editor-mobile.png"), fullPage: true });
      const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      expect(horizontalOverflow).toBe(false);
    } finally { await api.dispose(); }
  });

  test("permits section teachers only in their section and denies students and TAs", async ({ studentPage: page, groupingsData: data }) => {
    const teacher = await createAuthenticatedApi("teacher");
    const restricted = await createAuthenticatedApi("student");
    const path = pathFor(data);
    try {
      const { grouping } = await responseJson<{ grouping: StudentGroupingDto }>(await teacher.post(path, { data: { title: "Private grouping" } }));
      for (const role of ["student", "ta"] as const) {
        if (role === "ta") await setSeedStudentParticipantRole(data, role);
        expect((await restricted.get(path)).status()).toBe(403);
        expect((await restricted.post(path, { data: { title: "Denied" } })).status()).toBe(403);
        expect((await restricted.patch(`${path}/${grouping.id}`, { data: { ...grouping, title: "Denied" } })).status()).toBe(403);
        expect((await restricted.delete(`${path}/${grouping.id}`, { data: { revision: 1 } })).status()).toBe(403);
        await page.goto(`/courses/${data.courseId}/groups/${data.groupId}`);
        await expect(page.getByRole("heading", { level: 1 })).toContainText(data.courseTitle);
        await expect(page.getByRole("tab", { name: "Groupings", exact: true })).toBeHidden();
      }
      await setSeedStudentParticipantRole(data, "teacher");
      expect((await restricted.get(path)).status()).toBe(200);
      expect((await restricted.get(pathFor(data, data.otherSectionId))).status()).toBe(403);
      const teacherParticipant = await prisma.courseGroupParticipant.findFirstOrThrow({ where: { groupId: data.groupId, role: "teacher" } });
      expect((await restricted.post(path, { data: { title: "Staff as students", teams: [{ title: "Team A", participantIds: [teacherParticipant.id] }] } })).status()).toBe(400);
      await page.goto(`/courses/${data.courseId}/groups/${data.groupId}?tab=groupings`);
      await expect(page.getByRole("article", { name: "Private grouping" })).toBeVisible();
      await page.getByRole("button", { name: "Create grouping", exact: true }).click();
      await page.getByLabel("Grouping name").fill("Section teacher grouping");
      await page.getByRole("button", { name: "Create grouping", exact: true }).click();
      await expect(page.getByText("Everything is saved.", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Close", exact: true }).click();
      await page.reload();
      await expect(page.getByRole("article", { name: "Section teacher grouping" })).toBeVisible();
      await responseJson(await restricted.patch(`${path}/${grouping.id}`, { data: { ...grouping, title: "Managed by section teacher" } }));
      await responseJson(await restricted.delete(`${path}/${grouping.id}`, { data: { revision: 2 } }));
    } finally { await teacher.dispose(); await restricted.dispose(); }
  });

  test("cleans memberships on unenrollment and section removal without copying teams to another section", async ({ groupingsData: data }) => {
    const api = await createAuthenticatedApi("teacher");
    const path = pathFor(data);
    try {
      const { grouping } = await responseJson<{ grouping: StudentGroupingDto }>(await api.post(path, { data: { title: "Projects", teams: [{ title: "Partners", participantIds: data.students.map((student) => student.id) }] } }));
      const pending = data.students.find((student) => student.email.startsWith("groupings-"))!;
      await responseJson(await api.delete(`/api/courses/${data.courseId}/groups/${data.groupId}/participants/${pending.id}`));
      const result = await responseJson<{ groupings: StudentGroupingDto[]; students: StudentGroupingStudent[] }>(await api.get(path));
      expect(result.students).toHaveLength(1);
      expect(result.groupings[0]?.teams[0]?.participantIds).toEqual(result.students.map((student) => student.id));
      expect((await api.patch(`${path}/${grouping.id}`, { data: grouping })).status()).toBe(400);
      await responseJson(await api.delete(`/api/courses/${data.courseId}/groups/${data.groupId}`, { data: { action: "move", targetGroupId: data.otherSectionId } }));
      expect(await prisma.studentGrouping.count({ where: { id: grouping.id } })).toBe(0);
      expect(await prisma.studentTeamMember.count({ where: { groupingId: grouping.id } })).toBe(0);
      expect((await responseJson<{ groupings: StudentGroupingDto[]; students: StudentGroupingStudent[] }>(await api.get(pathFor(data, data.otherSectionId)))).groupings).toHaveLength(0);
      expect((await api.get(path)).status()).toBe(404);
    } finally { await api.dispose(); }
  });
});
