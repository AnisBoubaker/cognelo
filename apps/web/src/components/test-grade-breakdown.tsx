import type { StudentGradeFeedback } from "@/lib/api";

type TestBreakdownItem = {
  testItemId: string;
  title: string;
  activityTypeKey: string;
  pointsEarned: number;
  pointsPossible: number;
};

export function TestGradeBreakdown({
  feedback,
  heading,
  compact = false
}: {
  feedback: StudentGradeFeedback | null;
  heading: string;
  compact?: boolean;
}) {
  const items = parseTestBreakdown(feedback);
  if (!items.length) return null;

  return (
    <div className="stack stack-tight test-grade-breakdown">
      <strong>{heading}</strong>
      {items.map((item) => (
        <div className={compact ? "row row-between" : "inline-panel row row-between"} key={item.testItemId}>
          <span>{item.title}</span>
          <strong>{formatNumber(item.pointsEarned)} / {formatNumber(item.pointsPossible)}</strong>
        </div>
      ))}
    </div>
  );
}

export function parseTestBreakdown(feedback: StudentGradeFeedback | null): TestBreakdownItem[] {
  if (feedback?.kind !== "test" || !feedback.details || !Array.isArray(feedback.details.items)) return [];
  return feedback.details.items.flatMap((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const item = value as Record<string, unknown>;
    if (typeof item.pointsEarned !== "number" || typeof item.pointsPossible !== "number") return [];
    return [{
      testItemId: typeof item.testItemId === "string" ? item.testItemId : `item-${index}`,
      title: typeof item.title === "string" ? item.title : `Activity ${index + 1}`,
      activityTypeKey: typeof item.activityTypeKey === "string" ? item.activityTypeKey : "unknown",
      pointsEarned: item.pointsEarned,
      pointsPossible: item.pointsPossible
    }];
  });
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
