export type CodingHomeworkAttachmentRecord = {
  id: string;
  createdAt: string;
  kind: string;
  metadata: Record<string, unknown>;
  mimeType: string | null;
  originalName: string;
  ownerId: string;
  ownerKind: string;
  sha256: string;
  sizeBytes: number;
  storedName: string;
  updatedAt: string;
};

export type CodingHomeworkAssignmentRecord = {
  id: string | null;
  candidateLimit: number;
  createdAt: string;
  generationInstructions: string;
  languageKey: string;
  promptMarkdown: string;
  promptPdfAttachmentId: string | null;
  questionCount: number;
  retrievedExampleCount: number;
  settings: Record<string, unknown>;
  updatedAt: string;
};

export type CodingHomeworkAuthoringFunctionRequirement = {
  description?: string;
  filePath?: string;
  name: string;
  required?: boolean;
};

export type CodingHomeworkAuthoringPathRequirement = {
  description?: string;
  path: string;
};

export type CodingHomeworkAuthoringSubmissionRequirements = {
  allowedExtensions: string[];
  ignoredPaths: string[];
  languageKey: string;
  maxArchiveBytes: number;
  maxFileCount: number;
  requiredFiles: CodingHomeworkAuthoringPathRequirement[];
  requiredFolders: CodingHomeworkAuthoringPathRequirement[];
  requiredFunctions: CodingHomeworkAuthoringFunctionRequirement[];
};

export type CodingHomeworkRequirementSetRecord = {
  id: string | null;
  createdAt: string;
  languageKey: string;
  metadata: Record<string, unknown>;
  requirements: CodingHomeworkAuthoringSubmissionRequirements;
  sourceAttachmentId: string | null;
  updatedAt: string;
};

export type CodingHomeworkAuthoringRecord = {
  assignment: CodingHomeworkAssignmentRecord;
  assignmentPdf: CodingHomeworkAttachmentRecord | null;
  requirements: CodingHomeworkRequirementSetRecord;
  requirementsUpload: CodingHomeworkAttachmentRecord | null;
  providedFiles: CodingHomeworkAttachmentRecord[];
};

export type CodingHomeworkDocumentationResource = {
  contentResourceId: string | null;
  contentTypeKey: string | null;
  depth: number;
  groupId: string | null;
  itemId: string;
  materialId: string | null;
  orderIndex: number;
  path: string[];
  pluginKey: string | null;
  resourceFingerprint: string;
  sourceKind: "content_resource" | "legacy_material";
  title: string;
  updatedAt: string;
};

export type CodingHomeworkDocumentationSnapshotRecord = {
  id: string;
  activityId: string;
  courseId: string;
  groupId: string | null;
  contentTreeAnchorItemId: string | null;
  contentTreeFingerprint: string;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CodingHomeworkDocumentationPreview = {
  anchor: {
    id: string;
    depth: number;
    path: string[];
    title: string;
    updatedAt: string;
  } | null;
  contentTreeFingerprint: string;
  latestSnapshot: CodingHomeworkDocumentationSnapshotRecord | null;
  resourceCount: number;
  resources: CodingHomeworkDocumentationResource[];
};

export type CodingHomeworkDocumentationSnapshotResult = {
  preview: CodingHomeworkDocumentationPreview;
  snapshot: CodingHomeworkDocumentationSnapshotRecord;
};

export type CodingHomeworkDocumentationExtractionResult = {
  extraction: {
    status: string;
    extractedAt: string;
    resourceCount: number;
    documentCount: number;
    diagnosticCount: number;
    documents: Array<Record<string, unknown>>;
    diagnostics: Array<Record<string, unknown>>;
  };
  snapshot: CodingHomeworkDocumentationSnapshotRecord;
};

export type CodingHomeworkPreflightIssue = {
  code: string;
  functionName?: string;
  message: string;
  path?: string;
  severity: "error" | "warning";
};

export type CodingHomeworkPreflightSummary = {
  fileCount: number;
  ignoredFiles: string[];
  issues: CodingHomeworkPreflightIssue[];
  isValid: boolean;
  matchedFunctions: Array<{ filePath: string; functionName: string }>;
  missingRequired: CodingHomeworkPreflightIssue[];
  parserDiagnostics: CodingHomeworkPreflightIssue[];
  unexpectedItems: CodingHomeworkPreflightIssue[];
  validFiles: string[];
  validFunctions: Array<{ filePath: string; functionName: string }>;
};

export type CodingHomeworkPreflightResult = {
  preflight: {
    id: string;
    activityId: string;
    groupId: string;
    userId: string;
    kind: string;
    status: string;
    expiresAt: string;
    zipAttachmentId: string;
    createdAt: string;
    updatedAt: string;
  };
  summary: CodingHomeworkPreflightSummary;
};

export type CodingHomeworkSubmissionFileRecord = {
  id: string;
  createdAt: string;
  languageKey: string | null;
  metadata: Record<string, unknown>;
  path: string;
  sha256: string;
  sizeBytes: number;
  storedName: string;
  submissionId: string;
};

export type CodingHomeworkSubmissionRecord = {
  id: string;
  activityId: string;
  coreAttemptId: string | null;
  createdAt: string;
  documentationSnapshotId: string | null;
  groupId: string;
  kind: string;
  metadata: Record<string, unknown>;
  processingError: string | null;
  status: string;
  structureValidationSummary: Record<string, unknown>;
  updatedAt: string;
  userId: string;
  zipAttachmentId: string | null;
};

export type CodingHomeworkSubmissionFunctionRecord = {
  id: string;
  astText: string;
  createdAt: string;
  divergenceScore: number | null;
  embedding: unknown[];
  fileId: string;
  functionCode: string;
  functionName: string;
  nearestExamples: unknown[];
  selectedForQuestion: boolean;
  submissionId: string;
  updatedAt: string;
};

export type CodingHomeworkAnalysisResult = {
  analysis: {
    status: string;
    analyzedAt: string;
    modelKey: string;
    dimensions: number;
    sourceFileCount: number;
    parsedFunctionCount: number;
    storedFunctionCount: number;
    selectedCandidateCount: number;
    referenceResourceCount: number;
    nearestExampleCount: number;
    candidateLimit: number;
    diagnostics: Record<string, unknown>;
  };
  functions: CodingHomeworkSubmissionFunctionRecord[];
  submission: CodingHomeworkSubmissionRecord;
};

export type CodingHomeworkChallengeQuestionRecord = {
  id: string;
  answerSubmittedAt: string | null;
  createdAt: string;
  generationModel: string;
  generationPromptVersion: string;
  metadata: Record<string, unknown>;
  nearestExamples: unknown[];
  orderIndex: number;
  questionText: string;
  studentAnswer: string | null;
  submissionFunctionId: string | null;
  submissionId: string;
  updatedAt: string;
};

export type CodingHomeworkStudentChallengeQuestionRecord = {
  id: string;
  answerSubmittedAt: string | null;
  orderIndex: number;
  questionText: string;
  studentAnswer: string | null;
  submissionId: string;
};

export type CodingHomeworkChallengeGenerationResult = {
  generation: {
    status: string;
    generatedAt: string;
    model: string;
    promptVersion: string;
    questionCount: number;
    candidateCount: number;
  };
  questions: CodingHomeworkChallengeQuestionRecord[];
  submission: CodingHomeworkSubmissionRecord;
};

export type CodingHomeworkStudentChallengeGenerationResult = {
  generation: {
    status: string;
    generatedAt: string;
    questionCount: number;
  };
  questions: CodingHomeworkStudentChallengeQuestionRecord[];
  submission: CodingHomeworkSubmissionRecord;
};

export type CodingHomeworkChallengeAnswerResult = {
  questions: CodingHomeworkStudentChallengeQuestionRecord[];
  submission: CodingHomeworkSubmissionRecord;
};

export type CodingHomeworkProcessingJobRecord = {
  id: string;
  attempts: number;
  completedAt: string | null;
  createdAt: string;
  error: Record<string, unknown> | null;
  failedAt: string | null;
  handlerKey: string;
  queue: string;
  result: Record<string, unknown> | null;
  status: string;
  updatedAt: string;
};

export type CodingHomeworkGradebookAttemptRecord = {
  id: string;
  attemptNumber: number | null;
  coreAttemptId: string | null;
  createdAt: string;
  gradedAt: string | null;
  lifecycle: string;
  metadata: Record<string, unknown>;
  status: string;
  submittedAt: string | null;
  files: Array<{
    id: string;
    languageKey: string | null;
    metadata: Record<string, unknown>;
    path: string;
    sha256: string;
    sizeBytes: number;
  }>;
  functions: Array<{
    id: string;
    divergenceScore: number | null;
    fileId: string;
    filePath: string;
    functionCode: string;
    functionName: string;
    nearestExamples: unknown[];
    selectedForQuestion: boolean;
  }>;
  questions: Array<{
    id: string;
    answerSubmittedAt: string | null;
    generationModel: string;
    metadata: Record<string, unknown>;
    nearestExamples: unknown[];
    orderIndex: number;
    questionText: string;
    studentAnswer: string | null;
    submissionFunctionId: string | null;
  }>;
  reviews: Array<{
    id: string;
    createdAt: string;
    feedback: string;
    maxScore: number | null;
    metadata: Record<string, unknown>;
    reviewerUserId: string;
    rubric: Record<string, unknown>;
    score: number | null;
    updatedAt: string;
  }>;
};

export type CodingHomeworkSubmissionResult = {
  analysis?: CodingHomeworkAnalysisResult;
  challenge?: CodingHomeworkStudentChallengeGenerationResult;
  files: CodingHomeworkSubmissionFileRecord[];
  idempotent?: boolean;
  processingJob?: CodingHomeworkProcessingJobRecord | null;
  questions?: CodingHomeworkStudentChallengeQuestionRecord[];
  submission: CodingHomeworkSubmissionRecord;
  summary: CodingHomeworkPreflightSummary;
};

export type CodingHomeworkReprocessResult = {
  processingJob: CodingHomeworkProcessingJobRecord | null;
  submission: CodingHomeworkSubmissionRecord;
};

export type CodingHomeworkProcessingJobResult = {
  processingJob: CodingHomeworkProcessingJobRecord | null;
};

export type CodingHomeworkLatestSubmissionResult = {
  files: CodingHomeworkSubmissionFileRecord[];
  questions: CodingHomeworkStudentChallengeQuestionRecord[];
  submission: CodingHomeworkSubmissionRecord;
} | null;

export type CodingHomeworkStudentAssignment = {
  assignment: {
    languageKey: string;
    promptMarkdown: string;
    promptPdf: { id: string; originalName: string; sizeBytes: number } | null;
    providedFiles: Array<{ id: string; mimeType: string | null; originalName: string; sizeBytes: number }>;
  };
  latestSubmission: CodingHomeworkLatestSubmissionResult;
  requirements: CodingHomeworkAuthoringSubmissionRequirements;
};

export type CodingHomeworkAuthoringInput = {
  assignment: Omit<CodingHomeworkAssignmentRecord, "id" | "createdAt" | "updatedAt">;
  requirements: CodingHomeworkAuthoringSubmissionRequirements;
};

type Requester = <T>(path: string, init?: RequestInit) => Promise<T>;

export function createCodingHomeworkGraderClient(request: Requester) {
  return {
    getCourseAuthoring: (courseId: string, activityId: string) =>
      request<CodingHomeworkAuthoringRecord>(`/courses/${courseId}/activities/${activityId}/coding-homework-grader/authoring`),
    saveCourseAuthoring: (courseId: string, activityId: string, input: CodingHomeworkAuthoringInput) =>
      request<CodingHomeworkAuthoringRecord>(`/courses/${courseId}/activities/${activityId}/coding-homework-grader/authoring`, {
        method: "PUT",
        body: JSON.stringify(input)
      }),
    uploadCourseAssignmentPdf: (courseId: string, activityId: string, input: CodingHomeworkUploadInput) =>
      request<CodingHomeworkAuthoringRecord>(`/courses/${courseId}/activities/${activityId}/coding-homework-grader/assignment-pdf`, {
        method: "POST",
        body: JSON.stringify(input)
      }),
    uploadCourseProvidedFile: (courseId: string, activityId: string, input: CodingHomeworkUploadInput) =>
      request<CodingHomeworkAuthoringRecord>(`/courses/${courseId}/activities/${activityId}/coding-homework-grader/provided-files`, {
        method: "POST",
        body: JSON.stringify(input)
      }),
    deleteCourseProvidedFile: (courseId: string, activityId: string, attachmentId: string) => {
      const params = new URLSearchParams({ attachmentId });
      return request<CodingHomeworkAuthoringRecord>(
        `/courses/${courseId}/activities/${activityId}/coding-homework-grader/provided-files?${params.toString()}`,
        { method: "DELETE" }
      );
    },
    importCourseRequirements: (courseId: string, activityId: string, input: CodingHomeworkUploadInput) =>
      request<CodingHomeworkAuthoringRecord>(`/courses/${courseId}/activities/${activityId}/coding-homework-grader/requirements-upload`, {
        method: "POST",
        body: JSON.stringify(input)
      }),
    previewCourseDocumentation: (courseId: string, activityId: string) =>
      request<CodingHomeworkDocumentationPreview>(`/courses/${courseId}/activities/${activityId}/coding-homework-grader/documentation-preview`),
    createCourseDocumentationSnapshot: (courseId: string, activityId: string) =>
      request<CodingHomeworkDocumentationSnapshotResult>(`/courses/${courseId}/activities/${activityId}/coding-homework-grader/documentation-snapshot`, {
        method: "POST"
      }),
    extractCourseDocumentation: (courseId: string, activityId: string, input?: { snapshotId?: string | null }) =>
      request<CodingHomeworkDocumentationExtractionResult>(`/courses/${courseId}/activities/${activityId}/coding-homework-grader/documentation-extraction`, {
        method: "POST",
        body: JSON.stringify(input ?? {})
      }),
    runCoursePreflight: (courseId: string, activityId: string, input: CodingHomeworkUploadInput) =>
      request<CodingHomeworkPreflightResult>(`/courses/${courseId}/activities/${activityId}/coding-homework-grader/preflight`, {
        method: "POST",
        body: JSON.stringify(input)
      }),
    previewGroupDocumentation: (courseId: string, groupId: string, activityId: string) =>
      request<CodingHomeworkDocumentationPreview>(
        `/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/coding-homework-grader/documentation-preview`
      ),
    createGroupDocumentationSnapshot: (courseId: string, groupId: string, activityId: string) =>
      request<CodingHomeworkDocumentationSnapshotResult>(
        `/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/coding-homework-grader/documentation-snapshot`,
        {
          method: "POST"
        }
      ),
    extractGroupDocumentation: (courseId: string, groupId: string, activityId: string, input?: { snapshotId?: string | null }) =>
      request<CodingHomeworkDocumentationExtractionResult>(
        `/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/coding-homework-grader/documentation-extraction`,
        {
          method: "POST",
          body: JSON.stringify(input ?? {})
        }
      ),
    runGroupPreflight: (courseId: string, groupId: string, activityId: string, input: CodingHomeworkUploadInput) =>
      request<CodingHomeworkPreflightResult>(
        `/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/coding-homework-grader/preflight`,
        {
          method: "POST",
          body: JSON.stringify(input)
        }
      ),
    getGroupStudentAssignment: (courseId: string, groupId: string, activityId: string) =>
      request<CodingHomeworkStudentAssignment>(
        `/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/coding-homework-grader/assignment`
      ),
    getGroupSubmission: (courseId: string, groupId: string, activityId: string) =>
      request<CodingHomeworkLatestSubmissionResult>(
        `/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/coding-homework-grader/submission`
      ),
    getGroupProcessingJob: (courseId: string, groupId: string, activityId: string, jobId: string) => {
      const params = new URLSearchParams({ jobId });
      return request<CodingHomeworkProcessingJobResult>(
        `/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/coding-homework-grader/processing-job?${params.toString()}`
      );
    },
    submitGroupSubmission: (courseId: string, groupId: string, activityId: string, input: CodingHomeworkUploadInput) =>
      request<CodingHomeworkSubmissionResult>(
        `/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/coding-homework-grader/submission`,
        {
          method: "POST",
          body: JSON.stringify(input)
        }
      ),
    saveGroupChallengeAnswers: (courseId: string, groupId: string, activityId: string, input: CodingHomeworkChallengeAnswersInput) =>
      request<CodingHomeworkChallengeAnswerResult>(
        `/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/coding-homework-grader/challenge-answers`,
        {
          method: "PUT",
          body: JSON.stringify(input)
        }
      ),
    submitGroupChallengeAnswers: (courseId: string, groupId: string, activityId: string, input: CodingHomeworkChallengeAnswersInput) =>
      request<CodingHomeworkChallengeAnswerResult>(
        `/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/coding-homework-grader/challenge-answers`,
        {
          method: "POST",
          body: JSON.stringify(input)
        }
      ),
    analyzeGroupSubmission: (
      courseId: string,
      groupId: string,
      activityId: string,
      input?: { candidateLimit?: number; nearestExampleCount?: number; submissionId?: string | null }
    ) =>
      request<CodingHomeworkAnalysisResult>(
        `/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/coding-homework-grader/submission-analysis`,
        {
          method: "POST",
          body: JSON.stringify(input ?? {})
        }
      ),
    generateGroupChallengeQuestions: (
      courseId: string,
      groupId: string,
      activityId: string,
      input?: { locale?: "en" | "fr" | "zh" | "ar"; submissionId?: string | null }
    ) =>
      request<CodingHomeworkChallengeGenerationResult>(
        `/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/coding-homework-grader/challenge-generation`,
        {
          method: "POST",
          body: JSON.stringify(input ?? {})
        }
      ),
    reprocessGroupSubmission: (
      courseId: string,
      groupId: string,
      activityId: string,
      input: { locale?: "en" | "fr" | "zh" | "ar"; submissionId: string }
    ) =>
      request<CodingHomeworkReprocessResult>(
        `/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/coding-homework-grader/reprocess`,
        {
          method: "POST",
          body: JSON.stringify(input)
        }
      ),
    groupGradebookAttempts: (
      courseId: string,
      groupId: string,
      activityId: string,
      input: { includeAttempts?: boolean; participantId: string }
    ) => {
      const params = new URLSearchParams({ participantId: input.participantId });
      if (input.includeAttempts) {
        params.set("includeAttempts", "true");
      }
      return request<{
        participant: {
          id: string;
          email: string | null;
          firstName: string | null;
          lastName: string | null;
          userId: string | null;
        };
        attempts: CodingHomeworkGradebookAttemptRecord[];
      }>(`/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/coding-homework-grader/gradebook-attempts?${params.toString()}`);
    },
    getBankAuthoring: (activityBankId: string, bankActivityId: string) =>
      request<CodingHomeworkAuthoringRecord>(
        `/activity-banks/${activityBankId}/activities/${bankActivityId}/coding-homework-grader/authoring`
      ),
    saveBankAuthoring: (activityBankId: string, bankActivityId: string, input: CodingHomeworkAuthoringInput) =>
      request<CodingHomeworkAuthoringRecord>(
        `/activity-banks/${activityBankId}/activities/${bankActivityId}/coding-homework-grader/authoring`,
        {
          method: "PUT",
          body: JSON.stringify(input)
        }
      ),
    uploadBankAssignmentPdf: (activityBankId: string, bankActivityId: string, input: CodingHomeworkUploadInput) =>
      request<CodingHomeworkAuthoringRecord>(
        `/activity-banks/${activityBankId}/activities/${bankActivityId}/coding-homework-grader/assignment-pdf`,
        {
          method: "POST",
          body: JSON.stringify(input)
        }
      ),
    uploadBankProvidedFile: (activityBankId: string, bankActivityId: string, input: CodingHomeworkUploadInput) =>
      request<CodingHomeworkAuthoringRecord>(
        `/activity-banks/${activityBankId}/activities/${bankActivityId}/coding-homework-grader/provided-files`,
        {
          method: "POST",
          body: JSON.stringify(input)
        }
      ),
    deleteBankProvidedFile: (activityBankId: string, bankActivityId: string, attachmentId: string) => {
      const params = new URLSearchParams({ attachmentId });
      return request<CodingHomeworkAuthoringRecord>(
        `/activity-banks/${activityBankId}/activities/${bankActivityId}/coding-homework-grader/provided-files?${params.toString()}`,
        { method: "DELETE" }
      );
    },
    importBankRequirements: (activityBankId: string, bankActivityId: string, input: CodingHomeworkUploadInput) =>
      request<CodingHomeworkAuthoringRecord>(
        `/activity-banks/${activityBankId}/activities/${bankActivityId}/coding-homework-grader/requirements-upload`,
        {
          method: "POST",
          body: JSON.stringify(input)
        }
      )
  };
}

export type CodingHomeworkUploadInput = {
  base64: string;
  fileName: string;
  idempotencyKey?: string;
  locale?: "en" | "fr" | "zh" | "ar";
  mimeType?: string;
};

export type CodingHomeworkChallengeAnswersInput = {
  answers: Array<{ questionId: string; answer: string }>;
  submissionId?: string | null;
};
