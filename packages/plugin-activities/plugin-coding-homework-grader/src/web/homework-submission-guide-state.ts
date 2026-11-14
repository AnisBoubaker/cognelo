import type { HomeworkWorkspace } from "./workflow-types";

export function homeworkGuideState(workspace: HomeworkWorkspace, fileClosed: boolean, clock: number) {
  const active = workspace.submission;
  const questionsRequired = active ? active.questionGenerationEnabled !== false : workspace.questionGenerationEnabled !== false;
  const complete = Boolean(active && ["answered", "ready_for_grading", "graded"].includes(active.status));
  const blocked = workspace.teamwork?.canSubmit === false;
  const questionClosed = Boolean(workspace.questionsClosesAt && clock >= Date.parse(workspace.questionsClosesAt));
  return { questionsRequired, complete,
    files: active ? "submitted" : blocked ? "team" : fileClosed ? "closed" : !workspace.submissionsEnabled ? "waiting" : "available",
    questions: complete ? "done" : active?.started ? "active" : blocked ? "team" : questionClosed ? "closed" : workspace.questionsStageEnabled === false ? "waiting"
      : !active ? "next" : active.status === "challenge_ready" ? "ready" : active.processingStatus === "failed" || active.status === "failed" ? "failed" : "generating"
  } as const;
}

