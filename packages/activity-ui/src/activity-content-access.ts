export const ACTIVITY_CONTENT_CLOSED_EVENT = "cognelo:activity-content-closed";

/** The host has replaced the activity with its receipt; this is not a submission error. */
export function isActivityContentClosedError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ACTIVITY_CONTENT_CLOSED");
}
