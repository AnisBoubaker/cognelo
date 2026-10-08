import type { StudentGradeFeedback } from "./api";

export type CodingRubricCriterion = {
  id: string;
  title: string;
  description: string;
  weightPercent: number;
};

export type CodingRubricResult = {
  criterionId: string;
  scorePercent: number;
};

export type CodingRubricScoreBand<T> = {
  label: string;
  minimum: number;
  maximum: number;
  responses: Array<{ response: T; scorePercent: number }>;
};

const rubricScoreBands = [
  { label: "0–<20%", minimum: 0, maximum: 20 },
  { label: "20–<40%", minimum: 20, maximum: 40 },
  { label: "40–<60%", minimum: 40, maximum: 60 },
  { label: "60–<80%", minimum: 60, maximum: 80 },
  { label: "80–100%", minimum: 80, maximum: 100 }
] as const;

export function codingRubricResultsFromFeedback(feedback: StudentGradeFeedback | null): CodingRubricResult[] {
  const details = toRecord(feedback?.details);
  const criteria = Array.isArray(details.criteria) ? details.criteria : [];
  const results = new Map<string, CodingRubricResult>();
  for (const value of criteria) {
    const criterion = toRecord(value);
    const criterionId = typeof criterion.id === "string"
      ? criterion.id.trim()
      : typeof criterion.criterionId === "string"
        ? criterion.criterionId.trim()
        : "";
    const scorePercent = finitePercent(criterion.scorePercent);
    if (criterionId && scorePercent !== null && !results.has(criterionId)) {
      results.set(criterionId, { criterionId, scorePercent });
    }
  }
  return [...results.values()];
}

export function summarizeCodingRubricCriterion<T extends { rubricResults?: CodingRubricResult[] }>(
  responses: T[],
  criterionId: string
) {
  const scored = responses.flatMap((response) => {
    const result = response.rubricResults?.find((candidate) => candidate.criterionId === criterionId);
    return result ? [{ response, scorePercent: result.scorePercent }] : [];
  });
  const average = scored.length
    ? roundPercent(scored.reduce((total, result) => total + result.scorePercent, 0) / scored.length)
    : null;
  const bands: Array<CodingRubricScoreBand<T>> = rubricScoreBands.map((band, index) => ({
    ...band,
    responses: scored.filter(({ scorePercent }) => Math.min(rubricScoreBands.length - 1, Math.floor(scorePercent / 20)) === index)
  }));
  return { average, count: scored.length, bands };
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function finitePercent(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100
    ? roundPercent(value)
    : null;
}

function roundPercent(value: number) {
  return Math.round(value * 100) / 100;
}
