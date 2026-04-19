import type {
  ActivityInput,
  ActivityUpdate,
  CourseInput,
  CourseMaterialInput,
  CourseMaterialUpdate,
  CourseUpdate,
  CurrentUser,
  MaterialKind
} from "@cognara/contracts";

export type Course = {
  id: string;
  title: string;
  description: string;
  status: "draft" | "published" | "archived";
  memberships?: unknown[];
  materials?: CourseMaterial[];
  activities?: Activity[];
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

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

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
    throw new Error(body?.error?.message ?? "Request failed.");
  }
  return body as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ user: CurrentUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
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
  activityTypes: () => request<{ activityTypes: ActivityType[]; registeredDefinitions: ActivityDefinition[] }>("/activity-types"),
  activity: (courseId: string, activityId: string) =>
    request<{ activity: Activity }>(`/courses/${courseId}/activities/${activityId}`),
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
      throw new Error(body?.error?.message ?? "Upload failed.");
    }
    return body as { material: CourseMaterial };
  },
  materialDownloadUrl: (courseId: string, materialId: string) =>
    `${API_URL}/api/courses/${courseId}/materials/${materialId}/download`
};
