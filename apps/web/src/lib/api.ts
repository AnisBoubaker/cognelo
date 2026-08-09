import type {
  ActivateAccountInput,
  ActivityPluginInstallationUpdate,
  AiAgentConnectionInput,
  AiAgentConnectionUpdate,
  ActivityInput,
  ActivityBankInput,
  ActivityBankUpdate,
  ActivityUpdate,
  BankActivityInput,
  BankActivityUpdate,
  CourseGroupActivityInput,
  CourseGroupActivityUpdate,
  CourseAllGroupsActivityAssignmentInput,
  CourseGroupInput,
  CourseGroupParticipantInput,
  CourseGroupParticipantRole,
  CourseGroupStatus,
  CourseGroupUpdate,
  CourseInput,
  CourseSettingsInput,
  CourseUpdate,
  CurrentUser,
  ContentTypePluginInstallationUpdate,
  MaterialKind,
  SubjectInput,
  SubjectUpdate,
  UserPasswordChange,
  UserProfileUpdate
} from "@cognelo/contracts";
import type { ContentTypeDefinition } from "@cognelo/content-type-sdk";

export type { MaterialKind };

export type AiAgentConnection = {
  id: string;
  scope: "personal" | "global";
  provider: "ollama" | "openai" | "codex" | "claude";
  displayName: string;
  model: string;
  baseUrl: string | null;
  hasApiKey: boolean;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AiAgentPreferences = {
  questionAuthoringAiAgentConnectionId: string | null;
};

export type ActivityPluginInstallation = {
  id: string;
  key: string;
  packageName: string;
  name: string;
  version: string;
  metadata: {
    activityTypeKeys?: string[];
    databaseNamespace?: string;
    databaseTables?: string[];
    databaseNotes?: string[];
    [key: string]: unknown;
  };
  isActivated: boolean;
  isEnabled: boolean;
  activatedAt: string | null;
  deactivatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tableBackups?: ActivityPluginTableBackup[];
};

export type ActivityPluginTableBackup = {
  id: string;
  pluginKey: string;
  pluginVersion: string;
  sourceTables: string[];
  backupTables: Array<{ sourceTable: string; backupTable: string }>;
  restoredAt: string | null;
  createdAt: string;
};

export type ContentTypePluginInstallation = {
  id: string;
  key: string;
  packageName: string;
  name: string;
  version: string;
  metadata: {
    contentTypeKeys?: string[];
    databaseNamespace?: string;
    databaseTables?: string[];
    databaseNotes?: string[];
    [key: string]: unknown;
  };
  isActivated: boolean;
  isEnabled: boolean;
  activatedAt: string | null;
  deactivatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tableBackups?: ActivityPluginTableBackup[];
};

export type CourseContentResource = {
  id: string;
  courseId: string;
  groupId: string | null;
  contentTypeKey: string;
  pluginKey: string;
  title: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CodingExercisePromptGenerationInput = {
  description: string;
  language: string;
  locale: "en" | "fr" | "zh" | "ar";
};

export type CodingExercisePromptGenerationResult = {
  prompt: string;
  attempts: number;
};

export type CodingExerciseGenerationBaseInput = {
  description: string;
  prompt: string;
  language: string;
  locale: "en" | "fr" | "zh" | "ar";
};

export type CodingExerciseSolutionGenerationInput = CodingExerciseGenerationBaseInput;

export type CodingExerciseTestsGenerationInput = CodingExerciseGenerationBaseInput & {
  referenceSolution: string;
  templateSource: string;
  templateVisibleLineNumbers: number[];
};

export type CodingExerciseSolutionGenerationResult =
  | {
      status?: "ok" | "warning";
      warningMessage?: string;
      starterCode: string;
      referenceSolution: string;
      templateSource: string;
      templateVisibleLineNumbers: number[];
      attempts: number;
    }
  | {
      status: "error";
      message: string;
      attempts: number;
    };

export type CodingExerciseTestsGenerationResult =
  | {
      status?: "ok" | "warning";
      warningMessage?: string;
      sampleTests: Array<{ id: string; input: string; output: string; testCode: string; title: string }>;
      hiddenTests: Array<{
        id: string;
        name: string;
        stdin: string;
        expectedOutput: string;
        testCode: string;
        isEnabled: boolean;
        weight: number;
      }>;
      validationSummary: Record<string, unknown>;
      attempts: number;
    }
  | {
      status: "error";
      message: string;
      attempts: number;
    };

export type Course = {
  id: string;
  subjectId: string;
  title: string;
  description: string;
  status: "draft" | "published" | "archived";
  metadata?: Record<string, unknown>;
  subject?: Subject;
  memberships?: CourseMembership[];
  materials?: CourseMaterial[];
  activities?: Activity[];
  groups?: CourseGroup[];
};

export type Subject = {
  id: string;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
  materials?: CourseMaterial[];
  activityBanks?: ActivityBank[];
  courses?: Course[];
};

export type ActivityBank = {
  id: string;
  subjectId: string;
  title: string;
  description: string;
  ownerId: string;
  metadata?: Record<string, unknown>;
  subject?: Subject;
  owner?: {
    id: string;
    email: string;
    name: string | null;
  };
  activities?: BankActivity[];
};

export type BankActivity = {
  id: string;
  bankId: string;
  activityTypeId: string;
  title: string;
  description: string;
  lifecycle: string;
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  position: number;
  currentVersionId?: string | null;
  activityType: ActivityType;
  currentVersion?: ActivityVersion | null;
  versions?: ActivityVersion[];
};

export type ActivityVersion = {
  id: string;
  bankActivityId: string;
  versionNumber: number;
  activityTypeId: string;
  title: string;
  description: string;
  lifecycle: string;
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: string;
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

export type CourseContentItem = {
  id: string;
  courseId: string;
  groupId?: string | null;
  parentId?: string | null;
  kind: "folder" | "content" | "activity";
  titleSnapshot?: string | null;
  position: number;
  isVisible: boolean;
  materialId?: string | null;
  contentResourceId?: string | null;
  activityId?: string | null;
  courseGroupActivityId?: string | null;
  effectiveVisibility?: "visible" | "hidden" | "hidden_by_parent";
  metadata?: Record<string, unknown>;
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
  defaultCategoryIds?: string[];
  icon?: "code" | "checklist" | "document-check" | "list-check" | "placeholder";
  defaultConfig?: Record<string, unknown>;
  provider?: { kind: "core" | "plugin"; key: string };
  creationScopes?: readonly ("bank" | "course")[];
  isEnabledByDefault?: boolean;
  grading?: {
    supportsAttempts?: boolean;
    supportsAutoGrading?: boolean;
    supportsManualGrading?: boolean;
    supportsCompositeExecution?: boolean;
  };
  i18n?: Partial<
    Record<
      "en" | "fr" | "zh" | "ar",
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
  bankActivityId?: string | null;
  activityVersionId?: string | null;
  title: string;
  description: string;
  lifecycle: string;
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  assignment?: {
    id: string;
    availableFrom?: string | null;
    availableUntil?: string | null;
    config?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    position?: number;
  };
  activityType: ActivityType;
  bankActivity?: BankActivity | null;
  activityVersion?: ActivityVersion | null;
  position: number;
};

export type CourseTestSettings = {
  timeLimitMinutes: number | null;
  navigationMode: "free" | "sequential";
  randomizeItems: boolean;
  allowResume: boolean;
};

export type CourseTestItem = {
  id: string;
  activityId: string;
  position: number;
  pointsPossible: number;
  isRequired: boolean;
  metadata: Record<string, unknown>;
  activity: Activity;
};

export type CourseTest = {
  id: string;
  courseId: string;
  activityId: string;
  settings: CourseTestSettings;
  activity: Activity;
  items: CourseTestItem[];
};

export type TestItemRuntimeAttempt = {
  id: string;
  lifecycle: "started" | "submitted" | "graded" | "deleted";
  rawScore: number | null;
  rawMaxScore: number | null;
  normalizedScore: number | null;
  normalizedMaxScore: number | null;
  state: Record<string, unknown>;
  submittedAt: string | null;
  gradedAt: string | null;
};

export type CourseTestRuntimeItem = CourseTestItem & {
  itemAttempt: TestItemRuntimeAttempt | null;
};

export type CourseTestRuntime = {
  test: Omit<CourseTest, "items"> & { items: CourseTestRuntimeItem[] };
  attempt: {
    id: string;
    attemptNumber: number;
    lifecycle: "started" | "submitted" | "graded" | "deleted";
    startedAt: string;
    submittedAt: string | null;
    gradedAt: string | null;
  } | null;
  timing: {
    timeLimitMinutes: number | null;
    expiresAt: string | null;
    remainingSeconds: number | null;
    isExpired: boolean;
  };
  resume: {
    allowed: boolean;
    blocked: boolean;
  };
  availability: {
    canStart: boolean;
    reason: string | null;
    attemptLimitMode?: string;
    maxAttempts?: number | null;
    usedAttempts?: number;
    attemptsRemaining: number | null;
    gradesReleased?: boolean;
  };
  hasPreviousSubmissions: boolean;
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

export type StudentActivitySubmissionAudit = {
  submittedAttemptCount: number;
  deletedSubmissions: DeletedSubmissionAudit[];
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

export type GradebookStatus = "all" | "missing" | "late" | "needs_grading" | "graded";

export type CourseGradebook = {
  filters: {
    groupId: string | null;
    activityId: string | null;
    status: GradebookStatus;
  };
  groups: Array<{ id: string; title: string }>;
  activities: Array<{ id: string; title: string }>;
  items: CourseGradebookItemSummary[];
  rows: CourseGradebookRow[];
};

export type CourseGradebookItemSummary = {
  gradebookItemId: string;
  groupId: string;
  groupTitle: string;
  activityId: string;
  activityTitle: string;
  activityTypeKey: string;
  activityTypeName: string;
  gradesReleased: boolean;
  pointsPossible: number;
  studentCount: number;
};

export type CourseGradebookRow = {
  gradebookItemId: string;
  groupId: string;
  groupTitle: string;
  activityId: string;
  activityTitle: string;
  activityTypeKey: string;
  activityTypeName: string;
  gradesReleased: boolean;
  participantId: string;
  participantName: string;
  participantEmail: string;
  externalId?: string | null;
  status: Exclude<GradebookStatus, "all">;
  score: number | null;
  maxScore: number;
  isPass: boolean | null;
  latePenaltyApplied: boolean;
  latePenaltyPercent: number | null;
  feedback: StudentGradeFeedback | null;
  selectedAttemptNumber: number | null;
  attemptCount: number;
  lateAttemptCount: number;
  submittedAttemptCount: number;
  needsGradingCount: number;
  attempts: Array<{
    id: string;
    attemptNumber: number;
    lifecycle: "started" | "submitted" | "graded" | "deleted";
    pluginAttemptRef: string | null;
    startedAt: string;
    submittedAt: string | null;
    gradedAt: string | null;
    isLate: boolean;
    lateBySeconds: number | null;
    durationSeconds: number | null;
  }>;
  deletedSubmissions: DeletedSubmissionAudit[];
};

export type GradebookMutationGrade = {
  id: string;
  selectedAttemptId: string | null;
  normalizedScore: number;
  normalizedMaxScore: number;
  isPass: boolean | null;
  latePenaltyApplied: boolean;
  latePenaltyPercent: number | null;
  source: "override" | "regrade";
};

export type GradebookMutationAttempt = {
  id: string;
  attemptNumber: number;
  lifecycle: "started" | "submitted" | "graded" | "deleted";
  submittedAt: string | null;
  gradedAt: string | null;
  isLate: boolean;
  lateBySeconds: number | null;
  durationSeconds: number | null;
};

export type StudentReleasedGrades = {
  rows: StudentReleasedGradeRow[];
};

export type StudentReleasedGradeRow = {
  gradebookItemId: string;
  activityId: string;
  activityTitle: string;
  activityTypeName: string;
  gradeKind: "final" | "latest";
  status: Exclude<GradebookStatus, "all">;
  score: number | null;
  maxScore: number;
  isPass: boolean | null;
  latePenaltyApplied: boolean;
  latePenaltyPercent: number | null;
  feedback: StudentGradeFeedback | null;
  selectedAttemptNumber: number | null;
  attemptCount: number;
  submittedAttemptCount: number;
  deletedSubmissions: DeletedSubmissionAudit[];
  availableFrom: string | null;
  availableUntil: string | null;
  gradedAt: string | null;
};

export type DeletedSubmissionAudit = {
  eventId: string;
  attemptId: string | null;
  attemptNumber: number | null;
  lifecycle: string | null;
  submittedAt: string | null;
  gradedAt: string | null;
  deletedAt: string;
  reason: string | null;
  actor: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  pluginKey: string | null;
  pluginAttemptRef: string | null;
  metadata: Record<string, unknown>;
  gradeSnapshot: Record<string, unknown> | null;
};

export type StudentGradeFeedback = {
  kind: string;
  feedbackText?: string | null;
  details?: Record<string, unknown>;
};

export type CourseTestAttemptReview = {
  id: string;
  attemptNumber: number;
  lifecycle: string;
  submittedAt: string | null;
  gradedAt: string | null;
  items: Array<{
    testItemId: string;
    activityId: string;
    activityTypeKey: string;
    title: string;
    pointsPossible: number;
    activity: Activity;
    itemAttempt: {
      id: string;
      lifecycle: string;
      rawScore: number | null;
      rawMaxScore: number | null;
      normalizedScore: number | null;
      normalizedMaxScore: number | null;
      state: Record<string, unknown>;
      feedback: Record<string, unknown>;
    };
  }>;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function apiAbsoluteUrl(path: string) {
  return `${API_URL}/api${path}`;
}

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

export function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  return request<T>(path, init);
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
  updateMyProfile: (input: UserProfileUpdate) =>
    request<{ user: CurrentUser }>("/users/me", {
      method: "PATCH",
      body: JSON.stringify(input)
    }),
  changeMyPassword: (input: UserPasswordChange) =>
    request<{ ok: true }>("/users/me/password", {
      method: "PUT",
      body: JSON.stringify(input)
    }),
  aiAgentConnections: () => request<{ connections: AiAgentConnection[]; preferences: AiAgentPreferences }>("/ai-agents"),
  updateAiAgentPreferences: (input: AiAgentPreferences) =>
    request<{ preferences: AiAgentPreferences }>("/ai-agents/preferences", {
      method: "PATCH",
      body: JSON.stringify(input)
    }),
  createAiAgentConnection: (input: AiAgentConnectionInput) =>
    request<{ connection: AiAgentConnection }>("/ai-agents", {
      method: "POST",
      body: JSON.stringify(input)
    }),
  updateAiAgentConnection: (connectionId: string, input: AiAgentConnectionUpdate) =>
    request<{ connection: AiAgentConnection }>(`/ai-agents/${connectionId}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    }),
  deleteAiAgentConnection: (connectionId: string) =>
    request<{ ok: true }>(`/ai-agents/${connectionId}`, {
      method: "DELETE"
    }),
  activityPlugins: () => request<{ plugins: ActivityPluginInstallation[] }>("/plugins"),
  updateActivityPlugin: (pluginKey: string, input: ActivityPluginInstallationUpdate) =>
    request<{ plugin: ActivityPluginInstallation }>(`/plugins/${pluginKey}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    }),
  contentTypePlugins: () => request<{ plugins: ContentTypePluginInstallation[] }>("/content-type-plugins"),
  updateContentTypePlugin: (pluginKey: string, input: ContentTypePluginInstallationUpdate) =>
    request<{ plugin: ContentTypePluginInstallation }>(`/content-type-plugins/${pluginKey}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    }),
  subjects: () => request<{ subjects: Subject[] }>("/subjects"),
  subject: (subjectId: string) => request<{ subject: Subject }>(`/subjects/${subjectId}`),
  createSubject: (input: SubjectInput) =>
    request<{ subject: Subject }>("/subjects", {
      method: "POST",
      body: JSON.stringify(input)
    }),
  updateSubject: (subjectId: string, input: SubjectUpdate) =>
    request<{ subject: Subject }>(`/subjects/${subjectId}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    }),
  activityBanks: (subjectId?: string) =>
    request<{ activityBanks: ActivityBank[] }>(`/activity-banks${subjectId ? `?subjectId=${encodeURIComponent(subjectId)}` : ""}`),
  activityBank: (activityBankId: string) => request<{ activityBank: ActivityBank }>(`/activity-banks/${activityBankId}`),
  createActivityBank: (input: ActivityBankInput) =>
    request<{ activityBank: ActivityBank }>("/activity-banks", {
      method: "POST",
      body: JSON.stringify(input)
    }),
  updateActivityBank: (activityBankId: string, input: ActivityBankUpdate) =>
    request<{ activityBank: ActivityBank }>(`/activity-banks/${activityBankId}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    }),
  bankActivities: (activityBankId: string) =>
    request<{ activities: BankActivity[] }>(`/activity-banks/${activityBankId}/activities`),
  createBankActivity: (activityBankId: string, input: BankActivityInput) =>
    request<{ activity: BankActivity }>(`/activity-banks/${activityBankId}/activities`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
  updateBankActivity: (activityBankId: string, bankActivityId: string, input: BankActivityUpdate) =>
    request<{ activity: BankActivity }>(`/activity-banks/${activityBankId}/activities/${bankActivityId}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    }),
  deleteBankActivity: (activityBankId: string, bankActivityId: string, input?: { force?: boolean }) =>
    request<{ ok: true; courseCount: number }>(`/activity-banks/${activityBankId}/activities/${bankActivityId}`, {
      method: "DELETE",
      body: JSON.stringify(input ?? {})
    }),
  courses: () => request<{ courses: Course[] }>("/courses"),
  course: (courseId: string) => request<{ course: Course }>(`/courses/${courseId}`),
  courseGradebook: (courseId: string, filters?: { groupId?: string; activityId?: string; status?: GradebookStatus }) => {
    const params = new URLSearchParams();
    if (filters?.groupId) {
      params.set("groupId", filters.groupId);
    }
    if (filters?.activityId) {
      params.set("activityId", filters.activityId);
    }
    if (filters?.status && filters.status !== "all") {
      params.set("status", filters.status);
    }
    const query = params.toString();
    return request<{ gradebook: CourseGradebook }>(`/courses/${courseId}/gradebook${query ? `?${query}` : ""}`);
  },
  courseGradebookCsvUrl: (courseId: string, filters?: { groupId?: string; activityId?: string; status?: GradebookStatus }) => {
    const params = new URLSearchParams({ format: "csv" });
    if (filters?.groupId) {
      params.set("groupId", filters.groupId);
    }
    if (filters?.activityId) {
      params.set("activityId", filters.activityId);
    }
    if (filters?.status && filters.status !== "all") {
      params.set("status", filters.status);
    }
    return `${API_URL}/api/courses/${courseId}/gradebook?${params.toString()}`;
  },
  setGradebookItemRelease: (courseId: string, gradebookItemId: string, input: { released: boolean }) =>
    request<{ gradebookItem: { id: string; gradesReleased: boolean } }>(
      `/courses/${courseId}/gradebook/items/${gradebookItemId}/release`,
      {
        method: "PATCH",
        body: JSON.stringify(input)
      }
    ),
  overrideGradebookGrade: (
    courseId: string,
    gradebookItemId: string,
    participantId: string,
    input: { score: number; maxScore?: number; isPass?: boolean | null; reason?: string | null; feedbackText?: string | null }
  ) =>
    request<{ grade: GradebookMutationGrade }>(
      `/courses/${courseId}/gradebook/items/${gradebookItemId}/participants/${participantId}/override`,
      {
        method: "PATCH",
        body: JSON.stringify(input)
      }
    ),
  regradeActivityAttempt: (courseId: string, attemptId: string, input?: { reason?: string | null }) =>
    request<{ result: { attempt: GradebookMutationAttempt; grade: GradebookMutationGrade } }>(
      `/courses/${courseId}/gradebook/attempts/${attemptId}/regrade`,
      {
        method: "POST",
        body: JSON.stringify(input ?? {})
      }
    ),
  gradeTestItem: (
    courseId: string,
    attemptId: string,
    testItemId: string,
    input: { score: number; reason?: string | null; feedbackText?: string | null }
  ) =>
    request<{ result: { attempt: GradebookMutationAttempt; grade: GradebookMutationGrade } }>(
      `/courses/${courseId}/gradebook/attempts/${attemptId}/test-items/${testItemId}/grade`,
      {
        method: "POST",
        body: JSON.stringify(input)
      }
    ),
  testAttemptReview: (courseId: string, attemptId: string) =>
    request<{ review: CourseTestAttemptReview }>(`/courses/${courseId}/gradebook/attempts/${attemptId}/test-review`),
  deleteActivitySubmission: (courseId: string, attemptId: string, input: { reason: string }) =>
    request<{ result: { attempt: GradebookMutationAttempt; grade: GradebookMutationGrade | null } }>(
      `/courses/${courseId}/gradebook/attempts/${attemptId}`,
      {
        method: "DELETE",
        body: JSON.stringify(input)
      }
    ),
  studentGroupGrades: (courseId: string, groupId: string) =>
    request<{ grades: StudentReleasedGrades }>(`/courses/${courseId}/groups/${groupId}/grades`),
  studentActivitySubmissions: (courseId: string, groupId: string, activityId: string) =>
    request<{ audit: StudentActivitySubmissionAudit }>(
      `/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/submissions`
    ),
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
  updateCourseSettings: (courseId: string, input: CourseSettingsInput) =>
    request<{ course: Course }>(`/courses/${courseId}/settings`, {
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
  assignActivityToAllCourseGroups: (courseId: string, activityId: string, input: CourseAllGroupsActivityAssignmentInput) =>
    request<{ activity: Activity }>(`/courses/${courseId}/activities/${activityId}/assign-all-groups`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
  removeActivityFromAllCourseGroupsPolicy: (courseId: string, activityId: string) =>
    request<{ activity: Activity }>(`/courses/${courseId}/activities/${activityId}/assign-all-groups`, {
      method: "DELETE"
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
      sampleTests: Array<{ id: string; input: string; output: string; testCode: string; title: string }>;
      referenceSolution: string;
      privateConfig?: CodingExerciseReferenceSolution["privateConfig"];
      activityConfig?: Record<string, unknown>;
      validateOnly?: boolean;
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
  generateCodingExercisePrompt: (courseId: string, activityId: string, input: CodingExercisePromptGenerationInput) =>
    request<CodingExercisePromptGenerationResult>(`/courses/${courseId}/activities/${activityId}/coding-exercises/generate-prompt`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
  generateCodingExerciseSolution: (courseId: string, activityId: string, input: CodingExerciseSolutionGenerationInput) =>
    request<CodingExerciseSolutionGenerationResult>(`/courses/${courseId}/activities/${activityId}/coding-exercises/generate-solution`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
  generateCodingExerciseTests: (courseId: string, activityId: string, input: CodingExerciseTestsGenerationInput) =>
    request<CodingExerciseTestsGenerationResult>(`/courses/${courseId}/activities/${activityId}/coding-exercises/generate-tests`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
  bankCodingExerciseHiddenTests: (activityBankId: string, bankActivityId: string) =>
    request<{ tests: CodingExerciseHiddenTest[]; referenceSolution: CodingExerciseReferenceSolution | null }>(
      `/activity-banks/${activityBankId}/activities/${bankActivityId}/coding-exercises/hidden-tests`
    ),
  saveBankCodingExerciseHiddenTests: (
    activityBankId: string,
    bankActivityId: string,
    input: {
      tests: Array<Omit<CodingExerciseHiddenTest, "orderIndex" | "metadata" | "createdAt" | "updatedAt"> & { orderIndex?: number }>;
      sampleTests: Array<{ id: string; input: string; output: string; testCode: string; title: string }>;
      referenceSolution: string;
      privateConfig?: CodingExerciseReferenceSolution["privateConfig"];
      activityConfig?: Record<string, unknown>;
      validateOnly?: boolean;
    }
  ) =>
    request<{ tests: CodingExerciseHiddenTest[]; referenceSolution: CodingExerciseReferenceSolution | null }>(
      `/activity-banks/${activityBankId}/activities/${bankActivityId}/coding-exercises/hidden-tests`,
      {
        method: "PUT",
        body: JSON.stringify(input)
      }
    ),
  generateBankCodingExercisePrompt: (activityBankId: string, bankActivityId: string, input: CodingExercisePromptGenerationInput) =>
    request<CodingExercisePromptGenerationResult>(
      `/activity-banks/${activityBankId}/activities/${bankActivityId}/coding-exercises/generate-prompt`,
      {
        method: "POST",
        body: JSON.stringify(input)
      }
    ),
  generateBankCodingExerciseSolution: (activityBankId: string, bankActivityId: string, input: CodingExerciseSolutionGenerationInput) =>
    request<CodingExerciseSolutionGenerationResult>(
      `/activity-banks/${activityBankId}/activities/${bankActivityId}/coding-exercises/generate-solution`,
      {
        method: "POST",
        body: JSON.stringify(input)
      }
    ),
  generateBankCodingExerciseTests: (activityBankId: string, bankActivityId: string, input: CodingExerciseTestsGenerationInput) =>
    request<CodingExerciseTestsGenerationResult>(
      `/activity-banks/${activityBankId}/activities/${bankActivityId}/coding-exercises/generate-tests`,
      {
        method: "POST",
        body: JSON.stringify(input)
      }
    ),
  webDesignExerciseTests: (courseId: string, activityId: string) =>
    request<{ tests: WebDesignExerciseTest[]; referenceBundle: WebDesignExerciseReferenceBundle | null }>(
      `/courses/${courseId}/activities/${activityId}/web-design-coding-exercises/tests`
    ),
  bankWebDesignExerciseTests: (activityBankId: string, bankActivityId: string) =>
    request<{ tests: WebDesignExerciseTest[]; referenceBundle: WebDesignExerciseReferenceBundle | null }>(
      `/activity-banks/${activityBankId}/activities/${bankActivityId}/web-design-coding-exercises/tests`
    ),
  webDesignExerciseExpectedResult: (courseId: string, activityId: string) =>
    request<{ imageDataUrl: string | null }>(`/courses/${courseId}/activities/${activityId}/web-design-coding-exercises/expected-result`),
  bankWebDesignExerciseExpectedResult: (activityBankId: string, bankActivityId: string) =>
    request<{ imageDataUrl: string | null }>(
      `/activity-banks/${activityBankId}/activities/${bankActivityId}/web-design-coding-exercises/expected-result`
    ),
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
  saveBankWebDesignExerciseTests: (
    activityBankId: string,
    bankActivityId: string,
    input: {
      shouldCaptureExpectedResult?: boolean;
      shouldCropExpectedResult?: boolean;
      referenceFiles: WebDesignExerciseFile[];
      tests: Array<Omit<WebDesignExerciseTest, "orderIndex" | "createdAt" | "updatedAt" | "validationSummary">>;
    }
  ) =>
    request<{ tests: WebDesignExerciseTest[]; referenceBundle: WebDesignExerciseReferenceBundle | null }>(
      `/activity-banks/${activityBankId}/activities/${bankActivityId}/web-design-coding-exercises/tests`,
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
  createTest: (courseId: string, input: {
    title: string;
    description?: string;
    lifecycle?: "draft" | "published" | "archived";
    settings?: Partial<CourseTestSettings>;
    position?: number;
    contentPlacement?: { parentId?: string | null; position?: number; isVisible?: boolean; titleSnapshot?: string; metadata?: Record<string, unknown> };
  }) => request<{ test: CourseTest }>(`/courses/${courseId}/tests`, { method: "POST", body: JSON.stringify(input) }),
  test: (courseId: string, activityId: string) =>
    request<{ test: CourseTest }>(`/courses/${courseId}/activities/${activityId}/test`),
  updateTest: (courseId: string, activityId: string, input: {
    title?: string;
    description?: string;
    lifecycle?: "draft" | "published" | "archived";
    settings?: Partial<CourseTestSettings>;
  }) => request<{ test: CourseTest }>(`/courses/${courseId}/activities/${activityId}/test`, { method: "PATCH", body: JSON.stringify(input) }),
  duplicateTest: (courseId: string, activityId: string, input: { title?: string } = {}) =>
    request<{ test: CourseTest }>(`/courses/${courseId}/activities/${activityId}/test/duplicate`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
  createTestItem: (courseId: string, activityId: string, input: Record<string, unknown>) =>
    request<{ item: CourseTestItem }>(`/courses/${courseId}/activities/${activityId}/test/items`, { method: "POST", body: JSON.stringify(input) }),
  updateTestItem: (courseId: string, activityId: string, itemId: string, input: Partial<Pick<CourseTestItem, "position" | "pointsPossible" | "isRequired" | "metadata">>) =>
    request<{ item: CourseTestItem }>(`/courses/${courseId}/activities/${activityId}/test/items/${itemId}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteTestItem: (courseId: string, activityId: string, itemId: string) =>
    request<{ ok: true }>(`/courses/${courseId}/activities/${activityId}/test/items/${itemId}`, { method: "DELETE" }),
  testRuntime: (courseId: string, groupId: string, activityId: string, view: "attempt" | "previous" = "attempt", sessionId = "") =>
    request<{ runtime: CourseTestRuntime }>(
      `/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/test?view=${view}&sessionId=${encodeURIComponent(sessionId)}`
    ),
  startTestAttempt: (courseId: string, groupId: string, activityId: string, sessionId: string) =>
    request<{ runtime: CourseTestRuntime }>(
      `/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/test`,
      { method: "POST", body: JSON.stringify({ sessionId }) }
    ),
  testItemAttempt: (courseId: string, groupId: string, activityId: string, testItemId: string, parentAttemptId: string, sessionId: string) =>
    request<{ itemAttempt: TestItemRuntimeAttempt | null }>(
      `/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/test/items/${testItemId}?parentAttemptId=${encodeURIComponent(parentAttemptId)}&sessionId=${encodeURIComponent(sessionId)}`
    ),
  saveTestItemState: (
    courseId: string,
    groupId: string,
    activityId: string,
    testItemId: string,
    parentAttemptId: string,
    state: Record<string, unknown>,
    sessionId: string
  ) => request<{ itemAttempt: TestItemRuntimeAttempt }>(
    `/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/test/items/${testItemId}`,
    { method: "PUT", body: JSON.stringify({ parentAttemptId, state, sessionId }) }
  ),
  executeTestItemAction: <TResult>(
    courseId: string,
    groupId: string,
    activityId: string,
    testItemId: string,
    parentAttemptId: string,
    sessionId: string,
    action: string,
    payload: unknown
  ) => request<TResult>(
    `/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/test/items/${testItemId}/actions/${encodeURIComponent(action)}`,
    { method: "POST", body: JSON.stringify({ parentAttemptId, sessionId, payload }) }
  ),
  submitTestAttempt: (courseId: string, groupId: string, activityId: string, parentAttemptId: string, sessionId: string) =>
    request<{ runtime: CourseTestRuntime }>(
      `/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}/test/submit`,
      { method: "POST", body: JSON.stringify({ parentAttemptId, sessionId }) }
    ),
  courseContent: (courseId: string, options?: { includeGroupItems?: boolean; visibleOnly?: boolean }) => {
    const params = new URLSearchParams();
    if (options?.includeGroupItems) {
      params.set("includeGroupItems", "true");
    }
    if (options?.visibleOnly) {
      params.set("visibleOnly", "true");
    }
    const query = params.toString();
    return request<{ contentItems: CourseContentItem[] }>(`/courses/${courseId}/content${query ? `?${query}` : ""}`);
  },
  courseContentTypes: (courseId: string) =>
    request<{ contentTypes: ContentTypeDefinition[]; activeContentTypes?: ContentTypeDefinition[] }>(`/courses/${courseId}/content-types`),
  courseContentResources: (courseId: string) =>
    request<{ resources: CourseContentResource[] }>(`/courses/${courseId}/content-resources`),
  createCourseContentResource: (
    courseId: string,
    input: {
      contentTypeKey: string;
      payload?: unknown;
      parentId?: string | null;
      position?: number;
      isVisible?: boolean;
      itemMetadata?: Record<string, unknown>;
    }
  ) =>
    request<{ resource: CourseContentResource; contentItem: CourseContentItem }>(`/courses/${courseId}/content-resources`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
  updateCourseContentResource: (
    courseId: string,
    resourceId: string,
    input: {
      payload?: unknown;
    }
  ) =>
    request<{ resource: CourseContentResource }>(`/courses/${courseId}/content-resources/${resourceId}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    }),
  uploadCourseContentResourceFile: async (courseId: string, resourceId: string, input: { title: string; file: File }) => {
    const formData = new FormData();
    formData.append("title", input.title);
    formData.append("file", input.file);
    const response = await fetch(`${API_URL}/api/courses/${courseId}/content-resources/${resourceId}/upload`, {
      cache: "no-store",
      method: "PUT",
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
    return body as { resource: CourseContentResource };
  },
  courseContentResourceDownloadUrl: (courseId: string, resourceId: string) =>
    `${API_URL}/api/courses/${courseId}/content-resources/${resourceId}/download`,
  deleteCourseContentResource: (courseId: string, resourceId: string) =>
    request<{ ok: true }>(`/courses/${courseId}/content-resources/${resourceId}`, {
      method: "DELETE"
    }),
  createContentFolder: (courseId: string, input: { title: string; parentId?: string | null; isVisible?: boolean; position?: number }) =>
    request<{ contentItem: CourseContentItem }>(`/courses/${courseId}/content/folders`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
  updateContentItem: (
    courseId: string,
    contentItemId: string,
    input: { titleSnapshot?: string | null; parentId?: string | null; isVisible?: boolean; position?: number; metadata?: Record<string, unknown> }
  ) =>
    request<{ contentItem: CourseContentItem }>(`/courses/${courseId}/content/${contentItemId}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    }),
  deleteContentItem: (courseId: string, contentItemId: string) =>
    request<{ ok: true }>(`/courses/${courseId}/content/${contentItemId}`, {
      method: "DELETE"
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
  deleteMaterial: (courseId: string, materialId: string) =>
    request<{ ok: true }>(`/courses/${courseId}/materials/${materialId}`, {
      method: "DELETE"
    }),
  materialDownloadUrl: (courseId: string, materialId: string) =>
    `${API_URL}/api/courses/${courseId}/materials/${materialId}/download`,
  groupCourseMaterialDownloadUrl: (courseId: string, groupId: string, materialId: string) =>
    `${API_URL}/api/courses/${courseId}/groups/${groupId}/course-materials/${materialId}/download`,
  deleteGroupMaterial: (courseId: string, groupId: string, materialId: string) =>
    request<{ ok: true }>(`/courses/${courseId}/groups/${groupId}/materials/${materialId}`, {
      method: "DELETE"
    }),
  groupMaterialDownloadUrl: (courseId: string, groupId: string, materialId: string) =>
    `${API_URL}/api/courses/${courseId}/groups/${groupId}/materials/${materialId}/download`,
  groupActivityAssignments: (courseId: string, groupId: string) =>
    request<{ assignments: CourseGroupActivityAssignment[] }>(`/courses/${courseId}/groups/${groupId}/activities`),
  groupContent: (courseId: string, groupId: string, options?: { visibleOnly?: boolean }) => {
    const query = options?.visibleOnly ? "?visibleOnly=true" : "";
    return request<{ contentItems: CourseContentItem[] }>(`/courses/${courseId}/groups/${groupId}/content${query}`);
  },
  groupContentResources: (courseId: string, groupId: string) =>
    request<{ resources: CourseContentResource[] }>(`/courses/${courseId}/groups/${groupId}/content-resources`),
  createGroupContentResource: (
    courseId: string,
    groupId: string,
    input: {
      contentTypeKey: string;
      payload?: unknown;
      parentId?: string | null;
      position?: number;
      isVisible?: boolean;
      itemMetadata?: Record<string, unknown>;
    }
  ) =>
    request<{ resource: CourseContentResource; contentItem: CourseContentItem }>(
      `/courses/${courseId}/groups/${groupId}/content-resources`,
      {
        method: "POST",
        body: JSON.stringify(input)
      }
    ),
  updateGroupContentResource: (
    courseId: string,
    groupId: string,
    resourceId: string,
    input: {
      payload?: unknown;
    }
  ) =>
    request<{ resource: CourseContentResource }>(`/courses/${courseId}/groups/${groupId}/content-resources/${resourceId}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    }),
  groupContentResourceDownloadUrl: (courseId: string, groupId: string, resourceId: string) =>
    `${API_URL}/api/courses/${courseId}/groups/${groupId}/content-resources/${resourceId}/download`,
  deleteGroupContentResource: (courseId: string, groupId: string, resourceId: string) =>
    request<{ ok: true }>(`/courses/${courseId}/groups/${groupId}/content-resources/${resourceId}`, {
      method: "DELETE"
    }),
  createGroupActivityContentItem: (
    courseId: string,
    groupId: string,
    input: { activityId: string; parentId?: string | null; titleSnapshot?: string | null; isVisible?: boolean; position?: number }
  ) =>
    request<{ contentItem: CourseContentItem }>(`/courses/${courseId}/groups/${groupId}/content/activities`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
  updateGroupContentItem: (
    courseId: string,
    groupId: string,
    contentItemId: string,
    input: { titleSnapshot?: string | null; parentId?: string | null; isVisible?: boolean; position?: number; metadata?: Record<string, unknown> }
  ) =>
    request<{ contentItem: CourseContentItem }>(`/courses/${courseId}/groups/${groupId}/content/${contentItemId}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    }),
  deleteGroupContentItem: (courseId: string, groupId: string, contentItemId: string) =>
    request<{ ok: true }>(`/courses/${courseId}/groups/${groupId}/content/${contentItemId}`, {
      method: "DELETE"
    }),
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
      sampleTests: Array<{ id: string; input: string; output: string; testCode: string; title: string }>;
      referenceSolution: string;
      privateConfig?: CodingExerciseReferenceSolution["privateConfig"];
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
