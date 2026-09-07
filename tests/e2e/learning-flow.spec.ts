import { expect, test } from "./fixtures/auth";
import { provisionLearningFlow, removeLearningFlow, type LearningFlowData } from "./fixtures/learning-flow";

test.describe("student submission and teacher grading", () => {
  let data: LearningFlowData | undefined;

  test.beforeAll(async () => {
    data = await provisionLearningFlow();
  });

  test.afterAll(async () => {
    await removeLearningFlow(data);
  });

  test("moves an assigned MCQ from learner submission through grade release", async ({ studentPage, teacherPage }) => {
    if (!data) throw new Error("Learning-flow data was not provisioned.");

    await teacherPage.goto(`/courses/${data.courseId}?tab=participants`);
    await expect(teacherPage.getByRole("heading", { name: data.courseTitle })).toBeVisible();
    await expect(teacherPage.getByRole("heading", { name: data.groupTitle })).toBeVisible();

    await studentPage.goto("/courses");
    await studentPage.getByRole("link", { name: new RegExp(data.courseTitle) }).click();
    await expect(studentPage.getByRole("heading", { name: `${data.courseTitle}: ${data.groupTitle}` })).toBeVisible();
    await studentPage.getByRole("link", { name: data.activityTitle, exact: true }).click();
    await expect(studentPage.getByRole("heading", { name: data.activityTitle })).toBeVisible();
    await studentPage.getByLabel("Four", { exact: true }).check();
    await studentPage.getByRole("button", { name: "Submit", exact: true }).click();
    const submitDialog = studentPage.getByRole("dialog", { name: "Submit answers?" });
    await submitDialog.getByRole("button", { name: "Submit answers" }).click();
    await expect(studentPage).toHaveURL(new RegExp(`/courses/${data.courseId}/groups/${data.groupId}$`));
    await expect(studentPage.getByText("Submitted", { exact: true })).toBeVisible();

    await teacherPage.goto(`/courses/${data.courseId}?tab=gradebook`);
    await expect(teacherPage.getByRole("heading", { name: "Course gradebook" })).toBeVisible();
    await expect(teacherPage.getByRole("button", { name: `Expand ${data.activityTitle}` })).toBeVisible();
    teacherPage.once("dialog", (dialog) => void dialog.accept());
    await teacherPage.getByRole("button", { name: "Release", exact: true }).click();
    await expect(teacherPage.getByRole("button", { name: "Hide", exact: true })).toBeVisible();

    await studentPage.goto(`/courses/${data.courseId}/groups/${data.groupId}?tab=grades`);
    await expect(studentPage.getByRole("heading", { name: "Grades", exact: true })).toBeVisible();
    await expect(studentPage.getByText(data.activityTitle, { exact: true })).toBeVisible();
    await expect(studentPage.getByText(/10\s*\/\s*10/, { exact: true })).toBeVisible();
  });
});
