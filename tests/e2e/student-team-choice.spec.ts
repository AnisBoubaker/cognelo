import type { MyStudentGroupingDto, StudentGroupingDto, StudentGroupingStudent } from "@cognelo/contracts";
import { prisma } from "@cognelo/db";
import { test as base, expect, createAuthenticatedApi, createAuthenticatedApiWithCredentials, credentialsFor, type Credentials } from "./fixtures/auth";
import { provisionActivitySuite, removeActivitySuite, responseJson, type ActivitySuiteData } from "./fixtures/activity-suite";

type Scenario = ActivitySuiteData & { students: StudentGroupingStudent[]; peer: Credentials; otherSectionId: string };
const test = base.extend<{ teamsData: Scenario }>({
  teamsData: async ({}, provide) => {
    const data = await provisionActivitySuite();
    const teacher = await createAuthenticatedApi("teacher");
    const admin = await createAuthenticatedApi("admin");
    const peer = { email: `team-choice-${data.token}@example.test`, password: "TeamChoice123!" };
    let userId = "";
    try {
      const { user } = await responseJson<{ user: { id: string } }>(await admin.post("/api/users", { data: { ...peer, firstName: "Alex", lastName: "Partner", roles: ["student"] } }));
      userId = user.id;
      await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date(), mustChangePassword: false } });
      await responseJson(await teacher.post(`/api/courses/${data.courseId}/groups/${data.groupId}/participants`, { data: { email: peer.email, role: "student" } }));
      await responseJson(await teacher.post(`/api/courses/${data.courseId}/groups/${data.groupId}/participants`, { data: { email: `pending-choice-${data.token}@example.test`, firstName: "Pending", lastName: "Learner", role: "student" } }));
      const { group } = await responseJson<{ group: { id: string } }>(await teacher.post(`/api/courses/${data.courseId}/groups`, { data: { title: "Other section" } }));
      const { students } = await responseJson<{ students: StudentGroupingStudent[] }>(await teacher.get(`/api/courses/${data.courseId}/groups/${data.groupId}/groupings`));
      await provide({ ...data, students, peer, otherSectionId: group.id });
    } finally {
      await teacher.dispose(); await admin.dispose();
      await removeActivitySuite(data);
      if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    }
  }
});
const staffPath = (data: Scenario) => `/api/courses/${data.courseId}/groups/${data.groupId}/groupings`;
const choicePath = (data: Scenario) => `/api/courses/${data.courseId}/groups/${data.groupId}/my-teams`;

test.describe("automatic assignment and student team choices", { tag: "@regression" }, () => {
  test("configures per-team slots, preserves assigned students, leaves excess unassigned, and saves student choice dates", async ({ teacherPage: page, teamsData: data }) => {
    const api = await createAuthenticatedApi("teacher");
    const assigned = data.students[0]!;
    try {
      const { grouping } = await responseJson<{ grouping: StudentGroupingDto }>(await api.post(staffPath(data), { data: {
        title: "Assignment options", teams: [{ title: "Blue", capacity: 1, participantIds: [assigned.id] }, { title: "Green", capacity: 1, participantIds: [] }]
      } }));
      await page.goto(`/courses/${data.courseId}?tab=groupings`);
      await page.getByLabel("Section", { exact: true }).selectOption(data.groupId);
      await page.getByRole("article", { name: "Assignment options" }).getByRole("button", { name: "Edit", exact: true }).click();
      await page.getByRole("button", { name: "Automatic assign", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Automatic assign", exact: true });
      await expect(dialog.getByRole("radio", { name: /Smart/ })).toBeDisabled();
      await expect(dialog.getByLabel("Assign unassigned students only", { exact: true })).toBeChecked();
      await dialog.getByLabel("Slots per team", { exact: true }).fill("2");
      await dialog.getByRole("button", { name: "Apply to all teams", exact: true }).click();
      await expect(dialog.getByLabel("Slots for Blue", { exact: true })).toHaveValue("2");
      await expect(dialog.getByLabel("Slots for Green", { exact: true })).toHaveValue("2");
      await dialog.getByLabel("Slots for Blue", { exact: true }).fill("1");
      await dialog.getByLabel("Slots for Green", { exact: true }).fill("1");
      await dialog.getByRole("button", { name: "Apply to grouping", exact: true }).click();
      await expect(page.getByText("Each student can join one team per grouping. Unassigned: 1.", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Save grouping", exact: true }).click();
      await expect(page.getByText("Everything is saved.", { exact: true })).toBeVisible();
      let saved = (await responseJson<{ groupings: StudentGroupingDto[] }>(await api.get(staffPath(data)))).groupings[0]!;
      expect(saved.teams.find((team) => team.title === "Blue")!.participantIds).toEqual([assigned.id]);
      expect(saved.teams.flatMap((team) => team.participantIds)).toHaveLength(2);
      await page.getByRole("button", { name: "Automatic assign", exact: true }).click();
      await dialog.getByLabel("Let students choose", { exact: true }).check();
      await dialog.getByLabel("Slots per team", { exact: true }).fill("3");
      await dialog.getByRole("button", { name: "Apply to all teams", exact: true }).click();
      await dialog.getByLabel("Slots for Blue", { exact: true }).fill("2");
      await dialog.getByLabel("Choose from", { exact: true }).fill("2026-10-01");
      await dialog.locator("#team-choice-from-time").fill("09:00");
      await dialog.getByLabel("Choose until", { exact: true }).fill("2026-10-01");
      await dialog.locator("#team-choice-until-time").fill("08:00");
      await expect(dialog.getByRole("button", { name: "Apply to grouping" })).toBeDisabled();
      await dialog.getByLabel("Choose until", { exact: true }).fill("2027-10-31");
      await dialog.locator("#team-choice-until-time").fill("17:30");
      await dialog.getByLabel("Allow students to change their choice before the deadline", { exact: true }).check();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: test.info().outputPath("automatic-assignment-mobile.png"), fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
      await dialog.getByRole("button", { name: "Apply to grouping", exact: true }).click();
      // Applying dialog settings remains a draft until the grouping is saved.
      expect((await responseJson<{ groupings: StudentGroupingDto[] }>(await api.get(staffPath(data)))).groupings[0]!.studentChoiceEnabled).toBe(false);
      await page.getByRole("button", { name: "Save grouping", exact: true }).click();
      await expect(page.getByText("Everything is saved.", { exact: true })).toBeVisible();
      saved = (await responseJson<{ groupings: StudentGroupingDto[] }>(await api.get(staffPath(data)))).groupings[0]!;
      expect(saved.id).toBe(grouping.id);
      expect(saved.studentChoiceEnabled).toBe(true);
      expect(saved.allowChoiceChanges).toBe(true);
      expect(saved.choiceOpensAt).not.toBeNull(); expect(saved.choiceClosesAt).not.toBeNull();
      expect(saved.teams.map((team) => team.capacity)).toEqual([2, 3]);
      await page.reload();
      await page.getByLabel("Section", { exact: true }).selectOption(data.groupId);
      await page.getByRole("article", { name: "Assignment options" }).getByRole("button", { name: "Edit", exact: true }).click();
      await page.getByRole("button", { name: "Automatic assign", exact: true }).click();
      await expect(dialog.getByLabel("Let students choose", { exact: true })).toBeChecked();
      await expect(dialog.getByLabel("Choose until", { exact: true })).toHaveValue("2027-10-31");
      await expect(dialog.locator("#team-choice-until-time")).toHaveValue("17:30");
      await expect(dialog.getByLabel("Slots for Blue", { exact: true })).toHaveValue("2");
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    } finally { await api.dispose(); }
  });

  test("shows names and slots, requires confirmation, supports permitted changes, and locks choices at the deadline", async ({ studentPage: page, teamsData: data }) => {
    const teacher = await createAuthenticatedApi("teacher");
    const student = await createAuthenticatedApi("student");
    const peer = data.students.find((item) => item.email === data.peer.email)!;
    const self = data.students.find((item) => item.email === credentialsFor("student").email)!;
    try {
      let { grouping } = await responseJson<{ grouping: StudentGroupingDto }>(await teacher.post(staffPath(data), { data: {
        title: "Choose project partners", description: "PRIVATE teacher accommodation notes", studentChoiceEnabled: true, allowChoiceChanges: true,
        choiceClosesAt: new Date(Date.now() + 3600000).toISOString(),
        teams: [{ title: "Blue", capacity: 3, participantIds: [peer.id] }, { title: "Green", capacity: 2 }, { title: "Closed team", capacity: 0 }]
      } }));
      await responseJson(await teacher.post(staffPath(data), { data: { title: "Assigned lab", description: "PRIVATE staff notes", teams: [
        { title: "Lab partners", participantIds: [self.id, peer.id] }, { title: "Hidden other team", participantIds: [] }
      ] } }));
      await page.goto(`/courses/${data.courseId}/groups/${data.groupId}`);
      await page.getByRole("tab", { name: "My teams", exact: true }).click();
      const card = page.getByRole("article", { name: "Choose project partners", exact: true });
      await expect(card.getByText("Alex Partner", { exact: true })).toBeVisible();
      await expect(card.getByText("Open slot", { exact: true })).toHaveCount(4);
      await expect(card.getByText("PRIVATE teacher accommodation notes")).toBeHidden();
      await expect(page.getByText("Hidden other team", { exact: true })).toBeHidden();
      await expect(page.getByRole("article", { name: "Assigned lab" }).getByText("Alex Partner", { exact: true })).toBeVisible();
      await expect(card.getByRole("region", { name: "Closed team", exact: true }).getByRole("radio")).toBeDisabled();
      await expect(card.getByRole("button", { name: "Confirm choice" })).toBeDisabled();
      await card.getByRole("region", { name: "Blue", exact: true }).getByRole("radio").check();
      expect((await responseJson<{ groupings: MyStudentGroupingDto[] }>(await student.get(choicePath(data)))).groupings.find((item) => item.id === grouping.id)!.ownTeamId).toBeNull();
      await card.getByRole("button", { name: "Confirm choice" }).click();
      await expect(card.getByRole("status")).toHaveText("Your team choice is confirmed.");
      const blueId = grouping.teams.find((team) => team.title === "Blue")!.id;
      const greenId = grouping.teams.find((team) => team.title === "Green")!.id;
      await expect(card.getByRole("region", { name: "Blue", exact: true }).getByText("Your team", { exact: true }).first()).toBeVisible();
      expect((await teacher.patch(`${staffPath(data)}/${grouping.id}`, { data: grouping })).status()).toBe(409);
      await card.getByRole("region", { name: "Green", exact: true }).getByRole("radio").check();
      await card.getByRole("button", { name: "Confirm choice" }).click();
      await expect(card.getByRole("region", { name: "Green", exact: true }).getByText("Your team", { exact: true }).first()).toBeVisible();
      // A deadline reached after the screen opened immediately disables confirmation.
      grouping = (await responseJson<{ groupings: StudentGroupingDto[] }>(await teacher.get(staffPath(data)))).groupings.find((item) => item.id === grouping.id)!;
      grouping = (await responseJson<{ grouping: StudentGroupingDto }>(await teacher.patch(`${staffPath(data)}/${grouping.id}`, { data: { ...grouping, choiceClosesAt: new Date(Date.now() + 8000).toISOString() } }))).grouping;
      await page.goto(`/courses/${data.courseId}/groups/${data.groupId}?tab=my-teams`);
      await card.getByRole("region", { name: "Blue", exact: true }).getByRole("radio").check();
      await expect(card.getByText("Team selection has closed. Choices can no longer be changed.", { exact: true })).toBeVisible({ timeout: 15000 });
      await expect(card.getByRole("button", { name: "Confirm choice" })).toBeHidden();
      await expect(card.getByRole("radio")).toHaveCount(0);
      await expect(card.getByRole("region", { name: "Blue", exact: true })).not.toHaveClass(/is-selected/);
      await expect(card.getByRole("region", { name: "Green", exact: true })).toHaveClass(/is-selected/);
      expect((await student.post(`${choicePath(data)}/${grouping.id}`, { data: { teamId: blueId } })).status()).toBe(403);
      const mine = (await responseJson<{ groupings: MyStudentGroupingDto[] }>(await student.get(choicePath(data)))).groupings.find((item) => item.id === grouping.id)!;
      expect(mine.ownTeamId).toBe(greenId); expect(mine.choiceState).toBe("closed");
      expect(JSON.stringify(mine)).not.toContain(peer.email); expect(mine).not.toHaveProperty("description");
      await page.screenshot({ path: test.info().outputPath("my-teams-desktop.png"), fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await card.scrollIntoViewIfNeeded();
      await expect(card.getByRole("region", { name: "Green", exact: true })).toBeVisible();
      await page.screenshot({ path: test.info().outputPath("my-teams-mobile.png"), fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
      // A reopened window still respects the teacher's no-change permission.
      await responseJson(await teacher.patch(`${staffPath(data)}/${grouping.id}`, { data: { ...grouping, choiceClosesAt: null, allowChoiceChanges: false } }));
      expect((await student.post(`${choicePath(data)}/${grouping.id}`, { data: { teamId: blueId } })).status()).toBe(403);
      await page.reload();
      await expect(card.getByText("Your team choice is final.", { exact: true })).toBeVisible();
    } finally { await teacher.dispose(); await student.dispose(); }
  });

  test("protects the last slot during concurrent confirmations and enforces section, identity, and opening restrictions", async ({ teamsData: data }) => {
    const teacher = await createAuthenticatedApi("teacher");
    const student = await createAuthenticatedApi("student");
    const peer = await createAuthenticatedApiWithCredentials(data.peer);
    try {
      let { grouping } = await responseJson<{ grouping: StudentGroupingDto }>(await teacher.post(staffPath(data), { data: {
        title: "Last available slot", studentChoiceEnabled: true, allowChoiceChanges: false,
        teams: [{ title: "One place", capacity: 1 }, { title: "Another team", capacity: 1 }]
      } }));
      const teamId = grouping.teams.find((team) => team.title === "One place")!.id;
      const choose = `${choicePath(data)}/${grouping.id}`;
      const results = await Promise.all([student.post(choose, { data: { teamId } }), peer.post(choose, { data: { teamId } })]);
      expect(results.map((response) => response.status()).sort()).toEqual([200, 409]);
      expect(await prisma.studentTeamMember.count({ where: { teamId } })).toBe(1);
      const winner = results[0]!.ok() ? student : peer;
      const loser = results[0]!.ok() ? peer : student;
      const otherTeamId = grouping.teams.find((team) => team.title === "Another team")!.id;
      expect((await winner.post(choose, { data: { teamId: otherTeamId } })).status()).toBe(403);
      expect((await loser.post(choose, { data: { teamId } })).status()).toBe(409);
      expect((await student.post(choose, { data: { teamId, participantId: "another-student" } })).status()).toBe(400);
      expect((await teacher.post(choose, { data: { teamId } })).status()).toBe(403);
      expect((await teacher.get(choicePath(data))).status()).toBe(403);
      const otherPath = `/api/courses/${data.courseId}/groups/${data.otherSectionId}/my-teams`;
      expect((await student.get(otherPath)).status()).toBe(403);
      expect((await student.post(`${otherPath}/${grouping.id}`, { data: { teamId } })).status()).toBe(403);
      const foreign = (await responseJson<{ grouping: StudentGroupingDto }>(await teacher.post(`/api/courses/${data.courseId}/groups/${data.otherSectionId}/groupings`, { data: { title: "Other section grouping", studentChoiceEnabled: true, teams: [{ title: "Foreign" }] } }))).grouping;
      expect((await loser.post(choose, { data: { teamId: foreign.teams[0]!.id } })).status()).toBe(404);
      expect((await student.post(`${choicePath(data)}/${foreign.id}`, { data: { teamId: foreign.teams[0]!.id } })).status()).toBe(404);
      grouping = (await responseJson<{ groupings: StudentGroupingDto[] }>(await teacher.get(staffPath(data)))).groupings[0]!;
      await responseJson(await teacher.patch(`${staffPath(data)}/${grouping.id}`, { data: { ...grouping, choiceOpensAt: new Date(Date.now() + 3600000).toISOString() } }));
      expect((await loser.post(choose, { data: { teamId: otherTeamId } })).status()).toBe(403);
      expect((await responseJson<{ groupings: MyStudentGroupingDto[] }>(await loser.get(choicePath(data)))).groupings[0]!.choiceState).toBe("upcoming");
      await responseJson(await teacher.patch(`/api/courses/${data.courseId}/groups/${data.groupId}`, { data: { status: "draft" } }));
      expect((await student.get(choicePath(data))).status()).toBe(403);
      expect((await student.post(choose, { data: { teamId } })).status()).toBe(403);
    } finally { await teacher.dispose(); await student.dispose(); await peer.dispose(); }
  });
});
