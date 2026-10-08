import type { ActivityExecutionStateHost } from "@cognelo/activity-sdk";

const PREFIX = "cognelo:student-preview";

export function createStudentPreviewStateHost<TState extends Record<string, unknown>>(input: {
  courseId: string;
  groupId: string;
  activityId: string;
  sessionId: string;
}): ActivityExecutionStateHost<TState> {
  const key = `${PREFIX}:${input.courseId}:${input.groupId}:${input.sessionId}:${input.activityId}`;
  return {
    context: { kind: "student_preview", previewSessionId: input.sessionId, activityId: input.activityId },
    load: async () => readSessionState<TState>(key),
    save: async (state) => {
      globalThis.sessionStorage?.setItem(key, JSON.stringify(state));
      return state;
    },
    clear: async () => globalThis.sessionStorage?.removeItem(key)
  };
}

export function clearStudentPreviewSession(courseId: string, groupId: string, sessionId: string) {
  const prefix = `${PREFIX}:${courseId}:${groupId}:${sessionId}:`;
  for (let index = globalThis.sessionStorage?.length ?? 0; index-- > 0;) {
    const key = globalThis.sessionStorage?.key(index);
    if (key?.startsWith(prefix)) globalThis.sessionStorage?.removeItem(key);
  }
}

function readSessionState<TState>(key: string): TState | null {
  try {
    const value = globalThis.sessionStorage?.getItem(key);
    return value ? JSON.parse(value) as TState : null;
  } catch {
    return null;
  }
}
