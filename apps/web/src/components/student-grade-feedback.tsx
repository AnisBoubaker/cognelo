import type { StudentGradeFeedback } from "@/lib/api";
import { StudentFeedbackDetails } from "./student-feedback-details";
import { TestGradeBreakdown } from "./test-grade-breakdown";

export function StudentGradeFeedbackView(props: {
  feedback: StudentGradeFeedback | null;
  maxScore: number;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return <div className="stack">
    <StudentFeedbackDetails {...props} />
    <TestGradeBreakdown feedback={props.feedback} heading={props.t("groupPage.gradingBreakdownTitle")} />
  </div>;
}
