import {
  expect,
  request as playwrightRequest,
  test as base,
  type APIRequestContext,
  type Browser,
  type Page,
  type StorageState
} from "@playwright/test";

export type AuthRole = "admin" | "teacher" | "student";

export type Credentials = {
  email: string;
  password: string;
};

type AuthenticatedFixtures = {
  adminPage: Page;
  teacherPage: Page;
  studentPage: Page;
};

export const WEB_BASE_URL = process.env.E2E_WEB_URL ?? "http://localhost:3000";
export const API_BASE_URL = process.env.E2E_API_URL ?? "http://localhost:3001";

const credentials: Record<AuthRole, Credentials> = {
  admin: {
    email: process.env.E2E_ADMIN_EMAIL ?? "admin@cognelo.local",
    password: process.env.E2E_ADMIN_PASSWORD ?? "Password123!"
  },
  teacher: {
    email: process.env.E2E_TEACHER_EMAIL ?? "teacher@cognelo.local",
    password: process.env.E2E_TEACHER_PASSWORD ?? "Password123!"
  },
  student: {
    email: process.env.E2E_STUDENT_EMAIL ?? "student@cognelo.local",
    password: process.env.E2E_STUDENT_PASSWORD ?? "Password123!"
  }
};

export function credentialsFor(role: AuthRole) {
  return credentials[role];
}

export async function createAuthenticatedApi(role: AuthRole): Promise<APIRequestContext> {
  const context = await playwrightRequest.newContext({
    baseURL: API_BASE_URL,
    extraHTTPHeaders: {
      Accept: "application/json",
      Origin: WEB_BASE_URL
    }
  });
  const response = await context.post("/api/auth/login", { data: credentialsFor(role) });
  if (!response.ok()) {
    const body = await response.text();
    await context.dispose();
    throw new Error(`Unable to authenticate the ${role} E2E account (${response.status()}): ${body}`);
  }
  return context;
}

export async function createAuthenticatedStorageState(role: AuthRole): Promise<StorageState> {
  const context = await createAuthenticatedApi(role);
  const storageState = await context.storageState();
  await context.dispose();
  return storageState;
}

export async function loginThroughUi(page: Page, role: AuthRole) {
  await loginWithCredentialsThroughUi(page, credentialsFor(role));
}

export async function loginWithCredentialsThroughUi(page: Page, account: Credentials) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByLabel("Password").press("Enter");
  await expect(page.getByRole("button", { name: "Open account menu" })).toBeVisible();
}

async function useAuthenticatedPage(
  browser: Browser,
  role: AuthRole,
  use: (page: Page) => Promise<void>
) {
  const context = await browser.newContext({
    baseURL: WEB_BASE_URL,
    locale: "en-CA",
    storageState: await createAuthenticatedStorageState(role)
  });
  const page = await context.newPage();
  try {
    await use(page);
  } finally {
    await context.close();
  }
}

export const test = base.extend<AuthenticatedFixtures>({
  adminPage: async ({ browser }, use) => useAuthenticatedPage(browser, "admin", use),
  teacherPage: async ({ browser }, use) => useAuthenticatedPage(browser, "teacher", use),
  studentPage: async ({ browser }, use) => useAuthenticatedPage(browser, "student", use)
});

export { expect };
