import type { StudentGradeFeedback } from "./api";

type GradeChallengeStatus = "open" | "upheld" | "adjusted";

export type GradeChallengeReference = {
  feedbackRef: string;
  feedbackVersion: number;
  label: string | null;
};

export function getGradeChallengeReferences(
  feedback: StudentGradeFeedback | null | undefined,
  gradeTarget: { feedbackRef: string; feedbackVersion: number } | null | undefined,
  finalGradeLabel: string
): GradeChallengeReference[] {
  const feedbackReferences = readFeedbackReferences(feedback);
  const references = gradeTarget
    ? [...feedbackReferences, { ...gradeTarget, label: finalGradeLabel }]
    : feedbackReferences;
  return references.filter((reference, index) => references.findIndex(
    (candidate) => candidate.feedbackRef === reference.feedbackRef && candidate.feedbackVersion === reference.feedbackVersion
  ) === index);
}

export function selectVisibleGradeChallenges<T extends { status: GradeChallengeStatus }>(
  challenges: readonly T[],
  showResolved: boolean
) {
  return challenges
    .filter((challenge) => showResolved || challenge.status === "open")
    .map((challenge, index) => ({ challenge, index }))
    .sort((left, right) => {
      const statusOrder = Number(left.challenge.status !== "open") - Number(right.challenge.status !== "open");
      return statusOrder || left.index - right.index;
    })
    .map(({ challenge }) => challenge);
}

function readFeedbackReferences(feedback: StudentGradeFeedback | null | undefined): GradeChallengeReference[] {
  if (!feedback?.details) return [];
  if (feedback.kind === "test" && Array.isArray(feedback.details.items)) {
    return feedback.details.items.flatMap((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const itemRecord = item as Record<string, unknown>;
      const itemFeedback = itemRecord.feedback;
      if (!itemFeedback || typeof itemFeedback !== "object" || Array.isArray(itemFeedback)) return [];
      const aiFeedback = (itemFeedback as Record<string, unknown>).aiFeedback;
      if (!aiFeedback || typeof aiFeedback !== "object" || Array.isArray(aiFeedback)) return [];
      const nested = aiFeedback as Record<string, unknown>;
      if (typeof nested.feedbackRef === "string" && typeof nested.feedbackVersion === "number" && nested.challengeAllowed === true) {
        return [{
          feedbackRef: nested.feedbackRef,
          feedbackVersion: nested.feedbackVersion,
          label: typeof itemRecord.title === "string" ? itemRecord.title : null
        }];
      }
      return [];
    });
  }
  const feedbackRef = feedback.details.feedbackRef;
  const feedbackVersion = feedback.details.feedbackVersion;
  const challengeAllowed = feedback.details.challengeAllowed === true
    || feedback.details.feedbackOrigin === "teacher"
    || feedback.details.authoredByTeacher === true;
  return typeof feedbackRef === "string" && typeof feedbackVersion === "number" && challengeAllowed === true
    ? [{ feedbackRef, feedbackVersion, label: null }]
    : [];
}
