import type {
  ActivateAccountInput,
  ActivityInput,
  ActivityUpdate,
  CourseGroupActivityInput,
  CourseGroupActivityUpdate,
  CourseGroupInput,
  CourseGroupParticipantInput,
  CourseGroupParticipantRole,
  CourseGroupStatus,
  CourseGroupMaterialInput,
  CourseGroupMaterialUpdate,
  CourseGroupUpdate,
  CourseInput,
  CourseMaterialInput,
  CourseMaterialUpdate,
  CourseUpdate,
  CurrentUser,
  MaterialKind
} from "@cognelo/contracts";

export type Course = {
  id: string;
  title: string;
  description: string;
  status: "draft" | "published" | "archived";
  memberships?: CourseMembership[];
  materials?: CourseMaterial[];
  activities?: Activity[];
  groups?: CourseGroup[];
};

export type CourseMembership = {
  id: string;
  role: "owner" | "teacher" | "ta" | "student";
  userId: string;
};

export type CourseMaterial = {
  id: string;
  title: string;
  kind: MaterialKind;
  parentId?: string | null;
  body?: string | null;
  url?: string | null;
  metadata?: Record<string, unknown>;
  position: number;
};

export type CourseGroup = {
  id: string;
  title: string;
  description: string;
  status: CourseGroupStatus;
  availableFrom?: string | null;
  availableUntil?: string | null;
  hiddenCourseMaterialIds?: string[];
  materials?: CourseGroupMaterial[];
  activities?: CourseGroupActivityAssignment[];
  participants?: GroupParticipant[];
};

export type GroupParticipant = {
  id: string;
  groupId: string;
  userId?: string | null;
  role: CourseGroupParticipantRole;
  firstName: string;
  lastName: string;
  email: string;
  externalId?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    email: string;
    name: string | null;
  } | null;
};

export type GroupParticipantCandidate = {
  id: string;
  email: string;
  name: string | null;
  firstName: string;
  lastName: string;
};

export type CourseGroupMaterial = {
  id: string;
  title: string;
  kind: MaterialKind;
  parentId?: string | null;
  body?: string | null;
  url?: string | null;
  metadata?: Record<string, unknown>;
  position: number;
};

export type ActivityType = {
  id: string;
  key: string;
  name: string;
  description: string;
};

export type ActivityDefinition = {
  key: string;
  name: string;
  description: string;
  i18n?: Partial<
    Record<
      "en" | "fr" | "zh",
      {
        name: string;
        description: string;
        defaultTitle?: string;
      }
    >
  >;
};

export type Activity = {
  id: string;
  title: string;
  description: string;
  lifecycle: string;
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  activityType: ActivityType;
  position: number;
};

export type CourseGroupActivityAssignment = {
  id: string;
  activityId: string;
  availableFrom?: string | null;
  availableUntil?: string | null;
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  position: number;
  activity: Activity;
};

export type ParsonsAttemptEvaluation = {
  isCorrect: boolean;
  orderCorrect: boolean;
  indentationCorrect: boolean;
  misplacedBlocks: number;
  incorrectIndents: number;
};

export type ParsonsAttemptState = {
  configFingerprint: string;
  blocks: Array<{
    id: string;
    displayText: string;
    originalText: string;
    sourceIndex: number;
    physicalLineIndex: number;
    unitId: string;
    groupId: string | null;
    expectedIndent: number;
    currentIndent: number;
  }>;
  selectedBlockId?: string | null;
  lastEvaluation?: ParsonsAttemptEvaluation | null;
};

export type ParsonsAttempt = {
  id: string;
  activityId: string;
  userId: string;
  status: "in_progress" | "completed" | "abandoned";
  startedAt: string;
  lastInteractionAt: string;
  completedAt: string | null;
  checkCount: number;
  resetCount: number;
  moveCount: number;
  indentCount: number;
  latestState: ParsonsAttemptState;
  resultSummary: Record<string, unknown>;
};

export type CodingExerciseHiddenTest = {
  id: string;
  name: string;
  stdin: string;
  expectedOutput: string;
  testCode: string;
  isEnabled: boolean;
  weight: number;
  orderIndex: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CodingExerciseReferenceSolution = {
  sourceCode: string;
  privateConfig: {
    hiddenSupportCode: string;
    templateSource: string;
    templateVisibleLineNumbers: number[];
    templatePrefix: string;
    templateSuffix: string;
  };
  validationSummary: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CodingExerciseExecution = {
  id: string;
  activityId: string;
  userId: string;
  kind: "run" | "submit";
  status: "pending" | "completed" | "failed";
  languageKey: string;
  judge0LanguageId: number;
  judge0Token?: string | null;
  stdin: string;
  expectedOutput: string;
  stdout?: string | null;
  stderr?: string | null;
  compileOutput?: string | null;
  message?: string | null;
  timeSeconds?: string | null;
  memoryKb?: number | null;
  judge0StatusId?: number | null;
  judge0StatusLabel?: string | null;
  resultSummary: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type WebDesignExerciseFile = {
  id: string;
  path: string;
  language: "html" | "css" | "javascript";
  starterCode: string;
  isEditable: boolean;
  orderIndex: number;
};

export type WebDesignExerciseTest = {
  id: string;
  name: string;
  kind: "sample" | "hidden";
  testCode: string;
  isEnabled: boolean;
  weight: number;
  orderIndex: number;
  metadata: Record<string, unknown>;
  validationSummary: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type WebDesignExerciseReferenceBundle = {
  files: WebDesignExerciseFile[];
  validationSummary: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type WebDesignExerciseTestResult = {
  id: string;
  testId: string | null;
  name: string;
  status: "pending" | "completed" | "failed";
  weight: number;
  score: number | null;
  message: string | null;
  durationMs: number | null;
  details: Record<string, unknown>;
  createdAt: string;
};

export type WebDesignExerciseSubmission = {
  id: string;
  activityId: string;
  userId: string;
  kind: "run" | "submit";
  status: "pending" | "completed" | "failed";
  files: WebDesignExerciseFile[];
  resultSummary: Record<string, unknown>;
  score: number | null;
  maxScore: number | null;
  message: string | null;
  createdAt: string;
  updatedAt: string;
  testResults: WebDesignExerciseTestResult[];
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  code?: string;
  details?: unknown;

  constructor(message: string, options?: { code?: string; details?: unknown }) {
    super(message);
    this.name = "ApiError";
    this.code = options?.code;
    this.details = options?.details;
  }
}

export const API_UNAUTHORIZED_EVENT = "cognelo:api-unauthorized";

function notifyUnauthorized() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(API_UNAUTHORIZED_EVENT));
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}/api${path}`, {
    cache: "no-store",
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 || body?.error?.code === "UNAUTHORIZED") {
      notifyUnauthorized();
    }
    throw new ApiError(body?.error?.message ?? "Request failed.", {
      code: body?.error?.code,
      details: body?.error?.details
    });
  }
  return body as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ user: CurrentUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    }),
  activateAccount: (input: ActivateAccountInput) =>
    request<{ user: CurrentUser }>("/auth/activate", {
      method: "POST",
      body: JSON.stringify(input)
    }),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
  me: () => request<{ user: CurrentUser }>("/users/me"),
  courses: () => request<{ courses: Course[] }>("/courses"),
  course: (courseId: string) => request<{ course: Course }>(`/courses/${courseId}`),
  createCourse: (input: CourseInput) =>
    request<{ course: Course }>("/courses", {
      method: "POST",
      body: JSON.stringify(input)
    }),
  updateCourse: (courseId: string, input: CourseUpdate) =>
    request<{ course: Course }>(`/courses/${courseId}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    }),
  archiveCourse: (courseId: string) => request<{ course: Course }>(`/courses/${courseId}`, { method: "DELETE" }),
  groups: (courseId: string) => request<{ groups: CourseGroup[] }>(`/courses/${courseId}/groups`),
  group: (courseId: string, groupId: string) => request<{ group: CourseGroup }>(`/courses/${courseId}/groups/${groupId}`),
  createGroup: (courseId: string, input: CourseGroupInput) =>
    request<{ group: CourseGroup }>(`/courses/${courseId}/groups`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
  updateGroup: (courseId: string, groupId: string, input: CourseGroupUpdate) =>
    request<{ group: CourseGroup }>(`/courses/${courseId}/groups/${groupId}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    }),
  deleteGroup: (courseId: string, groupId: string) =>
    request<{ ok: true }>(`/courses/${courseId}/groups/${groupId}`, {
      method: "DELETE"
    }),
  addGroupParticipant: (courseId: string, groupId: string, input: CourseGroupParticipantInput) =>
    request<{ participant: GroupParticipant }>(`/courses/${courseId}/groups/${groupId}/participants`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
  groupParticipantCandidate: (courseId: string, email: string) =>
    request<{ candidate: GroupParticipantCandidate | null }>(
      `/courses/${courseId}/groups/participant-candidates?email=${encodeURIComponent(email)}`
    ),
  removeGroupParticipant: (courseId: string, groupId: string, participantId: string) =>
    request<{ ok: true }>(`/courses/${courseId}/groups/${groupId}/participants/${participantId}`, {
      method: "DELETE"
    }),
  activityTypes: () => request<{ activityTypes: ActivityType[]; registeredDefinitions: ActivityDefinition[] }>("/activity-types"),
  activity: (courseId: string, activityId: string) =>
    request<{ activity: Activity }>(`/courses/${courseId}/activities/${activityId}`),
  groupActivity: (courseId: string, groupId: string, activityId: string) =>
    request<{ activity: Activity }>(`/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}`),
  ensureParsonsAttempt: (courseId: string, activityId: string, input?: { forceNew?: boolean }) =>
    request<{ attempt: ParsonsAttempt }>(`/courses/${courseId}/activities/${activityId}/parsons/attempt`, {
      method: "POST",
      body: JSON.stringify(input ?? {})
    }),
  updateParsonsAttempt: (
    courseId: string,
    activityId: string,
    input: {
      attemptId: string;
      state?: ParsonsAttemptState;
      event?: { type: "move" | "indent" | "reset" | "check"; payload?: Record<string, unknown> };
      result?: ParsonsAttemptEvaluation;
      complete?: boolean;
      abandon?: boolean;
    }
  ) =>
    request<{ attempt: ParsonsAttempt }>(`/courses/${courseId}/activities/${activityId}/parsons/attempt`, {
      method: "PATCH",
      body: JSON.stringify(input)
    }),
  codingExerciseHiddenTests: (courseId: string, activityId: string) =>
    request<{ tests: CodingExerciseHiddenTest[]; referenceSolution: CodingExerciseReferenceSolution | null }>(
      `/courses/${courseId}/activities/${activityId}/coding-exercises/hidden-tests`
    ),
  saveCodingExerciseHiddenTests: (
    courseId: string,
    activityId: string,
    input: {
      tests: Array<Omit<CodingExerciseHiddenTest, "orderIndex" | "metadata" | "createdAt" | "updatedAt"> & { orderIndex?: number }>;
      sampleTests: Array<{ id: string; input: string; output: string; title: string }>;
      referenceSolution: string;
    }
  ) =>
    request<{ tests: CodingExerciseHiddenTest[]; referenceSolution: CodingExerciseReferenceSolution | null }>(
      `/courses/${courseId}/activities/${activityId}/coding-exercises/hidden-tests`,
      {
        method: "PUT",
        body: JSON.stringify(input)
      }
    ),
  runCodingExercise: (
    courseId: string,
    activityId: string,
    input: { sourceCode: string; stdin?: string; expectedOutput?: string }
  ) =>
    request<{ execution: CodingExerciseExecution }>(`/courses/${courseId}/activities/${activityId}/coding-exercises/run`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
  codingExerciseRuns: (courseId: string, activityId: string) =>
    request<{ executions: CodingExerciseExecution[] }>(`/courses/${courseId}/activities/${activityId}/coding-exercises/run`),
  submitCodingExercise: (courseId: string, activityId: string, input: { sourceCode: string }) =>
    request<{ execution: CodingExerciseExecution }>(`/courses/${courseId}/activities/${activityId}/coding-exercises/submit`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
  codingExerciseSubmissions: (courseId: string, activityId: string) =>
    request<{ executions: CodingExerciseExecution[] }>(`/courses/${courseId}/activities/${activityId}/coding-exercises/submit`),
  webDesignExerciseTests: (courseId: string, activityId: string) =>
    request<{ tests: WebDesignExerciseTest[]; referenceBundle: WebDesignExerciseReferenceBundle | null }>(
      `/courses/${courseId}/activities/${activityId}/web-design-coding-exercises/tests`
    ),
  webDesignExerciseExpectedResult: (courseId: string, activityId: string) =>
    request<{ imageDataUrl: string | null }>(`/courses/${courseId}/activities/${activityId}/web-design-coding-exercises/expected-result`),
  saveWebDesignExerciseTests: (
    courseId: string,
    activityId: string,
    input: {
      shouldCaptureExpectedResult?: boolean;
      shouldCropExpectedResult?: boolean;
      referenceFiles: WebDesignExerciseFile[];
      tests: Array<Omit<WebDesignExerciseTest, "orderIndex" | "createdAt" | "updatedAt" | "validationSummary">>;
    }
  ) =>
    request<{ tests: WebDesignExerciseTest[]; referenceBundle: WebDesignExerciseReferenceBundle | null }>(
      `/courses/${courseId}/activities/${activityId}/web-design-coding-exercises/tests`,
      {
        method: "PUT",
        body: JSON.stringify(input)
      }
    ),
  runWebDesignExercise: (courseId: string, activityId: string, input: { files: WebDesignExerciseFile[] }) =>
    request<{ submission: WebDesignExerciseSubmission }>(
      `/courses/${courseId}/activities/${activityId}/web-design-coding-exercises/run`,
      {
        method: "POST",
        body: JSON.stringify(input)
      }
    ),
  webDesignExerciseRuns: (courseId: string, activityId: string) =>
    request<{ submissions: WebDesignExerciseSubmission[] }>(
      `/courses/${courseId}/activities/${activityId}/web-design-coding-exercises/run`
    ),
  submitWebDesignExercise: (courseId: string, activityId: string, input: { files: WebDesignExerciseFile[] }) =>
    request<{ submission: WebDesignExerciseSubmission }>(
      `/courses/${courseId}/activities/${activityId}/web-design-coding-exercises/submit`,
      {
        method: "POST",
        body: JSON.stringify(input)
      }
    ),
  webDesignExerciseSubmissions: (courseId: string, activityId: string) =>
    request<{ submissions: WebDesignExerciseSubmission[] }>(
      `/courses/${courseId}/activities/${activityId}/web-design-coding-exercises/submit`
    ),
  createActivity: (courseId: string, input: ActivityInput) =>
    request<{ activity: Activity }>(`/courses/${courseId}/activities`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
  updateActivity: (courseId: string, activityId: string, input: ActivityUpdate) =>
    request<{ activity: Activity }>(`/courses/${courseId}/activities/${activityId}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    }),
  deleteActivity: (courseId: string, activityId: string) =>
    request<{ ok: true }>(`/courses/${courseId}/activities/${activityId}`, {
      method: "DELETE"
    }),
  createMaterial: (courseId: string, input: CourseMaterialInput) =>
    request<{ material: CourseMaterial }>(`/courses/${courseId}/materials`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
  updateMaterial: (courseId: string, materialId: string, input: CourseMaterialUpdate) =>
    request<{ material: CourseMaterial }>(`/courses/${courseId}/materials/${materialId}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    }),
  deleteMaterial: (courseId: string, materialId: string) =>
    request<{ ok: true }>(`/courses/${courseId}/materials/${materialId}`, {
      method: "DELETE"
    }),
  uploadMaterial: async (courseId: string, input: { title: string; file: File; parentId?: string | null; position?: number }) => {
    const formData = new FormData();
    formData.append("title", input.title);
    formData.append("file", input.file);
    if (input.parentId) {
      formData.append("parentId", input.parentId);
    }
    if (input.position !== undefined) {
      formData.append("position", String(input.position));
    }

    const response = await fetch(`${API_URL}/api/courses/${courseId}/materials/upload`, {
      cache: "no-store",
      method: "POST",
      credentials: "include",
      body: formData
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 || body?.error?.code === "UNAUTHORIZED") {
        notifyUnauthorized();
      }
      throw new Error(body?.error?.message ?? "Upload failed.");
    }
    return body as { material: CourseMaterial };
  },
  materialDownloadUrl: (courseId: string, materialId: string) =>
    `${API_URL}/api/courses/${courseId}/materials/${materialId}/download`,
  groupCourseMaterialDownloadUrl: (courseId: string, groupId: string, materialId: string) =>
    `${API_URL}/api/courses/${courseId}/groups/${groupId}/course-materials/${materialId}/download`,
  groupMaterials: (courseId: string, groupId: string) =>
    request<{ materials: CourseGroupMaterial[] }>(`/courses/${courseId}/groups/${groupId}/materials`),
  createGroupMaterial: (courseId: string, groupId: string, input: CourseGroupMaterialInput) =>
    request<{ material: CourseGroupMaterial }>(`/courses/${courseId}/groups/${groupId}/materials`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
  updateGroupMaterial: (courseId: string, groupId: string, materialId: string, input: CourseGroupMaterialUpdate) =>
    request<{ material: CourseGroupMaterial }>(`/courses/${courseId}/groups/${groupId}/materials/${materialId}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    }),
  deleteGroupMaterial: (courseId: string, groupId: string, materialId: string) =>
    request<{ ok: true }>(`/courses/${courseId}/groups/${groupId}/materials/${materialId}`, {
      method: "DELETE"
    }),
  uploadGroupMaterial: async (
    courseId: string,
    groupId: string,
    input: { title: string; file: File; parentId?: string | null; position?: number }
  ) => {
    const formData = new FormData();
    formData.append("title", input.title);
    formData.append("file", input.file);
    if (input.parentId) {
      formData.append("parentId", input.parentId);
    }
    if (input.position !== undefined) {
      formData.append("position", String(input.position));
    }

    const response = await fetch(`${API_URL}/api/courses/${courseId}/groups/${groupId}/materials/upload`, {
      cache: "no-store",
      method: "POST",
      credentials: "include",
      body: formData
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 || body?.error?.code === "UNAUTHORIZED") {
        notifyUnauthorized();
      }
      throw new Error(body?.error?.message ?? "Upload failed.");
    }
    return body as { material: CourseGroupMaterial };
  },
  groupMaterialDownloadUrl: (courseId: string, groupId: string, materialId: string) =>
    `${API_URL}/api/courses/${courseId}/groups/${groupId}/materials/${materialId}/download`,
  hideCourseMaterialInGroup: (courseId: string, groupId: string, materialId: string) =>
    request<{ ok: true }>(`/courses/${courseId}/groups/${groupId}/course-materials/${materialId}/visibility`, {
      method: "PUT"
    }),
  unhideCourseMaterialInGroup: (courseId: string, groupId: string, materialId: string) =>
    request<{ ok: true }>(`/courses/${courseId}/groups/${groupId}/course-materials/${materialId}/visibility`, {
      method: "DELETE"
    }),
  groupActivityAssignments: (courseId: string, groupId: string) =>
    request<{ assignments: CourseGroupActivityAssignment[] }>(`/courses/${courseId}/groups/${groupId}/activities`),
  assignGroupActivity: (courseId: string, groupId: string, input: CourseGroupActivityInput) =>
    request<{ assignment: CourseGroupActivityAssignment }>(`/courses/${courseId}/groups/${groupId}/activities`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
  updateGroupActivityAssignment: (
    courseId: string,
    groupId: string,
    assignmentId: string,
    input: CourseGroupActivityUpdate
  ) =>
    request<{ assignment: CourseGroupActivityAssignment }>(`/courses/${courseId}/groups/${groupId}/activities/${assignmentId}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    }),
  deleteGroupActivityAssignment: (courseId: string, groupId: string, assignmentId: string) =>
    request<{ ok: true }>(`/courses/${courseId}/groups/${groupId}/activities/${assignmentId}`, {
      method: "DELETE"
    }),
  ensureGroupParsonsAttempt: (courseId: string, groupId: string, activityId: string, input?: { forceNew?: boolean }) =>
    request<{ attempt: ParsonsAttempt }>(`/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/parsons/attempt`, {
      method: "POST",
      body: JSON.stringify(input ?? {})
    }),
  updateGroupParsonsAttempt: (
    courseId: string,
    groupId: string,
    activityId: string,
    input: {
      attemptId: string;
      state?: ParsonsAttemptState;
      event?: { type: "move" | "indent" | "reset" | "check"; payload?: Record<string, unknown> };
      result?: ParsonsAttemptEvaluation;
      complete?: boolean;
      abandon?: boolean;
    }
  ) =>
    request<{ attempt: ParsonsAttempt }>(`/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/parsons/attempt`, {
      method: "PATCH",
      body: JSON.stringify(input)
    }),
  groupCodingExerciseHiddenTests: (courseId: string, groupId: string, activityId: string) =>
    request<{ tests: CodingExerciseHiddenTest[]; referenceSolution: CodingExerciseReferenceSolution | null }>(
      `/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/coding-exercises/hidden-tests`
    ),
  saveGroupCodingExerciseHiddenTests: (
    courseId: string,
    groupId: string,
    activityId: string,
    input: {
      tests: Array<Omit<CodingExerciseHiddenTest, "orderIndex" | "metadata" | "createdAt" | "updatedAt"> & { orderIndex?: number }>;
      sampleTests: Array<{ id: string; input: string; output: string; title: string }>;
      referenceSolution: string;
    }
  ) =>
    request<{ tests: CodingExerciseHiddenTest[]; referenceSolution: CodingExerciseReferenceSolution | null }>(
      `/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/coding-exercises/hidden-tests`,
      {
        method: "PUT",
        body: JSON.stringify(input)
      }
    ),
  runGroupCodingExercise: (
    courseId: string,
    groupId: string,
    activityId: string,
    input: { sourceCode: string; stdin?: string; expectedOutput?: string }
  ) =>
    request<{ execution: CodingExerciseExecution }>(
      `/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/coding-exercises/run`,
      {
        method: "POST",
        body: JSON.stringify(input)
      }
    ),
  groupCodingExerciseRuns: (courseId: string, groupId: string, activityId: string) =>
    request<{ executions: CodingExerciseExecution[] }>(
      `/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/coding-exercises/run`
    ),
  submitGroupCodingExercise: (courseId: string, groupId: string, activityId: string, input: { sourceCode: string }) =>
    request<{ execution: CodingExerciseExecution }>(
      `/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/coding-exercises/submit`,
      {
        method: "POST",
        body: JSON.stringify(input)
      }
    ),
  groupCodingExerciseSubmissions: (courseId: string, groupId: string, activityId: string) =>
    request<{ executions: CodingExerciseExecution[] }>(
      `/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/coding-exercises/submit`
    ),
  groupWebDesignExerciseTests: (courseId: string, groupId: string, activityId: string) =>
    request<{ tests: WebDesignExerciseTest[]; referenceBundle: WebDesignExerciseReferenceBundle | null }>(
      `/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/web-design-coding-exercises/tests`
    ),
  groupWebDesignExerciseExpectedResult: (courseId: string, groupId: string, activityId: string) =>
    request<{ imageDataUrl: string | null }>(
      `/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/web-design-coding-exercises/expected-result`
    ),
  saveGroupWebDesignExerciseTests: (
    courseId: string,
    groupId: string,
    activityId: string,
    input: {
      shouldCaptureExpectedResult?: boolean;
      shouldCropExpectedResult?: boolean;
      referenceFiles: WebDesignExerciseFile[];
      tests: Array<Omit<WebDesignExerciseTest, "orderIndex" | "createdAt" | "updatedAt" | "validationSummary">>;
    }
  ) =>
    request<{ tests: WebDesignExerciseTest[]; referenceBundle: WebDesignExerciseReferenceBundle | null }>(
      `/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/web-design-coding-exercises/tests`,
      {
        method: "PUT",
        body: JSON.stringify(input)
      }
    ),
  runGroupWebDesignExercise: (courseId: string, groupId: string, activityId: string, input: { files: WebDesignExerciseFile[] }) =>
    request<{ submission: WebDesignExerciseSubmission }>(
      `/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/web-design-coding-exercises/run`,
      {
        method: "POST",
        body: JSON.stringify(input)
      }
    ),
  groupWebDesignExerciseRuns: (courseId: string, groupId: string, activityId: string) =>
    request<{ submissions: WebDesignExerciseSubmission[] }>(
      `/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/web-design-coding-exercises/run`
    ),
  submitGroupWebDesignExercise: (courseId: string, groupId: string, activityId: string, input: { files: WebDesignExerciseFile[] }) =>
    request<{ submission: WebDesignExerciseSubmission }>(
      `/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/web-design-coding-exercises/submit`,
      {
        method: "POST",
        body: JSON.stringify(input)
      }
    ),
  groupWebDesignExerciseSubmissions: (courseId: string, groupId: string, activityId: string) =>
    request<{ submissions: WebDesignExerciseSubmission[] }>(
      `/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/web-design-coding-exercises/submit`
    )
};
