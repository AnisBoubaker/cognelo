export function assignmentAllowsGradeChallenges(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const metadata = value as Record<string, unknown>;
  return metadata.assessmentMode === "summative" && metadata.gradeChallengesEnabled === true;
}
