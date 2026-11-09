import { test, expect } from "./fixtures/bank-course";
import { createCourseActivity, responseJson } from "./fixtures/activity-suite";
import type { CodingHomeworkAuthoringRecord } from "../../packages/plugin-activities/plugin-coding-homework-grader/src/web/client";

test("combined homework settings reject invalid enablement without changing private authoring", async ({ bankCourse: data, teacherApi: api }) => {
  const id = await createCourseActivity(data, { activityTypeKey: "coding-homework-grader", title: "Atomic settings", config: {} });
  const base = `/api/courses/${data.courseId}/activities/${id}/coding-homework-grader`;
  await responseJson(await api.get(`${base}/workflow-settings`));
  const initial = await responseJson<CodingHomeworkAuthoringRecord>(await api.get(`${base}/authoring`));
  const original = await responseJson<CodingHomeworkAuthoringRecord>(await api.put(`${base}/authoring`, { data: { assignment: initial.assignment, requirements: initial.requirements.requirements } }));
  const beforeSchedule = await responseJson(await api.get(`/api/courses/${data.courseId}/activities/${id}/assign-all-groups`));
  const failed = await api.put(`${base}/authoring`, { data: { assignment: { ...original.assignment, generationInstructions: "Must roll back" }, requirements: { ...original.requirements.requirements, requiredFiles: [{ path: "main.c" }] }, workflow: { enabled: true, concurrency: 4, submissionPolicy: { deadline: "2030-01-15T09:30:00.000Z", allowLate: false, lateLimitMinutes: null } } } });
  expect(failed.status()).toBe(409);
  expect(await responseJson(await api.get(`/api/courses/${data.courseId}/activities/${id}/assign-all-groups`))).toEqual(beforeSchedule);
  expect(await responseJson(await api.get(`${base}/authoring`))).toEqual(original);
  const saved = await responseJson<CodingHomeworkAuthoringRecord>(await api.put(`${base}/authoring`, { data: { assignment: { ...original.assignment, settings: { questionGenerationEnabled: false } }, requirements: original.requirements.requirements, workflow: { enabled: true, concurrency: 3 } } }));
  expect(saved.assignment.settings).toMatchObject({ questionGenerationEnabled: false, submissionsEnabled: true, generationConcurrency: 3 });
  // Closing and editing structural requirements are one action as well.
  const closed = await responseJson<CodingHomeworkAuthoringRecord>(await api.put(`${base}/authoring`, { data: { assignment: saved.assignment, requirements: { ...saved.requirements.requirements, requiredFiles: [{ path: "main.c" }] }, workflow: { enabled: false } } }));
  expect(closed.assignment.settings.submissionsEnabled).toBe(false); expect(closed.requirements.requirements.requiredFiles).toEqual([{ path: "main.c" }]);
});
