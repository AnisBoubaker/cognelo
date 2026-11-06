import { z } from "zod";

export const homeworkSubmissionPolicySchema = z.object({
  deadline: z.string().datetime({ offset: true }).transform(value => new Date(value).toISOString()).nullable().default(null),
  allowLate: z.boolean().default(false),
  lateLimitMinutes: z.number().int().min(1).max(3650 * 24 * 60).nullable().default(null)
}).strict().superRefine((value, context) => {
  if (!value.deadline && (value.allowLate || value.lateLimitMinutes !== null)) context.addIssue({ code: "custom", path: ["deadline"], message: "Set a submission deadline before allowing late submissions." });
  if (!value.allowLate && value.lateLimitMinutes !== null) context.addIssue({ code: "custom", path: ["lateLimitMinutes"], message: "Enable late submissions before setting a late-submission duration." });
});
export type HomeworkSubmissionPolicy = z.infer<typeof homeworkSubmissionPolicySchema>;
export const defaultHomeworkSubmissionPolicy: HomeworkSubmissionPolicy = { deadline: null, allowLate: false, lateLimitMinutes: null };
export function readHomeworkSubmissionPolicy(settings: unknown): HomeworkSubmissionPolicy {
  const value = settings && typeof settings === "object" && !Array.isArray(settings) ? (settings as Record<string, unknown>).submissionPolicy : undefined;
  return homeworkSubmissionPolicySchema.parse(value ?? {});
}
export function homeworkSubmissionWindow(policy: HomeworkSubmissionPolicy, now: number) {
  const deadline = policy.deadline ? new Date(policy.deadline).getTime() : null;
  const closesAt = deadline === null || (policy.allowLate && policy.lateLimitMinutes === null) ? null : deadline + (policy.allowLate ? policy.lateLimitMinutes! * 60_000 : 0);
  return { isLate: deadline !== null && now >= deadline, closed: closesAt !== null && now >= closesAt, closesAt: closesAt === null ? null : new Date(closesAt).toISOString() };
}
export type HomeworkSubmissionTiming = { deadline: string | null; submittedAt: string; isLate: boolean; lateByMs: number };
export function homeworkSubmissionTiming(policy: HomeworkSubmissionPolicy, now: number): HomeworkSubmissionTiming {
  return { deadline: policy.deadline, submittedAt: new Date(now).toISOString(), isLate: homeworkSubmissionWindow(policy, now).isLate,
    lateByMs: policy.deadline ? Math.max(0, now - new Date(policy.deadline).getTime()) : 0 };
}
export function readHomeworkSubmissionTiming(metadata: unknown): HomeworkSubmissionTiming | null {
  const value = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? (metadata as Record<string, unknown>).submissionTiming : undefined;
  const parsed = z.object({ deadline: z.string().datetime().nullable(), submittedAt: z.string().datetime(), isLate: z.boolean(), lateByMs: z.number().finite().nonnegative() }).safeParse(value);
  return parsed.success ? parsed.data : null;
}
/** Persist exact milliseconds; show whole minutes, or seconds for delays below a minute. */
export function formatHomeworkLateness(milliseconds: number, locale: string) {
  const minutes = Math.floor(Math.max(0, milliseconds) / 60_000);
  const parts = minutes === 0 ? [[Math.floor(Math.max(0, milliseconds) / 1000), "second"]] : [[Math.floor(minutes / 1440), "day"], [Math.floor(minutes % 1440 / 60), "hour"], [minutes % 60, "minute"]].filter(([amount]) => Number(amount) > 0);
  return new Intl.ListFormat(locale, { style: "long", type: "unit" }).format(parts.map(([amount, unit]) => new Intl.NumberFormat(locale, { style: "unit", unit: String(unit), unitDisplay: "long" }).format(Number(amount))));
}
