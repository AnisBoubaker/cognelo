import type { ActivityKnowledgeGenerationRequest, GeneratedKnowledgeSelection } from "@cognelo/activity-ui";

export type McqGenerationInput = {
  description: string;
  defaultCodeLanguage: string;
  instructions?: string;
  locale: "en" | "fr" | "zh" | "ar";
  questionCount: number;
  knowledge: ActivityKnowledgeGenerationRequest;
};

export type McqGenerationResult = {
  source: string;
  attempts: number;
  knowledgeConceptSelections?: GeneratedKnowledgeSelection[];
};

export type McqSubmission = {
  id: string;
  attemptNumber: number;
  lifecycle: string;
  submittedAt: string | null;
  gradedAt: string | null;
  answers: Record<string, string[]>;
};

export type McqSubmissionGrade = {
  rawScore: number;
  rawMaxScore: number;
  normalizedScore?: number;
  normalizedMaxScore?: number;
};

export type McqSubmissionAvailability = {
  canStart: boolean;
  reason: string | null;
  attemptLimitMode: string;
  gradesReleased?: boolean;
  maxAttempts: number | null;
  usedAttempts: number | null;
  attemptsRemaining: number | null;
};

export function deriveMcqStudentAttemptState(input: {
  submission: { answers: McqSubmission["answers"]; lifecycle?: McqSubmission["lifecycle"] } | null;
  draft?: { answers: McqSubmission["answers"] } | null;
  availability: Pick<McqSubmissionAvailability, "canStart">;
}) {
  const completedSubmission = input.submission?.lifecycle !== "started" && Boolean(input.submission);
  const startsFreshAttempt = completedSubmission && input.availability.canStart;

  return {
    answers: input.draft?.answers ?? (startsFreshAttempt ? {} : input.submission?.answers ?? {}),
    submitted: completedSubmission && !startsFreshAttempt,
    completedSubmission
  };
}

export type McqPluginRequest = <T>(path: string, init?: RequestInit) => Promise<T>;

export function createMcqClient(request: McqPluginRequest) {
  return {
    generate: (courseId: string, activityId: string, input: McqGenerationInput) =>
      request<McqGenerationResult>(`/courses/${courseId}/activities/${activityId}/mcq/generate`, {
        method: "POST",
        body: JSON.stringify(input)
      }),
    generateBank: (activityBankId: string, bankActivityId: string, input: McqGenerationInput) =>
      request<McqGenerationResult>(`/activity-banks/${activityBankId}/activities/${bankActivityId}/mcq/generate`, {
        method: "POST",
        body: JSON.stringify(input)
      }),
    submitGroup: (courseId: string, groupId: string, activityId: string, input: { answers: Record<string, string[]> }) =>
      request<{ submission: McqSubmission; result: Record<string, unknown> }>(
        `/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/mcq/submission`,
        {
          method: "POST",
          body: JSON.stringify(input)
        }
      ),
    groupSubmissionStatus: (courseId: string, groupId: string, activityId: string) =>
      request<{
        submission: McqSubmission | null;
        grade: McqSubmissionGrade | null;
        attempts: Array<{ submission: McqSubmission; grade: McqSubmissionGrade }>;
        availability: McqSubmissionAvailability;
      }>(
        `/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/mcq/submission`
      ),
    groupGradebookAttempts: (courseId: string, groupId: string, activityId: string, input: { participantId: string }) => {
      const params = new URLSearchParams({ participantId: input.participantId });
      return request<{
        participant: {
          id: string;
          userId?: string | null;
          firstName: string;
          lastName: string;
          email: string;
        };
        attempts: McqSubmission[];
      }>(`/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/mcq/gradebook-attempts?${params.toString()}`);
    }
  };
}
