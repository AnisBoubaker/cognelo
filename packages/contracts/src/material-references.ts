export type MaterialReferenceRow = { id: string; parentId: string | null; kind: string; title: string; depth: number; resourceId: string | null; hidden: boolean };
export type MaterialReferenceStatus = { state: string; error?: string; maxAgeHours?: number | null; index?: { id: string; documentCount: number } | null };
export type ActivityMaterialReferencesView = {
  rows: MaterialReferenceRow[]; selected: string[]; statuses: Record<string, MaterialReferenceStatus>; prepared: boolean; locked: boolean; revision: string;
  embedding: { identity: string; resolved: { connectionId: string; model: string } | null; error: string | null; preparedModel: string | null; settingsUrl: string };
};
export type CourseMaterialEmbeddingSettingsView = {
  selection: { connectionId: string; model: string } | null; resolved: { connectionId: string; model: string } | null; error: string | null;
  connections: Array<{ id: string; displayName: string; model: string; provider: string; isEnabled: boolean; models?: Array<{ model: string; purpose: "generation" | "embedding" }> }>;
};
