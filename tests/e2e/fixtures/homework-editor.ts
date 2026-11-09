import type { Page } from "@playwright/test";
export async function openHomeworkEditorSection(page: Page, name: "Activity" | "Teacher solution" | "Question Generation" | "Submission" | "Submission settings" | "Submission requirements" | "Simulation") {
  await page.getByRole("tablist", { name: "Activity editor", exact: true }).getByRole("tab", { name: "Activity", exact: true }).click();
  await page.getByRole("tablist", { name: "Programming Homework settings", exact: true }).getByRole("tab", { name: name === "Submission" ? "Submission settings" : name, exact: true }).click();
}
