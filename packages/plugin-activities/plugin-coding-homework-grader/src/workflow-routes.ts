import type { PluginRouteDefinition, PluginRouteContext } from "@cognelo/activity-sdk/server";
import { AppError } from "@cognelo/core";
import { resolveOwner, resolveStudentSubmissionScope } from "./routes";
import { getHomeworkWorkflowSettings, updateHomeworkWorkflowSettings, prepareHomeworkMaterial, finishHomeworkMaterialPreparation } from "./workflow-settings";
import { handInHomework, getHomeworkWorkspace, startHomeworkAnswering, getStartedHomeworkQuestions, getFrozenHomeworkFile } from "./hand-in";
import { listHomeworkSubmissions, cancelHomeworkSubmission } from "./submission-management";
import { z } from "zod";
async function teacherScope(context: PluginRouteContext) {
  const owner = await resolveOwner(context);
  if (owner.ownerKind !== "course_activity" || !context.courseId) throw new AppError(400, "COURSE_CONTEXT_REQUIRED", "Configure reference materials and submissions after adding the homework to a course.");
  return { user: context.user, courseId: context.courseId, activityId: context.activity.id };
}
const route = (path: string, value: Omit<PluginRouteDefinition, "path" | "activityTypeKeys">): PluginRouteDefinition => ({ path: `coding-homework-grader/${path}`, activityTypeKeys: ["coding-homework-grader"], ...value });
export const homeworkWorkflowRoutes: PluginRouteDefinition[] = [
  route("workflow-settings", { methods: {
    GET: async ({ context }) => getHomeworkWorkflowSettings(await teacherScope(context)),
    PUT: async ({ context, readJson }) => updateHomeworkWorkflowSettings(await teacherScope(context), await readJson())
  } }),
  route("prepare-material", { methods: { POST: async ({ context, readJson, request }) => {
    const data = z.object({ resourceId: z.string().min(1) }).parse(await readJson());
    return prepareHomeworkMaterial(await teacherScope(context), data.resourceId, request.signal);
  } } }),
  route("prepare-references", { methods: { POST: async ({ context }) => finishHomeworkMaterialPreparation(await teacherScope(context)) } }),
  route("workspace", { learnerAccessPhase: "preparation", methods: { GET: ({ context }) => getHomeworkWorkspace(resolveStudentSubmissionScope(context)) } }),
  route("hand-in", { learnerAccessPhase: "preparation", methods: { POST: async ({ context, readJson }) => handInHomework(resolveStudentSubmissionScope(context), await readJson()) } }),
  route("answering", { learnerAccessPhase: "assessment_start", methods: {
    POST: ({ context }) => startHomeworkAnswering(resolveStudentSubmissionScope(context)),
    GET: ({ context }) => getStartedHomeworkQuestions(resolveStudentSubmissionScope(context))
  } }),
  route("submitted-file", { learnerAccessPhase: "preparation", methods: { GET: ({ context, request }) => getFrozenHomeworkFile(resolveStudentSubmissionScope(context), new URL(request.url).searchParams.get("path") ?? "") } }),
  route("manage-submissions", { methods: {
    GET: async ({ context }) => { if (!context.courseId) throw new AppError(400, "COURSE_CONTEXT_REQUIRED", "A course is required."); return listHomeworkSubmissions({ user: context.user, courseId: context.courseId, activityId: context.activity.id }, context.groupId); },
    DELETE: async ({ context, readJson }) => { if (!context.courseId) throw new AppError(400, "COURSE_CONTEXT_REQUIRED", "A course is required."); return cancelHomeworkSubmission({ user: context.user, courseId: context.courseId, activityId: context.activity.id }, await readJson()); }
  } })
];
