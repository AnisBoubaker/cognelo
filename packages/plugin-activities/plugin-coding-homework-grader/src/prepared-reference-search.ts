import { createPreparedActivityReferenceSearch } from "@cognelo/core";
import type { CurrentUser } from "@cognelo/contracts";
export async function createHomeworkReferenceSearch(scope: { user: CurrentUser; courseId: string; groupId?: string }, snapshot: Record<string, unknown>) {
  return createPreparedActivityReferenceSearch(scope, snapshot);
}
