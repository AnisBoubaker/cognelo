import { describe, expect, it, vi } from "vitest";
import { createStandaloneActivityDraftHost } from "./activity-response-draft-host";

describe("standalone activity response draft host", () => {
  it("loads, saves, and clears through the standalone context", async () => {
    const client = {
      load: vi.fn().mockResolvedValue({ answers: { q1: ["a"] } }),
      save: vi.fn(async (state) => state),
      clear: vi.fn().mockResolvedValue(undefined)
    };
    const host = createStandaloneActivityDraftHost({ groupActivityId: "group-activity-1", client });

    await expect(host.load()).resolves.toEqual({ answers: { q1: ["a"] } });
    await expect(host.save({ sourceCode: "saved" })).resolves.toEqual({ sourceCode: "saved" });
    await expect(host.clear?.()).resolves.toBeUndefined();
    expect(host.context).toEqual({
      kind: "standalone",
      groupActivityId: "group-activity-1",
      activityAttemptId: null
    });
  });

  it("serializes saves so an older request cannot finish after a newer response", async () => {
    const callOrder: string[] = [];
    let releaseFirst: (() => void) | undefined;
    const firstPending = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const client = {
      load: vi.fn().mockResolvedValue(null),
      save: vi.fn(async (state: Record<string, unknown>) => {
        const value = String(state.value);
        callOrder.push(`start:${value}`);
        if (value === "first") await firstPending;
        callOrder.push(`finish:${value}`);
        return state;
      }),
      clear: vi.fn().mockResolvedValue(undefined)
    };
    const host = createStandaloneActivityDraftHost({ groupActivityId: "group-activity-1", client });

    const first = host.save({ value: "first" });
    const second = host.save({ value: "second" });
    await Promise.resolve();
    expect(callOrder).toEqual(["start:first"]);
    releaseFirst?.();
    await Promise.all([first, second]);
    expect(callOrder).toEqual(["start:first", "finish:first", "start:second", "finish:second"]);
  });
});
