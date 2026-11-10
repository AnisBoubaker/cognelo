import type { PluginRouteDefinition, PluginRouteContext } from "@cognelo/activity-sdk/server";
import { AppError } from "@cognelo/core";
import { resolveOwner, resolveStudentSubmissionScope } from "./routes";
import { getHomeworkWorkflowSettings, updateHomeworkWorkflowSettings, prepareHomeworkMaterial, finishHomeworkMaterialPreparation, getHomeworkReferencePreview } from "./workflow-settings";
import { handInHomework, getHomeworkWorkspace, startHomeworkAnswering, getStartedHomeworkQuestions, getFrozenHomeworkFile } from "./hand-in";
import { listHomeworkSubmissions, cancelHomeworkSubmission } from "./submission-management";
import { z } from "zod";
import { downloadSubmittedHomework, checkSubmittedHomework } from "./submitted-work";
async function teacherScope(context: PluginRouteContext) {
  const owner = await resolveOwner(context);
  if (owner.ownerKind !== "course_activity" || !context.courseId) throw new AppError(400, "COURSE_CONTEXT_REQUIRED", "Configure reference materials and submissions after adding the homework to a course.");
  return { user: context.user, courseId: context.courseId, activityId: context.activity.id };
}
const route = (path: string, value: Omit<PluginRouteDefinition, "path" | "activityTypeKeys">): PluginRouteDefinition => ({ path: `coding-homework-grader/${path}`, activityTypeKeys: ["coding-homework-grader"], ...value });
export const homeworkWorkflowRoutes: PluginRouteDefinition[] = [
  route("simulation", { methods: { POST: async ({ context, readJson, request }) => (await import("./simulation")).simulateHomeworkQuestions(await teacherScope(context), await readJson(), request.signal) } }),
  route("workflow-settings", { methods: {
    GET: async ({ context }) => getHomeworkWorkflowSettings(await teacherScope(context)),
    PUT: async ({ context, readJson }) => updateHomeworkWorkflowSettings(await teacherScope(context), await readJson())
  } }),
  route("reference-preview", { methods: { GET: async ({ context, request }) => getHomeworkReferencePreview(await teacherScope(context), Object.fromEntries(new URL(request.url).searchParams)) } }),
  route("prepare-material", { methods: { POST: async ({ context, readJson, request }) => {
    const data = z.object({ resourceId: z.string().min(1) }).parse(await readJson());
    return prepareHomeworkMaterial(await teacherScope(context), data.resourceId, request.signal);
  } } }),
  route("prepare-references", { methods: { POST: async ({ context }) => finishHomeworkMaterialPreparation(await teacherScope(context)) } }),
  route("workspace", { learnerAccessPhase: "preparation", methods: { GET: ({ context }) => getHomeworkWorkspace(resolveStudentSubmissionScope(context)) } }),
  route("hand-in", { learnerAccessPhase: "preparation", submissionStageId: "files", methods: { POST: async ({ context, readJson }) => handInHomework(resolveStudentSubmissionScope(context), await readJson()) } }),
  route("answering", { learnerAccessPhase: "assessment_start", submissionStageId: "questions", methods: {
    POST: async ({ context, readJson }) => { const data = z.object({ submissionId: z.string().nullable().optional() }).parse(await readJson()); return startHomeworkAnswering(resolveStudentSubmissionScope(context), data.submissionId); },
    GET: ({ context }) => getStartedHomeworkQuestions(resolveStudentSubmissionScope(context))
  } }),
  route("submitted-file", { learnerAccessPhase: "preparation", methods: { GET: ({ context, request }) => getFrozenHomeworkFile(resolveStudentSubmissionScope(context), new URL(request.url).searchParams.get("path") ?? "") } }),
  route("submitted-download", { learnerAccessPhase: "preparation", methods: { GET: ({ context, request }) => downloadSubmittedHomework(resolveStudentSubmissionScope(context), new URL(request.url).searchParams.get("submissionId"), request.signal) } }),
  route("submitted-check", { learnerAccessPhase: "preparation", methods: { POST: async ({ context, readJson }) => {
    const data = z.object({ submissionId: z.string().optional() }).parse(await readJson());
    return checkSubmittedHomework(resolveStudentSubmissionScope(context), data.submissionId);
  } } }),
  route("manage-submissions", { methods: {
    GET: async ({ context, request }) => { if (!context.courseId) throw new AppError(400, "COURSE_CONTEXT_REQUIRED", "A course is required."); return listHomeworkSubmissions({ user: context.user, courseId: context.courseId, activityId: context.activity.id }, context.groupId, new URL(request.url).searchParams.get("recoverAutomatic") === "1"); },
    DELETE: async ({ context, readJson }) => { if (!context.courseId) throw new AppError(400, "COURSE_CONTEXT_REQUIRED", "A course is required."); return cancelHomeworkSubmission({ user: context.user, courseId: context.courseId, activityId: context.activity.id }, await readJson()); },
    POST: async ({ context, readJson }) => {
      if (!context.courseId) throw new AppError(400, "COURSE_CONTEXT_REQUIRED", "A course is required.");
      const data = z.object({ submissionId: z.string().min(1), reason: z.string().trim().min(1).max(2000), action: z.literal("reset-challenges") }).strict().parse(await readJson());
      return (await import("./team-management")).resetHomeworkStudentChallenges({ user: context.user, courseId: context.courseId, activityId: context.activity.id }, data.submissionId, data.reason);
    }
  } })
];
