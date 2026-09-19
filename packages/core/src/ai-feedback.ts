import { createHash } from "node:crypto";
import { prisma, type Prisma } from "@cognelo/db";
import type { CurrentUser } from "@cognelo/contracts";
import { assertCanManageCourse } from "./authorization";
import { assertCanViewCourse } from "./authorization";
import { notFound } from "./errors";

type JsonInput = Prisma.InputJsonValue;

export type AiFeedbackResearchEventInput = {
  eventType: string;
  courseId: string;
  groupId?: string | null;
  activityId: string;
  groupActivityId?: string | null;
  gradebookItemId?: string | null;
  participantId?: string | null;
  userId?: string | null;
  attemptId?: string | null;
  actorUserId?: string | null;
  pluginKey: string;
  feedbackRef?: string | null;
  feedbackVersion?: number | null;
  assessmentMode: "formative" | "summative";
  triggerKind: string;
  provider?: string | null;
  model?: string | null;
  rubricVersion?: string | null;
  promptVersion?: string | null;
  schemaVersion?: string | null;
  submissionHash?: string | null;
  feedbackHash?: string | null;
  aiContribution?: number | null;
  outcome?: string | null;
  metadata?: JsonInput;
};

export async function recordAiFeedbackResearchEvent(input: AiFeedbackResearchEventInput) {
  return prisma.aiFeedbackResearchEvent.create({
    data: {
      ...input,
      metadata: input.metadata ?? {}
    }
  });
}

export async function listCourseAiFeedbackResearchEvents(user: CurrentUser, courseId: string) {
  await assertCanManageCourse(user, courseId);
  return prisma.aiFeedbackResearchEvent.findMany({
    where: { courseId },
    orderBy: [{ createdAt: "desc" }]
  });
}

export async function getCourseAssessmentFeedbackPolicy(user: CurrentUser, courseId: string) {
  await assertCanViewCourse(user, courseId);
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { metadata: true } });
  if (!course) throw notFound("Course");
  const metadata = asRecord(course.metadata);
  const aiSettings = asRecord(metadata.aiSettings);
  return {
    enabled: aiSettings.automaticFeedbackEnabled === true && typeof aiSettings.assessmentFeedbackAiAgentConnectionId === "string",
    automaticFeedbackEnabled: aiSettings.automaticFeedbackEnabled === true,
    assessmentFeedbackAiAgentConnectionId: typeof aiSettings.assessmentFeedbackAiAgentConnectionId === "string"
      ? aiSettings.assessmentFeedbackAiAgentConnectionId
      : null
  };
}

export function hashAiFeedbackValue(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
