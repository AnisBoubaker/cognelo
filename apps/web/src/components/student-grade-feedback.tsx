import type { StudentGradeFeedback } from "@/lib/api";
import { StudentFeedbackDetails } from "./student-feedback-details";
import { TestGradeBreakdown } from "./test-grade-breakdown";
import { HomeworkStudentRubricReport } from "@cognelo/plugin-coding-homework-grader";

export function StudentGradeFeedbackView(props: {
  feedback: StudentGradeFeedback | null;
  maxScore: number;
  locale?: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  if (props.feedback?.kind === "homework_rubric") return <HomeworkStudentRubricReport feedback={props.feedback} locale={props.locale} maxScore={props.maxScore} />;
  return <div className="stack">
    <StudentFeedbackDetails {...props} />
    <TestGradeBreakdown feedback={props.feedback} heading={props.t("groupPage.gradingBreakdownTitle")} />
  </div>;
}
