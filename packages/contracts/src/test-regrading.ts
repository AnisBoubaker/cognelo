export type TestRegradeProgress = {
  completed: number;
  total: number;
  activityTitle: string | null;
};

export type TestRegradeItemResult = {
  testItemId: string;
  title: string;
  status: "graded" | "pending" | "failed";
  message?: string;
};
