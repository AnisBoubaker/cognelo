import { expect, it } from "vitest";
import { registerActivityPlugin } from "@cognelo/activity-sdk";
import { projectStudentActivity } from "./student-activity";

registerActivityPlugin({ key: "projection-test", name: "Projection test", packageName: "@cognelo/projection-test", db: { namespace: "projection_test", tables: [] },
  activities: [{ key: "projection-test", name: "Projection test", description: "", studentView: { mode: "read_only" },
    studentConfig: (config) => ({ prompt: config.prompt }) }] });

it("only includes allowlisted activity/config fields and excludes nested authoring records", () => {
  const activity = { id: "activity", title: "Title", description: "Prompt", lifecycle: "published",
    activityType: { key: "projection-test", name: "Test", description: "" },
    config: { prompt: "Public", solution: "Private" }, metadata: { private: true },
    bankActivity: { config: { source: "Private" } }, activityVersion: { config: { source: "Private" } },
    activityConfigFingerprint: "private-fingerprint" };
  const projected = projectStudentActivity(activity);
  expect(projected.config).toEqual({ prompt: "Public" });
  expect(JSON.stringify(projected)).not.toMatch(/Private|private|bankActivity|activityVersion|Fingerprint/);
  expect(projectStudentActivity(activity, false)).toMatchObject({ description: "", config: {} });
  expect(projectStudentActivity({ ...activity, activityType: { ...activity.activityType, key: "unknown" } }).config).toEqual({});
});
