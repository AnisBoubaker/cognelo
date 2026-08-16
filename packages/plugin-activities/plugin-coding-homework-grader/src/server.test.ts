import { beforeEach, describe, expect, it, vi } from "vitest";

const authoringMocks = vi.hoisted(() => ({
  copyBankCodingHomeworkAuthoring: vi.fn(),
  copyBankCodingHomeworkAuthoringToCourseActivity: vi.fn(),
  copyCourseCodingHomeworkAuthoring: vi.fn(),
  deleteCourseCodingHomeworkData: vi.fn(),
  deleteBankCodingHomeworkAuthoring: vi.fn()
}));
const deletionMocks = vi.hoisted(() => ({
  markCodingHomeworkSubmissionDeleted: vi.fn()
}));

vi.mock("./authoring", () => authoringMocks);
vi.mock("./submission-deletion", () => deletionMocks);
vi.mock("./routes", () => ({
  codingHomeworkAssignmentPdfRoute: { path: "assignment-pdf", methods: {} },
  codingHomeworkActivityFileRoute: { path: "activity-file", methods: {} },
  codingHomeworkAuthoringRoute: { path: "authoring", methods: {} },
  codingHomeworkChallengeAnswersRoute: { path: "challenge-answers", methods: {} },
  codingHomeworkChallengeGenerationRoute: { path: "challenge-generation", methods: {} },
  codingHomeworkDocumentationExtractionRoute: { path: "documentation-extraction", methods: {} },
  codingHomeworkDocumentationPreviewRoute: { path: "documentation-preview", methods: {} },
  codingHomeworkDocumentationSnapshotRoute: { path: "documentation-snapshot", methods: {} },
  codingHomeworkGradebookAttemptsRoute: { path: "gradebook-attempts", methods: {} },
  codingHomeworkPreflightRoute: { path: "preflight", methods: {} },
  codingHomeworkProvidedFilesRoute: { path: "provided-files", methods: {} },
  codingHomeworkProcessingJobRoute: { path: "processing-job", methods: {} },
  codingHomeworkReprocessRoute: { path: "reprocess", methods: {} },
  codingHomeworkReferenceSearchRoute: { path: "reference-search", methods: {} },
  codingHomeworkRequirementsUploadRoute: { path: "requirements-upload", methods: {} },
  codingHomeworkStudentAssignmentRoute: { path: "assignment", methods: {} },
  codingHomeworkSubmissionAnalysisRoute: { path: "submission-analysis", methods: {} },
  codingHomeworkSubmissionRoute: { path: "submission", methods: {} }
}));
vi.mock("./background-processing", () => ({
  registerCodingHomeworkBackgroundJobs: vi.fn(),
  startCodingHomeworkProcessingWorker: vi.fn()
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

  it("copies private bank authoring data when a bank activity is duplicated", async () => {
    await codingHomeworkGraderServerPlugin.hooks?.onBankActivityDuplicated?.({ user: testUser(), activityBankId: "bank-1", sourceBankActivityId: "source-1", bankActivityId: "copy-1", activityTypeKey: "coding-homework-grader" });
    expect(authoringMocks.copyBankCodingHomeworkAuthoring).toHaveBeenCalledWith({ sourceBankActivityId: "source-1", bankActivityId: "copy-1" });
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

  it("marks the plugin submission deleted when a core gradebook attempt is deleted", async () => {
    await codingHomeworkGraderServerPlugin.hooks?.onActivityAttemptDeleted?.({
      user: testUser(),
      courseId: "course-1",
      groupId: "group-1",
      activityId: "activity-1",
      coreAttemptId: "attempt-1",
      pluginAttemptRef: "submission-1",
      reason: "Wrong file",
      deletedAt: "2026-06-19T10:00:00.000Z"
    });

    expect(deletionMocks.markCodingHomeworkSubmissionDeleted).toHaveBeenCalledWith({
      activityId: "activity-1",
      coreAttemptId: "attempt-1",
      deletedAt: "2026-06-19T10:00:00.000Z",
      deletedByUserId: "user-1",
      groupId: "group-1",
      pluginAttemptRef: "submission-1",
      reason: "Wrong file"
    });
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
