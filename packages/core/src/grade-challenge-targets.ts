import { createHash } from "node:crypto";

type ChallengeableGrade = {
  id: string;
  rawScore: number;
  rawMaxScore: number;
  normalizedScore: number;
  normalizedMaxScore: number;
  source: string;
  gradedAt: Date;
  normalizedResult: unknown;
};

export function gradeChallengeTargetForGrade(grade: ChallengeableGrade) {
  const feedbackHash = createHash("sha256").update(stableJson({
    id: grade.id,
    rawScore: grade.rawScore,
    rawMaxScore: grade.rawMaxScore,
    normalizedScore: grade.normalizedScore,
    normalizedMaxScore: grade.normalizedMaxScore,
    source: grade.source,
    gradedAt: grade.gradedAt.toISOString(),
    normalizedResult: grade.normalizedResult
  })).digest("hex");

  return {
    feedbackRef: `grade:${grade.id}:${feedbackHash.slice(0, 24)}`,
    feedbackVersion: 1,
    feedbackHash
  };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
