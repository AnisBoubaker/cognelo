import { expect, test } from "./fixtures/auth";

type RunnerType = "judge0" | "web_design" | "sagemath";

const runnerFixtures: Record<RunnerType, {
  id: string;
  runnerType: RunnerType;
  displayName: string;
  baseUrl: string;
  authHeader: string;
  hasAuthToken: boolean;
  isEnabled: boolean;
  position: number;
  configured: boolean;
  settings: { enablePerProcessAndThreadLimits: boolean };
  updatedAt: string;
}> = {
  judge0: runner("judge0", "Judge0", "https://judge0.runner.test", 0),
  web_design: runner("web_design", "Web Design runner", "https://web.runner.test", 1),
  sagemath: runner("sagemath", "SageMath runner", "https://sage.runner.test", 2)
};

test.describe("execution runner administration", () => {
  test("saves SageMath with the other runner types and tests every endpoint's required capabilities", async ({ adminPage: page }) => {
    const saved: Array<{ runnerType: RunnerType; body: Record<string, unknown> }> = [];
    const tested: RunnerType[] = [];

    await page.route("**/api/settings/runners", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ configurations: Object.values(runnerFixtures) })
      });
    });
    await page.route(/\/api\/settings\/runners\/(judge0|web_design|sagemath)$/, async (route) => {
      const runnerType = new URL(route.request().url()).pathname.split("/").at(-1) as RunnerType;
      const body = route.request().postDataJSON() as Record<string, unknown>;
      saved.push({ runnerType, body });
      const configuration = {
        ...runnerFixtures[runnerType],
        displayName: body.displayName,
        baseUrl: body.baseUrl,
        authHeader: body.authHeader,
        isEnabled: body.isEnabled,
        settings: body.settings,
        updatedAt: new Date().toISOString()
      };
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ configuration }) });
    });
    await page.route(/\/api\/settings\/runners\/(judge0|web_design|sagemath)\/test$/, async (route) => {
      const runnerType = new URL(route.request().url()).pathname.split("/").at(-2) as RunnerType;
      tested.push(runnerType);
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          capabilities: [
            { key: "connection", label: `${runnerType} connection`, ok: true, detail: "Reachable." },
            { key: "required-runtime", label: `${runnerType} required runtime`, ok: true, detail: "Available." }
          ]
        })
      });
    });

    await page.goto("/settings/runners");
    await expect(page.getByRole("heading", { name: "Execution runners" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Judge0", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Web Design runner", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "SageMath runner", exact: true })).toBeVisible();

    const sageCard = page.locator("article").filter({ has: page.getByRole("heading", { name: "SageMath runner", exact: true }) });
    await sageCard.getByLabel("Base URL").fill("https://sage-pool.runner.test");
    await page.getByRole("button", { name: "Save runner settings", exact: true }).click();
    await expect.poll(() => saved.length).toBe(1);
    expect(saved).toEqual([{
      runnerType: "sagemath",
      body: {
        displayName: "SageMath runner",
        baseUrl: "https://sage-pool.runner.test",
        authHeader: "",
        authToken: "",
        isEnabled: true,
        settings: { enablePerProcessAndThreadLimits: true }
      }
    }]);

    for (const [runnerType, heading] of [
      ["judge0", "Judge0"],
      ["web_design", "Web Design runner"],
      ["sagemath", "SageMath runner"]
    ] as const) {
      const card = page.locator("article").filter({ has: page.getByRole("heading", { name: heading, exact: true }) });
      await card.getByRole("button", { name: "Test connection and capabilities", exact: true }).click();
      await expect(card.getByText(`${runnerType} connection`, { exact: false })).toBeVisible();
      await expect(card.getByText(`${runnerType} required runtime`, { exact: false })).toBeVisible();
    }
    expect(tested).toEqual(["judge0", "web_design", "sagemath"]);
  });
});

function runner(runnerType: RunnerType, displayName: string, baseUrl: string, position: number) {
  return {
    id: `runner-${runnerType}`,
    runnerType,
    displayName,
    baseUrl,
    authHeader: "",
    hasAuthToken: false,
    isEnabled: true,
    position,
    configured: true,
    settings: { enablePerProcessAndThreadLimits: true },
    updatedAt: "2026-10-06T00:00:00.000Z"
  };
}
