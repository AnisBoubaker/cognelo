import { describe, expect, it } from "vitest";
import { mergeSeedCourseAiSettings } from "./seed-ai-settings";

describe("development seed course AI settings", () => {
  it("provides the seed connection and enables feedback on a clean course", () => {
    expect(mergeSeedCourseAiSettings(undefined, "seed-connection")).toEqual({
      studentSupportAiAgentConnectionId: "seed-connection",
      automaticFeedbackEnabled: true,
      assessmentFeedbackAiAgentConnectionId: "seed-connection"
    });
  });

  it("preserves teacher-selected connections and an explicit disabled switch", () => {
    expect(mergeSeedCourseAiSettings({
      studentSupportAiAgentConnectionId: "support-connection",
      automaticFeedbackEnabled: false,
      assessmentFeedbackAiAgentConnectionId: "teacher-feedback-connection",
      futureSetting: "preserved"
    }, "seed-connection")).toEqual({
      studentSupportAiAgentConnectionId: "support-connection",
      automaticFeedbackEnabled: false,
      assessmentFeedbackAiAgentConnectionId: "teacher-feedback-connection",
      futureSetting: "preserved"
    });
  });

  it("preserves an explicit choice to leave both connections unselected", () => {
    expect(mergeSeedCourseAiSettings({
      studentSupportAiAgentConnectionId: null,
      automaticFeedbackEnabled: false,
      assessmentFeedbackAiAgentConnectionId: null
    }, "seed-connection")).toEqual({
      studentSupportAiAgentConnectionId: null,
      automaticFeedbackEnabled: false,
      assessmentFeedbackAiAgentConnectionId: null
    });
  });
});
