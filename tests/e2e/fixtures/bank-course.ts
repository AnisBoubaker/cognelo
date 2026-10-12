import type { APIRequestContext } from "@playwright/test";
import { createAuthenticatedApi, test as base } from "./auth";
import {
  copyAndAssignBankActivity,
  provisionActivitySuite,
  removeActivitySuite,
  responseJson,
  type ActivitySuiteData,
  type AssignedActivity
} from "./activity-suite";

export const ORIGINAL_SOURCE = "## Addition\nWhat is two plus two?\n\n- [x] Four\n- [ ] Five";

type BankCourse = ActivitySuiteData & AssignedActivity & {
  bankActivityId: string;
  bankActivityPath: string;
  courseActivityPath: string;
  editorPath: string;
};

export const test = base.extend<{ teacherApi: APIRequestContext; bankCourse: BankCourse }>({
  teacherApi: async ({}, provide) => {
    const api = await createAuthenticatedApi("teacher");
    try {
      await provide(api);
    } finally {
      await api.dispose();
    }
  },
  bankCourse: async ({ teacherApi }, provide) => {
    const data = await provisionActivitySuite();
    try {
      const title = `E2E regression MCQ ${data.token}`;
      const { activity } = await responseJson<{ activity: { id: string } }>(
        await teacherApi.post(`/api/activity-banks/${data.activityBankId}/activities`, {
          data: {
            activityTypeKey: "mcq",
            title,
            description: "Choose the correct result.",
            lifecycle: "published",
            config: {
              source: ORIGINAL_SOURCE,
              aiGenerationInstructions: "",
              aiQuestionCount: 1,
              defaultCodeLanguage: "none",
              randomizeChoices: false,
              aiFeedbackEnabled: false,
              aiFeedbackInstructions: ""
            },
            metadata: { e2e: true },
            position: 0
          }
        })
      );
      const assigned = await copyAndAssignBankActivity(data, {
        activityTypeKey: "mcq",
        bankActivityId: activity.id,
        title
      });
      await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/content/activities`, {
        data: { activityId: assigned.activityId, parentId: null, titleSnapshot: title, isVisible: true, position: 0, metadata: {} }
      }));
      await provide({
        ...data,
        ...assigned,
        bankActivityId: activity.id,
        bankActivityPath: `/api/activity-banks/${data.activityBankId}/activities/${activity.id}`,
        courseActivityPath: `/api/courses/${data.courseId}/activities/${assigned.activityId}`,
        editorPath: `/courses/${data.courseId}/activities/${assigned.activityId}`
      });
    } finally {
      await removeActivitySuite(data);
    }
  }
});

export { expect } from "./auth";
