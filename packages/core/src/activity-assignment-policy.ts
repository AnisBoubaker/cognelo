export type AssignmentAssessmentPolicyMode = "formative" | "formative_ai" | "summative";

/** Messaging is a course-activity setting, shared by every section and attempt. */
export function courseActivityMessagingEnabled(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const rule = (value as Record<string, unknown>).allGroupsAssignment;
  return Boolean(rule && typeof rule === "object" && !Array.isArray(rule)
    && (rule as Record<string, unknown>).messagingEnabled === true);
}

export function assignmentAssessmentPolicyMode(value: unknown): AssignmentAssessmentPolicyMode {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "formative";
  }
  const mode = (value as Record<string, unknown>).assessmentMode;
  if (mode === "summative" || mode === "formative_ai") return mode;
  return "formative";
}

export function assignmentUsesAutomaticAiFeedback(value: unknown) {
  return assignmentAssessmentPolicyMode(value) === "formative_ai";
}

export function assignmentAllowsGradeChallenges(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const metadata = value as Record<string, unknown>;
  return metadata.assessmentMode === "summative" && metadata.gradeChallengesEnabled === true;
}

export function assignmentTimeLimitMinutes(value: unknown): number | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const timeLimitMinutes = (value as Record<string, unknown>).timeLimitMinutes;
  return typeof timeLimitMinutes === "number" && Number.isInteger(timeLimitMinutes) && timeLimitMinutes > 0 && timeLimitMinutes <= 1440
    ? timeLimitMinutes
    : null;
}

export function withCourseActivityTimeLimitDefault(
  value: unknown,
  timeLimitMinutes: number | null | undefined
) {
  const metadata = value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
  const currentRule = metadata.allGroupsAssignment && typeof metadata.allGroupsAssignment === "object" && !Array.isArray(metadata.allGroupsAssignment)
    ? { ...(metadata.allGroupsAssignment as Record<string, unknown>) }
    : {};
  return {
    ...metadata,
    allGroupsAssignment: {
      ...currentRule,
      timeLimitMinutes: typeof timeLimitMinutes === "number" && Number.isInteger(timeLimitMinutes) && timeLimitMinutes > 0 && timeLimitMinutes <= 1440
        ? timeLimitMinutes
        : null
    }
  };
}
