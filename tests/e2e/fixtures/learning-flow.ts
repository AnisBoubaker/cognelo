import { prisma } from "@cognelo/db";
import type { APIRequestContext, APIResponse } from "@playwright/test";
import { createAuthenticatedApi, credentialsFor } from "./auth";

export type LearningFlowData = {
  activityId: string;
  activityTitle: string;
  courseId: string;
  courseTitle: string;
  groupId: string;
  groupTitle: string;
};

async function responseJson<T>(response: APIResponse): Promise<T> {
  if (!response.ok()) {
    throw new Error(`E2E data request failed: ${response.request().method()} ${response.url()} -> ${response.status()} ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

export async function provisionLearningFlow(): Promise<LearningFlowData> {
  const api = await createAuthenticatedApi("teacher");
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const courseTitle = `E2E critical learning flow ${token}`;
  const groupTitle = `E2E Section ${token}`;
  const activityTitle = `E2E summative knowledge check ${token}`;

  try {
    const { subjects } = await responseJson<{ subjects: Array<{ id: string }> }>(
      await api.get("/api/subjects")
    );
    if (!subjects[0]) {
      throw new Error("The E2E suite requires at least one seeded subject.");
    }

    const { course } = await responseJson<{ course: { id: string } }>(
      await api.post("/api/courses", {
        data: {
          subjectId: subjects[0].id,
          title: courseTitle,
          description: "Disposable course created by the Playwright critical-flow suite.",
          status: "published"
        }
      })
    );
    const { group } = await responseJson<{ group: { id: string } }>(
      await api.post(`/api/courses/${course.id}/groups`, { data: { title: groupTitle } })
    );
    await responseJson(
      await api.patch(`/api/courses/${course.id}/groups/${group.id}`, {
        data: { status: "published", availableFrom: null, availableUntil: null }
      })
    );
    await responseJson(
      await api.post(`/api/courses/${course.id}/groups/${group.id}/participants`, {
        data: { email: credentialsFor("student").email, role: "student" }
      })
    );

    const { activity } = await responseJson<{ activity: { id: string } }>(
      await api.post(`/api/courses/${course.id}/activities`, {
        data: {
          activityTypeKey: "mcq",
          title: activityTitle,
          description: "Choose the correct result.",
          lifecycle: "published",
          config: {
            source: [
              "## Addition check",
              "What is two plus two?",
              "",
              "- [x] Four",
              "- [ ] Five"
            ].join("\n"),
            aiGenerationInstructions: "",
            aiQuestionCount: 5,
            defaultCodeLanguage: "none",
            randomizeChoices: false
          },
          metadata: {},
          position: 0
        }
      })
    );
    await responseJson(
      await api.post(`/api/courses/${course.id}/groups/${group.id}/activities`, {
        data: {
          activityId: activity.id,
          availableFrom: null,
          availableUntil: null,
          config: {},
          metadata: { assessmentMode: "summative" },
          gradebookSettings: {
            pointsPossible: 10,
            attemptLimitMode: "max_attempts",
            maxAttempts: 1,
            gradeStrategy: "latest"
          },
          position: 0,
          contentPlacement: {
            parentId: null,
            titleSnapshot: activityTitle,
            isVisible: true,
            position: 0,
            metadata: { e2e: true }
          }
        }
      })
    );

    return {
      activityId: activity.id,
      activityTitle,
      courseId: course.id,
      courseTitle,
      groupId: group.id,
      groupTitle
    };
  } finally {
    await api.dispose();
  }
}

export async function removeLearningFlow(data: LearningFlowData | undefined) {
  if (!data) return;
  await prisma.course.deleteMany({ where: { id: data.courseId } });
}
