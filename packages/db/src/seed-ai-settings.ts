function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function connectionChoice(settings: Record<string, unknown>, key: string, seedConnectionId: string) {
  if (Object.prototype.hasOwnProperty.call(settings, key) && settings[key] === null) {
    return null;
  }
  return nonEmptyString(settings[key]) ?? seedConnectionId;
}

/**
 * Supplies usable defaults on a clean development seed without replacing a
 * course model or feedback switch that a teacher has already selected.
 */
export function mergeSeedCourseAiSettings(value: unknown, seedConnectionId: string) {
  const settings = isRecord(value) ? value : {};
  return {
    ...settings,
    studentSupportAiAgentConnectionId: connectionChoice(
      settings,
      "studentSupportAiAgentConnectionId",
      seedConnectionId
    ),
    automaticFeedbackEnabled:
      typeof settings.automaticFeedbackEnabled === "boolean"
        ? settings.automaticFeedbackEnabled
        : true,
    assessmentFeedbackAiAgentConnectionId: connectionChoice(
      settings,
      "assessmentFeedbackAiAgentConnectionId",
      seedConnectionId
    )
  };
}
