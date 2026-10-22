import { CourseTimeSettingsSchema, type CourseTimeSettingsDto, type CurrentUser } from "@cognelo/contracts";
import { prisma } from "@cognelo/db";
import { assertCanViewCourse, isAdmin } from "./authorization";
import { getTimeZoneChoices } from "./application-time";
import { AppError, forbidden, notFound } from "./errors";

export async function getCourseTimeSettings(user: CurrentUser, courseId: string): Promise<CourseTimeSettingsDto> {
  await assertCanViewCourse(user, courseId);
  const [course, settings] = await Promise.all([
    prisma.course.findUnique({
      where: { id: courseId },
      select: { timeZone: true, memberships: { where: { userId: user.id, role: "owner", source: "explicit" }, select: { id: true } } }
    }),
    prisma.applicationSettings.findUnique({ where: { id: "instance" }, select: { timeZone: true, allowCourseTimeZone: true } })
  ]);
  if (!course) throw notFound("Course");
  const applicationTimeZone = settings?.timeZone ?? "UTC";
  const allowCourseTimeZone = settings?.allowCourseTimeZone ?? false;
  const timeZone = allowCourseTimeZone ? course.timeZone ?? applicationTimeZone : applicationTimeZone;
  const canConfigure = allowCourseTimeZone && (isAdmin(user) || course.memberships.length > 0);
  return {
    timeZone, courseTimeZone: course.timeZone, applicationTimeZone, allowCourseTimeZone, canConfigure,
    timeZones: canConfigure ? getTimeZoneChoices(applicationTimeZone, timeZone) : []
  };
}

export async function updateCourseTimeSettings(user: CurrentUser, courseId: string, input: unknown) {
  await assertCanViewCourse(user, courseId);
  const { timeZone } = CourseTimeSettingsSchema.parse(input);
  const canonical = timeZone === null ? null : new Intl.DateTimeFormat("en", { timeZone }).resolvedOptions().timeZone;
  await prisma.$transaction(async (tx) => {
    const settings = await tx.applicationSettings.findUnique({ where: { id: "instance" }, select: { allowCourseTimeZone: true } });
    if (!settings?.allowCourseTimeZone) throw new AppError(403, "COURSE_TIMEZONE_DISABLED", "Course timezones are disabled by the administrator.");
    const course = await tx.course.findUnique({
      where: { id: courseId },
      select: { timeZone: true, memberships: { where: { userId: user.id, role: "owner", source: "explicit" }, select: { id: true } } }
    });
    if (!course) throw notFound("Course");
    if (!isAdmin(user) && !course.memberships.length) throw forbidden();
    await tx.course.update({ where: { id: courseId }, data: { timeZone: canonical } });
    await tx.courseAuditEvent.create({ data: {
      courseId, actorUserId: user.id, eventType: "course_timezone_updated", targetType: "course", targetId: courseId,
      previousValue: { timeZone: course.timeZone }, nextValue: { timeZone: canonical }
    } });
  });
  return getCourseTimeSettings(user, courseId);
}
