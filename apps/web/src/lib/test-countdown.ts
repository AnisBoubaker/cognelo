export type TestCountdownTone = "normal" | "warning" | "critical";

export function formatRemainingTime(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

export function getTestCountdownTone(
  remainingSeconds: number,
  timeLimitMinutes: number | null | undefined
): TestCountdownTone {
  if (remainingSeconds <= 60) return "critical";

  const totalSeconds = (timeLimitMinutes ?? 0) * 60;
  if (totalSeconds > 0 && remainingSeconds < totalSeconds / 6) return "warning";

  return "normal";
}

export function shouldAutoSubmitTestAttempt(input: {
  attemptId: string | null | undefined;
  lifecycle: string | null | undefined;
  remainingSeconds: number | null;
  resumeBlocked: boolean;
  pendingSaveCount: number;
  busy: boolean;
  autoSubmittedAttemptId: string | null;
}) {
  return Boolean(
    input.attemptId &&
    input.lifecycle === "started" &&
    (input.remainingSeconds === 0 || input.resumeBlocked) &&
    input.autoSubmittedAttemptId !== input.attemptId &&
    input.pendingSaveCount === 0 &&
    !input.busy
  );
}
