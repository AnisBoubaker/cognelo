import { z } from "zod";

export const SubmissionStageIdSchema = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
export const SubmissionStagePolicySchema = z.object({
  deadline: z.string().datetime({ offset: true }).nullable(),
  timeLimitMinutes: z.number().int().min(1).max(1440).nullable(),
  allowLate: z.boolean(),
  lateLimitMinutes: z.number().int().min(1).max(3650 * 1440).nullable()
}).strict();
export const SubmissionStagePoliciesSchema = z.record(SubmissionStageIdSchema, SubmissionStagePolicySchema.partial()).refine(value => Object.keys(value).length <= 20, "At most 20 stages are allowed.");
export type SubmissionStagePolicy = z.infer<typeof SubmissionStagePolicySchema>;
export type SubmissionStagePolicies = z.infer<typeof SubmissionStagePoliciesSchema>;
export const defaultSubmissionStagePolicy: SubmissionStagePolicy = { deadline: null, timeLimitMinutes: null, allowLate: false, lateLimitMinutes: null };

export function mergeSubmissionStagePolicies(...sources: Array<SubmissionStagePolicies | undefined>): SubmissionStagePolicies {
  const result: SubmissionStagePolicies = {};
  for (const source of sources) for (const [id, policy] of Object.entries(source ?? {})) result[id] = { ...result[id], ...policy };
  return result;
}
/** Absolute activity closure and stage duration cap every stage, including late work. */
export function submissionStageWindow(policy: SubmissionStagePolicy, availableUntil: string | Date | null, startedAt: string | Date | null = null, now = Date.now()) {
  const ownDue = policy.deadline ? Date.parse(policy.deadline) : null;
  const overall = availableUntil ? new Date(availableUntil).getTime() : null;
  const durationEnd = startedAt && policy.timeLimitMinutes ? new Date(startedAt).getTime() + policy.timeLimitMinutes * 60_000 : null;
  const earliest = (values: Array<number | null>) => { const set = values.filter((v): v is number => v !== null); return set.length ? Math.min(...set) : null; };
  const due = earliest([ownDue, overall]);
  const lateEnd = due === null || policy.allowLate && policy.lateLimitMinutes === null ? null : due + (policy.allowLate ? (policy.lateLimitMinutes ?? 0) * 60_000 : 0);
  const cutoff = earliest([lateEnd, overall, durationEnd]);
  return { deadline: due === null ? null : new Date(due).toISOString(), closesAt: cutoff === null ? null : new Date(cutoff).toISOString(),
    isLate: due !== null && now > due, lateByMs: due === null ? 0 : Math.max(0, now - due), closed: cutoff !== null && now >= cutoff };
}
