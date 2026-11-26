/** Data-only print blocks shared by activity and material exporters. */
export type ExportDocumentBlock =
  | { kind: "markdown"; text: string; title?: string }
  | { kind: "code"; text: string; title?: string; language?: string }
  | { kind: "table"; headers: string[]; rows: string[][]; title?: string }
  | { kind: "link"; url: string; text?: string; title?: string; description?: string };
