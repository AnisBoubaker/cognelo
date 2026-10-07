import { randomUUID } from "node:crypto";
import { prisma } from "@cognelo/db";
import { createAuthenticatedApi, expect, test } from "./fixtures/auth";
import { responseJson } from "./fixtures/activity-suite";

test.describe.serial("knowledge graph authoring and activity targets", () => {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const foundationTitle = `Foundation ${token}`;
  const dependentTitle = `Application ${token}`;
  const skillTitle = `Explain the invariant ${token}`;
  const misconceptionTitle = `The invariant changes randomly ${token}`;
  const generatedTitle = `AI extension ${token}`;
  let subjectId = "";
  let bankId = "";

  test.beforeAll(async () => {
    const api = await createAuthenticatedApi("teacher");
    try {
      const { subject } = await responseJson<{ subject: { id: string } }>(
        await api.post("/api/subjects", {
          data: {
            description: "A sufficiently detailed disposable subject used to verify knowledge graph workflows.",
            title: `E2E knowledge graph ${token}`
          }
        })
      );
      subjectId = subject.id;
      const { activityBank } = await responseJson<{ activityBank: { id: string } }>(
        await api.post("/api/activity-banks", {
          data: {
            description: "Disposable bank for concept targeting coverage.",
            subjectId,
            title: `E2E graph targets ${token}`
          }
        })
      );
      bankId = activityBank.id;
    } finally {
      await api.dispose();
    }
  });

  test.afterAll(async () => {
    const api = await createAuthenticatedApi("teacher");
    try {
      if (bankId) {
        await api.delete(`/api/activity-banks/${bankId}`, { data: { action: "delete", force: true } });
      }
    } finally {
      await api.dispose();
      if (subjectId) await prisma.subject.deleteMany({ where: { id: subjectId } });
    }
  });

  test("creates concepts, skills, misconceptions, and a prerequisite, then reloads the saved graph", async ({ teacherPage: page }) => {
    test.setTimeout(120_000);
    await page.goto(`/subjects/${subjectId}/edit`);
    await page.getByRole("tab", { name: "Knowledge graph" }).click();

    const newConcept = page.getByPlaceholder("New concept name");
    await newConcept.fill(foundationTitle);
    await page.getByRole("button", { name: "Add concept" }).click();
    await newConcept.fill(dependentTitle);
    await page.getByRole("button", { name: "Add concept" }).click();

    await page.locator(".react-flow__node").filter({ hasText: foundationTitle }).click();
    await page.getByRole("button", { name: "Add skill" }).click();
    let dialog = page.getByRole("dialog", { name: "Add skill" });
    await dialog.getByLabel("Skill description").fill(skillTitle);
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("button", { name: "Add misconception" }).click();
    dialog = page.getByRole("dialog", { name: "Add misconception" });
    await dialog.getByLabel("Wrong belief").fill(misconceptionTitle);
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(skillTitle, { exact: true })).toBeVisible();
    await expect(page.getByText(misconceptionTitle, { exact: true })).toBeVisible();

    const dependentNode = page.locator(".react-flow__node").filter({ hasText: dependentTitle });
    const foundationNode = page.locator(".react-flow__node").filter({ hasText: foundationTitle });
    // Use the inward-facing handles: the inspector can cover the dependent
    // concept's right edge on the default viewport.
    const source = dependentNode.locator(".react-flow__handle-left");
    const target = foundationNode.locator(".react-flow__handle-right");
    const sourceBox = await source.boundingBox();
    const targetBox = await target.boundingBox();
    if (!sourceBox || !targetBox) throw new Error("The prerequisite handles could not be measured.");
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 12 });
    await page.mouse.up();
    await expect(page.locator(".react-flow__edge")).toHaveCount(1);

    await page.getByRole("button", { name: "Save", exact: true }).last().click();
    await expect(page).toHaveURL(`/subjects/${subjectId}`);
    await page.goto(`/subjects/${subjectId}/edit`);
    await page.getByRole("tab", { name: "Knowledge graph" }).click();
    await expect(page.locator(".react-flow__node").filter({ hasText: foundationTitle })).toBeVisible();
    await expect(page.locator(".react-flow__node").filter({ hasText: dependentTitle })).toBeVisible();
    await expect(page.locator(".react-flow__edge")).toHaveCount(1);
    await page.locator(".react-flow__node").filter({ hasText: foundationTitle }).click();
    await expect(page.getByText(skillTitle, { exact: true })).toBeVisible();
    await expect(page.getByText(misconceptionTitle, { exact: true })).toBeVisible();

    const stored = await prisma.subjectKnowledgeConcept.findFirstOrThrow({
      where: { subjectId, title: foundationTitle },
      include: { skillRecords: true, misconceptionRecords: true }
    });
    expect(stored.skillRecords.map((skill) => skill.title)).toContain(skillTitle);
    expect(stored.misconceptionRecords.map((item) => item.title)).toContain(misconceptionTitle);
    expect(await prisma.subjectKnowledgePrerequisite.count({ where: { subjectId } })).toBe(1);
  });

  test("iterates the graph through AI with blocking progress and saves the returned additions", async ({ teacherPage: page }) => {
    test.setTimeout(120_000);
    const concepts = await prisma.subjectKnowledgeConcept.findMany({
      where: { subjectId },
      include: {
        skillRecords: { orderBy: { position: "asc" } },
        misconceptionRecords: { orderBy: { position: "asc" } }
      },
      orderBy: { title: "asc" }
    });
    const prerequisites = await prisma.subjectKnowledgePrerequisite.findMany({ where: { subjectId } });
    const generatedConceptId = randomUUID();
    let generationBody: Record<string, unknown> | undefined;
    let markGenerationStarted = () => undefined;
    let releaseGeneration = () => undefined;
    const generationStarted = new Promise<void>((resolve) => { markGenerationStarted = resolve; });
    const generationGate = new Promise<void>((resolve) => { releaseGeneration = resolve; });

    await page.route("**/api/ai-agents", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          connections: [{
            id: "e2e-ai-agent",
            displayName: "E2E graph generator",
            provider: "openai",
            model: "e2e-model",
            baseUrl: null,
            scope: "personal",
            isEnabled: true,
            hasApiKey: true
          }],
          preferences: { questionAuthoringAiAgentConnectionId: "e2e-ai-agent" }
        })
      });
    });
    await page.route(`**/api/subjects/${subjectId}/knowledge-graph/generate`, async (route) => {
      generationBody = route.request().postDataJSON() as Record<string, unknown>;
      markGenerationStarted();
      await generationGate;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          concepts: [
            ...concepts.map((concept) => ({
              id: concept.id,
              title: concept.title,
              skills: concept.skillRecords.map((skill) => skill.title).join("\n"),
              misconceptions: concept.misconceptionRecords.map((item) => item.title),
              skillRecords: concept.skillRecords,
              misconceptionRecords: concept.misconceptionRecords,
              positionX: concept.positionX,
              positionY: concept.positionY
            })),
            {
              id: generatedConceptId,
              title: generatedTitle,
              skills: `Apply the extension ${token}`,
              misconceptions: [`The extension is optional ${token}`],
              skillRecords: [{ id: randomUUID(), title: `Apply the extension ${token}`, position: 0, active: true }],
              misconceptionRecords: [{ id: randomUUID(), title: `The extension is optional ${token}`, position: 0, active: true }],
              positionX: 520,
              positionY: 260
            }
          ],
          prerequisites
        })
      });
    });

    await page.goto(`/subjects/${subjectId}/edit`);
    await page.getByRole("tab", { name: "Knowledge graph" }).click();
    await page.getByText("Generate knowledge graph with AI", { exact: true }).click();
    await page.getByLabel("Generation mode").selectOption("iterate");
    await page.getByLabel("AI directions (optional)").fill("Add one extension while preserving all existing targets.");
    await page.getByRole("button", { name: "Iterate on graph" }).click();
    await generationStarted;
    const progress = page.getByRole("dialog", { name: "Generating..." });
    await expect(progress).toBeVisible();
    expect(generationBody).toMatchObject({ mode: "iterate" });
    expect(generationBody?.existingGraph).toBeTruthy();
    releaseGeneration();

    const summary = page.getByRole("dialog", { name: "AI iteration changes" });
    await expect(summary).toContainText(generatedTitle);
    await summary.getByRole("button", { name: "OK", exact: true }).click();
    await page.getByRole("button", { name: "Save", exact: true }).last().click();
    await expect(page).toHaveURL(`/subjects/${subjectId}`);
    await expect.poll(async () => prisma.subjectKnowledgeConcept.count({ where: { id: generatedConceptId, subjectId } })).toBe(1);
  });

  test("targets a stable skill and misconception independently from a bank activity", async ({ teacherPage: page }) => {
    const title = `E2E targeted MCQ ${token}`;
    await page.goto(`/activity-banks/${bankId}`);
    await page.getByRole("button", { name: "Add activity", exact: true }).click();
    const picker = page.getByRole("dialog", { name: "Choose an activity" });
    await picker.getByRole("tab", { name: "Generic Activity", exact: true }).click();
    await picker.getByRole("button", { name: /Mult.*choice questions/ }).click();
    await page.getByLabel("Title", { exact: true }).fill(title);
    await page.locator("#mcq-source").fill("## Targeting\nWhich answer is correct?\n\n- [x] This one\n- [ ] Not this one");

    await page.getByRole("tab", { name: "Concepts" }).click();
    const conceptRow = page.getByRole("listitem").filter({ hasText: foundationTitle });
    await conceptRow.getByRole("button").click();
    await page.getByText(skillTitle, { exact: true }).locator("..").getByRole("checkbox").check();
    await page.getByText(misconceptionTitle, { exact: true }).locator("..").getByRole("checkbox").check();
    await page.getByRole("button", { name: "Save", exact: true }).last().click();
    await expect(page.getByText("Knowledge concept links saved.", { exact: true })).toBeVisible();

    await page.reload();
    await page.getByRole("tab", { name: /Concepts/ }).click();
    await page.getByRole("listitem").filter({ hasText: foundationTitle }).getByRole("button").click();
    await expect(page.getByText(skillTitle, { exact: true }).locator("..").getByRole("checkbox")).toBeChecked();
    await expect(page.getByText(misconceptionTitle, { exact: true }).locator("..").getByRole("checkbox")).toBeChecked();

    const activityId = page.url().match(/\/activities\/([^/?#]+)/)?.[1];
    if (!activityId) throw new Error("The targeted bank activity id was missing from the URL.");
    const targets = await prisma.bankActivityKnowledgeConcept.findMany({ where: { bankActivityId: activityId } });
    expect(targets).toHaveLength(1);
    expect(targets[0].selectsAllSkills).toBe(false);
    expect(targets[0].selectedSkillIds).toEqual(expect.any(Array));
    expect(targets[0].selectedSkillIds as unknown[]).toHaveLength(1);
    expect(targets[0].selectedMisconceptionIds).toEqual(expect.any(Array));
    expect(targets[0].selectedMisconceptionIds as unknown[]).toHaveLength(1);
  });
});
