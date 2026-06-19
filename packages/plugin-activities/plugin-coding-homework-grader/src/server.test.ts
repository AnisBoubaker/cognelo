import { beforeEach, describe, expect, it, vi } from "vitest";

const authoringMocks = vi.hoisted(() => ({
  copyBankCodingHomeworkAuthoringToCourseActivity: vi.fn(),
  deleteBankCodingHomeworkAuthoring: vi.fn()
}));

vi.mock("./authoring", () => authoringMocks);
vi.mock("./routes", () => ({
  codingHomeworkAssignmentPdfRoute: { path: "assignment-pdf", methods: {} },
  codingHomeworkAuthoringRoute: { path: "authoring", methods: {} },
  codingHomeworkChallengeAnswersRoute: { path: "challenge-answers", methods: {} },
  codingHomeworkChallengeGenerationRoute: { path: "challenge-generation", methods: {} },
  codingHomeworkDocumentationExtractionRoute: { path: "documentation-extraction", methods: {} },
  codingHomeworkDocumentationPreviewRoute: { path: "documentation-preview", methods: {} },
  codingHomeworkDocumentationSnapshotRoute: { path: "documentation-snapshot", methods: {} },
  codingHomeworkGradebookAttemptsRoute: { path: "gradebook-attempts", methods: {} },
  codingHomeworkPreflightRoute: { path: "preflight", methods: {} },
  codingHomeworkReprocessRoute: { path: "reprocess", methods: {} },
  codingHomeworkReferenceSearchRoute: { path: "reference-search", methods: {} },
  codingHomeworkRequirementsUploadRoute: { path: "requirements-upload", methods: {} },
  codingHomeworkStudentAssignmentRoute: { path: "assignment", methods: {} },
  codingHomeworkSubmissionAnalysisRoute: { path: "submission-analysis", methods: {} },
  codingHomeworkSubmissionRoute: { path: "submission", methods: {} }
}));

const { codingHomeworkGraderServerPlugin } = await import("./server");

describe("coding homework grader server plugin lifecycle hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("copies bank-owned authoring data when assigned to a course", async () => {
    await codingHomeworkGraderServerPlugin.hooks?.onCourseActivityCreatedFromBankVersion?.({
      user: testUser(),
      courseId: "course-1",
      bankActivityId: "bank-activity-1",
      activityVersionId: "activity-version-1",
      activity: testActivity("coding-homework-grader")
    });

    expect(authoringMocks.copyBankCodingHomeworkAuthoringToCourseActivity).toHaveBeenCalledWith({
      bankActivityId: "bank-activity-1",
      activityId: "activity-1"
    });
  });

  it("deletes bank-owned authoring data when a bank activity is deleted", async () => {
    await codingHomeworkGraderServerPlugin.hooks?.onBankActivityDeleted?.({
      user: testUser(),
      activityBankId: "bank-1",
      bankActivityId: "bank-activity-1",
      activityTypeKey: "coding-homework-grader"
    });

    expect(authoringMocks.deleteBankCodingHomeworkAuthoring).toHaveBeenCalledWith({
      bankActivityId: "bank-activity-1"
    });
  });

  it("ignores lifecycle hooks for other activity types", async () => {
    await codingHomeworkGraderServerPlugin.hooks?.onCourseActivityCreatedFromBankVersion?.({
      user: testUser(),
      courseId: "course-1",
      bankActivityId: "bank-activity-1",
      activityVersionId: "activity-version-1",
      activity: testActivity("mcq")
    });
    await codingHomeworkGraderServerPlugin.hooks?.onBankActivityDeleted?.({
      user: testUser(),
      activityBankId: "bank-1",
      bankActivityId: "bank-activity-1",
      activityTypeKey: "mcq"
    });

    expect(authoringMocks.copyBankCodingHomeworkAuthoringToCourseActivity).not.toHaveBeenCalled();
    expect(authoringMocks.deleteBankCodingHomeworkAuthoring).not.toHaveBeenCalled();
  });
});

function testUser() {
  return {
    id: "user-1",
    email: "teacher@example.test",
    name: null,
    firstName: null,
    lastName: null,
    roles: ["teacher" as const]
  };
}

function testActivity(activityTypeKey: string) {
  return {
    id: "activity-1",
    title: "Activity",
    description: "",
    lifecycle: "draft",
    activityType: {
      key: activityTypeKey,
      name: activityTypeKey,
      description: ""
    }
  };
}
