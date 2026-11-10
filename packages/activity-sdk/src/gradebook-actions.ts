import type { CurrentUser } from "@cognelo/contracts";
import type { PluginLocale } from "./index";
import type { ServerActivityRecord } from "./server";

/** Public, activity-owned actions. The gradebook does not interpret plugin data. */
export type GradebookActionDefinition = {
  id: string;
  kind: "download";
  scope: "participant" | "activity";
  labels: Record<PluginLocale, string>;
};
export type GradebookActionParticipant = {
  participantId: string;
  groupId: string;
  userId: string | null;
  name: string;
  groupTitle: string;
};
export type GradebookActionContext = {
  user: CurrentUser;
  courseId: string;
  activity: ServerActivityRecord;
  /** Authorized current enrollments selected by core; never client-supplied user IDs. */
  participants: readonly GradebookActionParticipant[];
  signal?: AbortSignal;
};
export type GradebookActionService = {
  activityTypeKeys: readonly string[];
  /** Eligible enrollment IDs for each declared action, including deferred hand-ins without attempts. */
  availability: (context: GradebookActionContext) => Promise<Record<string, readonly string[]>>;
  execute: (context: GradebookActionContext & { actionId: string }) => Promise<Response>;
};
