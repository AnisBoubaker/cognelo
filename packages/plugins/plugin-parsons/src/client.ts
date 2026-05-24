import type { ParsonsAttemptEvaluation, ParsonsAttemptState } from "./attempt-types";
import type { ParsonsAttemptRecord, ParsonsGradebookAttemptRecord } from "./attempts";

export type ParsonsGenerationInput = {
  description: string;
  language: string;
  locale: "en" | "fr" | "zh" | "ar";
};

export type ParsonsGenerationResult =
  | {
      status?: "ok" | "warning";
      warningMessage?: string;
      prompt: string;
      solution: string;
      attempts: number;
    }
  | {
      status: "error";
      message: string;
      attempts: number;
    };

type ParsonsAttemptAvailability = {
  canStart: boolean;
  reason: string | null;
};

export type ParsonsPluginRequest = <T>(path: string, init?: RequestInit) => Promise<T>;

export function createParsonsClient(request: ParsonsPluginRequest) {
  return {
    ensureAttempt: (courseId: string, activityId: string, input?: { forceNew?: boolean }) =>
      request<{ attempt: ParsonsAttemptRecord }>(`/courses/${courseId}/activities/${activityId}/parsons/attempt`, {
        method: "POST",
        body: JSON.stringify(input ?? {})
      }),
    updateAttempt: (
      courseId: string,
      activityId: string,
      input: {
        attemptId: string;
        state?: ParsonsAttemptState;
        event?: { type: "move" | "indent" | "reset" | "check" | "submit"; payload?: Record<string, unknown> };
        result?: ParsonsAttemptEvaluation;
        submit?: boolean;
        complete?: boolean;
        abandon?: boolean;
      }
    ) =>
      request<{ attempt: ParsonsAttemptRecord }>(`/courses/${courseId}/activities/${activityId}/parsons/attempt`, {
        method: "PATCH",
        body: JSON.stringify(input)
      }),
    generate: (courseId: string, activityId: string, input: ParsonsGenerationInput) =>
      request<ParsonsGenerationResult>(`/courses/${courseId}/activities/${activityId}/parsons/generate`, {
        method: "POST",
        body: JSON.stringify(input)
      }),
    generateBank: (activityBankId: string, bankActivityId: string, input: ParsonsGenerationInput) =>
      request<ParsonsGenerationResult>(`/activity-banks/${activityBankId}/activities/${bankActivityId}/parsons/generate`, {
        method: "POST",
        body: JSON.stringify(input)
      }),
    ensureGroupAttempt: (courseId: string, groupId: string, activityId: string, input?: { forceNew?: boolean }) =>
      request<{ attempt: ParsonsAttemptRecord; attemptAvailability?: ParsonsAttemptAvailability }>(`/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/parsons/attempt`, {
        method: "POST",
        body: JSON.stringify(input ?? {})
      }),
    updateGroupAttempt: (
      courseId: string,
      groupId: string,
      activityId: string,
      input: {
        attemptId: string;
        state?: ParsonsAttemptState;
        event?: { type: "move" | "indent" | "reset" | "check" | "submit"; payload?: Record<string, unknown> };
        result?: ParsonsAttemptEvaluation;
        submit?: boolean;
        complete?: boolean;
        abandon?: boolean;
      }
    ) =>
      request<{ attempt: ParsonsAttemptRecord }>(`/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/parsons/attempt`, {
        method: "PATCH",
        body: JSON.stringify(input)
      }),
    groupSubmissions: (courseId: string, groupId: string, activityId: string) =>
      request<{
        submissions: Array<{
          attempt: ParsonsGradebookAttemptRecord;
          grade: {
            rawScore: number;
            rawMaxScore: number;
            normalizedScore: number;
            normalizedMaxScore: number;
          } | null;
        }>;
      }>(`/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/parsons/submissions`),
    groupGradebookAttempts: (
      courseId: string,
      groupId: string,
      activityId: string,
      input: { participantId: string; includeAttempts?: boolean }
    ) => {
      const params = new URLSearchParams({ participantId: input.participantId });
      if (input.includeAttempts) {
        params.set("includeAttempts", "true");
      }
      return request<{
        participant: {
          id: string;
          userId?: string | null;
          firstName: string;
          lastName: string;
          email: string;
        };
        attempts: ParsonsGradebookAttemptRecord[];
      }>(`/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/parsons/gradebook-attempts?${params.toString()}`);
    }
  };
}
