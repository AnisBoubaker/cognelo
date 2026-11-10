import type { PluginRouteDefinition } from "@cognelo/activity-sdk/server";
import { getHomeworkPreparation, uploadHomeworkPreparation, removeHomeworkPreparedFile, getHomeworkPreparedFile } from "./file-preparation";
import { getHomeworkTeacherSolution, saveHomeworkTeacherSolution, removeHomeworkTeacherSolution, selectHomeworkFunctionsWithAi } from "./teacher-solution";
import { resolveOwner, resolveStudentSubmissionScope } from "./routes";

export const homeworkPreparationRoute: PluginRouteDefinition = {
  path: "coding-homework-grader/preparation", activityTypeKeys: ["coding-homework-grader"], learnerAccessPhase: "preparation", submissionStageId: "files",
  methods: {
    GET: ({ context }) => getHomeworkPreparation(resolveStudentSubmissionScope(context)),
    POST: async ({ context, readJson }) => uploadHomeworkPreparation(resolveStudentSubmissionScope(context), await readJson()),
    DELETE: async ({ context, readJson }) => removeHomeworkPreparedFile(resolveStudentSubmissionScope(context), await readJson())
  }
};
export const homeworkPreparedFileRoute: PluginRouteDefinition = {
  path: "coding-homework-grader/prepared-file", activityTypeKeys: ["coding-homework-grader"], learnerAccessPhase: "preparation", submissionStageId: "files",
  methods: { GET: ({ context, request }) => getHomeworkPreparedFile(resolveStudentSubmissionScope(context), new URL(request.url).searchParams.get("path") ?? "") }
};
export const homeworkTeacherSolutionRoute: PluginRouteDefinition = {
  path: "coding-homework-grader/teacher-solution", activityTypeKeys: ["coding-homework-grader"],
  methods: { GET: async ({ context }) => getHomeworkTeacherSolution(await resolveOwner(context)),
    PUT: async ({ context, readJson, request }) => saveHomeworkTeacherSolution(await resolveOwner(context), await readJson(), request.signal),
    DELETE: async ({ context, readJson, request }) => removeHomeworkTeacherSolution(await resolveOwner(context), await readJson(), request.signal) }
};
export const homeworkSelectFunctionsRoute: PluginRouteDefinition = {
  path: "coding-homework-grader/select-functions", activityTypeKeys: ["coding-homework-grader"],
  methods: { POST: async ({ context }) => selectHomeworkFunctionsWithAi(context.user, await resolveOwner(context), context.courseId) }
};
