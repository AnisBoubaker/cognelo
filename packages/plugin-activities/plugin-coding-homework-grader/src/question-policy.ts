/** Missing values preserve the existing challenge workflow. */
export function homeworkQuestionsEnabled(settings: unknown) {
  return !(settings && typeof settings === "object" && !Array.isArray(settings) && (settings as Record<string, unknown>).questionGenerationEnabled === false);
}
