import type { ActivityExecutionStateHost } from "@cognelo/activity-sdk";

export type ActivityResponseDraftClient = {
  load: () => Promise<Record<string, unknown> | null>;
  save: (state: Record<string, unknown>) => Promise<Record<string, unknown>>;
  clear: () => Promise<void>;
};

export function createStandaloneActivityDraftHost(input: {
  groupActivityId: string;
  client: ActivityResponseDraftClient;
}): ActivityExecutionStateHost<Record<string, unknown>> {
  let saveQueue = Promise.resolve();

  function enqueue<T>(operation: () => Promise<T>) {
    const result = saveQueue.then(operation, operation);
    saveQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  return {
    context: {
      kind: "standalone",
      groupActivityId: input.groupActivityId,
      activityAttemptId: null
    },
    load: input.client.load,
    save: (state) => enqueue(() => input.client.save(state)),
    clear: () => enqueue(input.client.clear)
  };
}
