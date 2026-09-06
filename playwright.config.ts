import { defineConfig, devices } from "@playwright/test";

const webBaseUrl = process.env.E2E_WEB_URL ?? "http://localhost:3000";
const apiBaseUrl = process.env.E2E_API_URL ?? "http://localhost:3001";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./tmp/playwright-results",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "./tmp/playwright-report" }]
  ],
  expect: { timeout: 10_000 },
  timeout: 60_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: webBaseUrl,
    locale: "en-CA",
    launchOptions: executablePath ? { executablePath } : undefined,
    screenshot: "only-on-failure",
    trace: "retain-on-failure"
  },
  webServer: [
    {
      command: "npm run dev:api",
      url: `${apiBaseUrl}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000
    },
    {
      command: "npm run dev:web",
      url: `${webBaseUrl}/login`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000
    }
  ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }]
});
