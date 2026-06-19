import { AppError } from "@cognelo/core";

export type CodingHomeworkProcessingEvent = {
  at: string;
  category?: string;
  code?: string;
  message?: string;
  operationId?: string;
  retryable?: boolean;
  stage: string;
  status: "started" | "completed" | "failed";
};

export type CodingHomeworkProcessingError = {
  at: string;
  category: string;
  code: string;
  message: string;
  retryable: boolean;
  status?: number;
};

const MAX_TIMELINE_EVENTS = 80;

export function buildProcessingOperationId(stage: string, idempotencyKey?: string | null) {
  return idempotencyKey ? `${stage}:${idempotencyKey}` : `${stage}:${new Date().toISOString()}`;
}

export function appendProcessingEvent(metadata: unknown, event: CodingHomeworkProcessingEvent) {
  const object = normalizeObject(metadata);
  const currentTimeline = Array.isArray(object.processingTimeline) ? object.processingTimeline : [];
  return {
    ...object,
    currentProcessingStep: event.status === "started" ? event.stage : null,
    processingTimeline: [...currentTimeline, event].slice(-MAX_TIMELINE_EVENTS)
  };
}

export function buildProcessingEvent(input: Omit<CodingHomeworkProcessingEvent, "at"> & { at?: string }) {
  return {
    at: input.at ?? new Date().toISOString(),
    ...input
  };
}

export function categorizeProcessingError(error: unknown): CodingHomeworkProcessingError {
  const appError = isAppErrorLike(error) ? error : null;
  const code = appError?.code ?? "CODING_HOMEWORK_PROCESSING_ERROR";
  const status = appError?.status;
  return {
    at: new Date().toISOString(),
    category: categoryForError(code, status),
    code,
    message: error instanceof Error ? error.message : "Coding homework processing failed.",
    retryable: retryableForError(code, status),
    ...(status ? { status } : {})
  };
}

export function processingFailureMetadata(metadata: unknown, stage: string, error: unknown, operationId?: string | null) {
  const categorized = categorizeProcessingError(error);
  return {
    metadata: appendProcessingEvent(
      {
        ...normalizeObject(metadata),
        processingError: categorized
      },
      buildProcessingEvent({
        category: categorized.category,
        code: categorized.code,
        message: categorized.message,
        operationId: operationId ?? undefined,
        retryable: categorized.retryable,
        stage,
        status: "failed"
      })
    ),
    processingError: categorized
  };
}

function categoryForError(code: string, status?: number) {
  if (code.includes("AI_AGENT") || code.includes("CHALLENGE_GENERATION")) {
    return "generation";
  }
  if (code.includes("ZIP") || code.includes("UPLOAD") || code.includes("STRUCTURE")) {
    return "submission";
  }
  if (code.includes("DOCUMENTATION") || code.includes("REFERENCE")) {
    return "reference";
  }
  if (status === 401 || status === 403) {
    return "authorization";
  }
  if (status === 429) {
    return "rate_limit";
  }
  return "processing";
}

function retryableForError(code: string, status?: number) {
  if (status && [400, 401, 403, 404, 409, 413, 422].includes(status)) {
    return false;
  }
  if (code.includes("LOCAL_MODEL_NOT_ALLOWED") || code.includes("INVALID_STRUCTURE")) {
    return false;
  }
  return true;
}

function isAppErrorLike(error: unknown): error is AppError & { status?: number; code: string } {
  return Boolean(error && typeof error === "object" && "code" in error && typeof (error as { code?: unknown }).code === "string");
}

function normalizeObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
