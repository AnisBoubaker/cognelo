export type WorkInspectionBlock =
  | { kind: "markdown" | "text"; text: string }
  | { kind: "code"; text: string; language?: string }
  | { kind: "file"; key: string; path: string; language?: string };
export type WorkInspectionSection = { id: string; title?: string; blocks: WorkInspectionBlock[] };
export type WorkInspection = {
  activityTitle: string; participantName: string; groupTitle: string;
  attemptNumber: number | null; startedAt: string | null; savedAt: string | null;
  sections: WorkInspectionSection[];
  items?: Array<{ id: string; title: string }>; selectedItemId?: string;
};
export type WorkInspectionFile = { path: string; text: string; truncated: boolean };
