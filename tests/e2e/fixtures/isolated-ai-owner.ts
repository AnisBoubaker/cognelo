import { randomUUID } from "node:crypto";
import { prisma } from "@cognelo/db";
import type { Browser, BrowserContext } from "@playwright/test";
import { createAuthenticatedApiWithCredentials, credentialsFor, WEB_BASE_URL } from "./auth";
import type { ActivitySuiteData } from "./activity-suite";

/** Scope AI defaults to one disposable course; never replace a shared login's preferences. */
export async function isolatedAiOwner(data: Pick<ActivitySuiteData, "courseId" | "token">, options: { keepSharedTeacherAccess?: boolean } = {}) {
  const course = await prisma.course.findUniqueOrThrow({ where: { id: data.courseId }, select: { title: true, createdById: true } });
  if (course.title !== `E2E full activity course ${data.token}`) throw new Error("AI fixtures require their own disposable activity-suite course.");
  const seed = await prisma.user.findUniqueOrThrow({ where: { email: credentialsFor("admin").email }, select: { passwordHash: true } });
  const email = `ai-fixture-${randomUUID()}@example.test`;
  const { user, detachedMemberships } = await prisma.$transaction(async tx => {
    const created = await tx.user.create({ data: { email, passwordHash: seed.passwordHash, firstName: "AI fixture", lastName: "Owner",
      isActive: true, emailVerifiedAt: new Date(), mustChangePassword: false, metadata: { e2e: true },
      roles: { create: ["admin", "teacher"].map(key => ({ role: { connect: { key } } })) } } });
    await tx.courseMembership.create({ data: { courseId: data.courseId, userId: created.id, role: "owner", source: "explicit" } });
    await tx.course.update({ where: { id: data.courseId }, data: { createdById: created.id } });
    // Staff-fallback tests must also exclude the shared owner's real AI choice.
    const detached = options.keepSharedTeacherAccess === false ? await tx.courseMembership.findMany({ where: {
      courseId: data.courseId, userId: course.createdById, source: "explicit", role: { in: ["owner", "teacher"] }
    } }) : [];
    if (detached.length) await tx.courseMembership.deleteMany({ where: { id: { in: detached.map(row => row.id) } } });
    return { user: created, detachedMemberships: detached };
  });
  const contexts: BrowserContext[] = [];
  const removeOwner = async () => {
    await prisma.$transaction(async tx => {
      const current = await tx.course.findUnique({ where: { id: data.courseId }, select: { createdById: true } });
      if (current?.createdById === user.id) {
        if (detachedMemberships.length) await tx.courseMembership.createMany({ data: detachedMemberships, skipDuplicates: true });
        await tx.course.update({ where: { id: data.courseId }, data: { createdById: course.createdById } });
      }
      await tx.user.deleteMany({ where: { id: user.id } });
    });
  };
  const api = await createAuthenticatedApiWithCredentials({ email, password: credentialsFor("admin").password })
    .catch(async error => { await removeOwner(); throw error; });
  return { user, api,
    async page(browser: Browser) {
      const context = await browser.newContext({ baseURL: WEB_BASE_URL, locale: "en-CA", storageState: await api.storageState() });
      contexts.push(context); return context.newPage();
    },
    async close() {
      try { await Promise.all(contexts.map(context => context.close())); await api.dispose(); }
      finally { await removeOwner(); }
    }
  };
}
