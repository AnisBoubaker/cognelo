import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const renderersSource = readFileSync("apps/web/src/lib/activity-renderers.tsx", "utf8");
const testRuntimeSource = readFileSync("apps/web/src/components/test-activity-view.tsx", "utf8");

describe("activity response draft wiring", () => {
  it("wires standalone MCQ, coding, and web-design work to the response draft host", () => {
    expect(renderersSource).toContain("createStandaloneActivityDraftHost");
    expect(renderersSource).toContain("saveActivityResponseDraft");
    expect(renderersSource).toContain("executionStateHost={executionStateHost}");
    expect(renderersSource).toContain("responseDraftHost.save({ answers })");
  });

  it("keeps compound Test autosave on the Test item state path", () => {
    expect(testRuntimeSource).toContain("saveQueueRef");
    expect(testRuntimeSource).toContain("api.saveTestItemState");
    expect(testRuntimeSource).not.toContain("ActivityResponseDraft");
    expect(testRuntimeSource).not.toContain("activityResponseDraft");
    expect(renderersSource).toContain("await executionHost.save({ answers })");
    expect(renderersSource).toContain("autosaveDelayMs={0}");
    expect(renderersSource).toContain("executionStateHost={executionHost}");
  });
});
