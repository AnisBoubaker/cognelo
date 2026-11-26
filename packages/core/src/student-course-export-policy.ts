import { prisma, type Prisma } from "@cognelo/db";
import { StudentCourseExportPolicySchema, type CurrentUser, type StudentCourseExportPolicy } from "@cognelo/contracts";
import { isAdmin } from "./authorization";
import { AppError, forbidden } from "./errors";

type PolicyReader = Pick<Prisma.TransactionClient, "applicationSettings">;
export async function getStudentCourseExportPolicy(db: PolicyReader = prisma): Promise<StudentCourseExportPolicy> {
  const row = await db.applicationSettings.findUnique({ where: { id: "instance" }, select: { exportUsageRights: true, allowCourseExportUsageRights: true } });
  return { usageRights: row?.exportUsageRights ?? "", allowTeacherEditing: row?.allowCourseExportUsageRights ?? true };
}
/** Serialize the administrator's lock with course-specific terms, including a missing singleton. */
export async function lockStudentCourseExportPolicy(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('cognelo:student-course-export-policy'))`;
}
export async function assertCourseExportRightsEditable(tx: Prisma.TransactionClient) {
  await lockStudentCourseExportPolicy(tx);
  if (!(await getStudentCourseExportPolicy(tx)).allowTeacherEditing) throw new AppError(403, "COURSE_EXPORT_RIGHTS_LOCKED", "Usage rights are managed by the site administrator.");
}
export async function updateStudentCourseExportPolicy(user: CurrentUser, input: unknown) {
  if (!isAdmin(user)) throw forbidden();
  const data = StudentCourseExportPolicySchema.parse(input);
  return prisma.$transaction(async tx => {
    await lockStudentCourseExportPolicy(tx);
    const values = { exportUsageRights: data.usageRights, allowCourseExportUsageRights: data.allowTeacherEditing, updatedById: user.id };
    await tx.applicationSettings.upsert({ where: { id: "instance" }, create: { id: "instance", ...values }, update: values });
    return getStudentCourseExportPolicy(tx);
  });
}
