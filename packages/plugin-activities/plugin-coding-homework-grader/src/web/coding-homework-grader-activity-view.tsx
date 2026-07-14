"use client";

import { type ChangeEvent, type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MarkdownRenderer, useNotifications, useUnsavedChangesGuard } from "@cognelo/activity-ui";
import {
  type CodingHomeworkAssignmentRecord,
  type CodingHomeworkAttachmentRecord,
  type CodingHomeworkAuthoringInput,
  type CodingHomeworkAuthoringRecord,
  type CodingHomeworkAuthoringSubmissionRequirements,
  type CodingHomeworkDocumentationExtractionResult,
  type CodingHomeworkDocumentationPreview,
  type CodingHomeworkDocumentationSnapshotResult,
  type CodingHomeworkLatestSubmissionResult,
  type CodingHomeworkPreflightResult,
  type CodingHomeworkStudentAssignment,
  type CodingHomeworkStudentChallengeQuestionRecord,
  type CodingHomeworkSubmissionRecord,
  type CodingHomeworkSubmissionResult
} from "./client";
import { type CodingHomeworkCopy, type CodingHomeworkLocale, codingHomeworkMessages } from "./messages";

type RenderableActivity = {
  id: string;
  title: string;
  description: string;
  lifecycle: string;
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  activityType: {
    key: string;
    name: string;
    description: string;
  };
};

type SaveActivity = (input: { title: string; description: string; config: Record<string, unknown> }) => Promise<RenderableActivity>;

type AuthoringClient = {
  get: (activityId: string) => Promise<CodingHomeworkAuthoringRecord>;
  createDocumentationSnapshot?: (activityId: string) => Promise<CodingHomeworkDocumentationSnapshotResult>;
  extractDocumentation?: (activityId: string, input?: { snapshotId?: string | null }) => Promise<CodingHomeworkDocumentationExtractionResult>;
  getDocumentationPreview?: (activityId: string) => Promise<CodingHomeworkDocumentationPreview>;
  importRequirements: (activityId: string, input: { base64: string; fileName: string; mimeType?: string }) => Promise<CodingHomeworkAuthoringRecord>;
  save: (activityId: string, input: CodingHomeworkAuthoringInput) => Promise<CodingHomeworkAuthoringRecord>;
  uploadAssignmentPdf: (activityId: string, input: { base64: string; fileName: string; mimeType?: string }) => Promise<CodingHomeworkAuthoringRecord>;
};

type PreflightClient = {
  run: (activityId: string, input: { base64: string; fileName: string; mimeType?: string }) => Promise<CodingHomeworkPreflightResult>;
};

type SubmissionClient = {
  saveAnswers: (
    activityId: string,
    input: { answers: Array<{ questionId: string; answer: string }>; submissionId?: string | null }
  ) => Promise<{ questions: CodingHomeworkStudentChallengeQuestionRecord[]; submission: CodingHomeworkSubmissionRecord }>;
  getAssignment: (activityId: string) => Promise<CodingHomeworkStudentAssignment>;
  getLatestSubmission: (activityId: string) => Promise<CodingHomeworkLatestSubmissionResult>;
  submit: (activityId: string, input: { base64: string; fileName: string; idempotencyKey?: string; locale?: CodingHomeworkLocale; mimeType?: string }) => Promise<CodingHomeworkSubmissionResult>;
  submitAnswers: (
    activityId: string,
    input: { answers: Array<{ questionId: string; answer: string }>; submissionId?: string | null }
  ) => Promise<{ questions: CodingHomeworkStudentChallengeQuestionRecord[]; submission: CodingHomeworkSubmissionRecord }>;
};

type CodingHomeworkGraderActivityViewProps = {
  activity: RenderableActivity;
  authoringClient?: AuthoringClient;
  canManage: boolean;
  course?: { id: string; title?: string } | null;
  locale?: CodingHomeworkLocale;
  onSave?: SaveActivity;
  preflightClient?: PreflightClient;
  submissionClient?: SubmissionClient;
};

type RequirementDraft = {
  allowedExtensionsText: string;
  ignoredPathsText: string;
  maxArchiveMb: number;
  maxFileCount: number;
  requiredFilesText: string;
  requiredFoldersText: string;
  requiredFunctionsText: string;
};

const defaultRequirements: CodingHomeworkAuthoringSubmissionRequirements = {
  allowedExtensions: [".c", ".h"],
  ignoredPaths: [],
  languageKey: "c",
  maxArchiveBytes: 25 * 1024 * 1024,
  maxFileCount: 200,
  requiredFiles: [],
  requiredFolders: [],
  requiredFunctions: []
};
const processingPollIntervalMs = 2500;

function defaultAuthoring(activity: RenderableActivity): CodingHomeworkAuthoringRecord {
  const now = new Date().toISOString();
  return {
    assignment: {
      id: null,
      candidateLimit: 5,
      createdAt: now,
      generationInstructions: "",
      languageKey: readString(activity.config?.languageKey, "c"),
      promptMarkdown: "",
      promptPdfAttachmentId: null,
      questionCount: readNumber(activity.config?.questionCount, 3),
      retrievedExampleCount: 3,
      settings: {},
      updatedAt: now
    },
    assignmentPdf: null,
    requirements: {
      id: null,
      createdAt: now,
      languageKey: "c",
      metadata: {},
      requirements: defaultRequirements,
      sourceAttachmentId: null,
      updatedAt: now
    },
    requirementsUpload: null
  };
}

export function CodingHomeworkGraderActivityView({
  activity,
  authoringClient,
  canManage,
  locale = "en",
  onSave,
  preflightClient,
  submissionClient
}: CodingHomeworkGraderActivityViewProps) {
  const copy: CodingHomeworkCopy = codingHomeworkMessages[locale] ?? codingHomeworkMessages.en;
  const notifications = useNotifications();
  const [title, setTitle] = useState(activity.title);
  const [description, setDescription] = useState(activity.description);
  const [assignment, setAssignment] = useState<CodingHomeworkAssignmentRecord>(() => defaultAuthoring(activity).assignment);
  const [assignmentPdf, setAssignmentPdf] = useState<CodingHomeworkAttachmentRecord | null>(null);
  const [requirementDraft, setRequirementDraft] = useState<RequirementDraft>(() => requirementsToDraft(defaultRequirements));
  const [requirementsUpload, setRequirementsUpload] = useState<CodingHomeworkAttachmentRecord | null>(null);
  const [loading, setLoading] = useState(Boolean(canManage && authoringClient));
  const [documentationPreview, setDocumentationPreview] = useState<CodingHomeworkDocumentationPreview | null>(null);
  const [loadingDocumentation, setLoadingDocumentation] = useState(false);
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);
  const [extractingDocumentation, setExtractingDocumentation] = useState(false);
  const [preflightResult, setPreflightResult] = useState<CodingHomeworkPreflightResult | null>(null);
  const [runningPreflight, setRunningPreflight] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [importingRequirements, setImportingRequirements] = useState(false);
  const [studentAssignment, setStudentAssignment] = useState<CodingHomeworkStudentAssignment | null>(null);
  const [latestSubmission, setLatestSubmission] = useState<CodingHomeworkLatestSubmissionResult>(null);
  const [submissionResult, setSubmissionResult] = useState<CodingHomeworkSubmissionResult | null>(null);
  const [challengeQuestions, setChallengeQuestions] = useState<CodingHomeworkStudentChallengeQuestionRecord[]>([]);
  const [challengeAnswers, setChallengeAnswers] = useState<Record<string, string>>({});
  const [savingAnswers, setSavingAnswers] = useState(false);
  const [submittingAnswers, setSubmittingAnswers] = useState(false);
  const [loadingStudentAssignment, setLoadingStudentAssignment] = useState(Boolean(!canManage && submissionClient));
  const [submitting, setSubmitting] = useState(false);
  const savedSnapshotRef = useRef("");

  const applyAuthoring = useCallback(
    (record: CodingHomeworkAuthoringRecord, nextTitle: string, nextDescription: string) => {
      const nextRequirementDraft = requirementsToDraft(record.requirements.requirements);
      setAssignment(record.assignment);
      setAssignmentPdf(record.assignmentPdf);
      setRequirementDraft(nextRequirementDraft);
      setRequirementsUpload(record.requirementsUpload);
      savedSnapshotRef.current = serializeSnapshot({
        assignment: record.assignment,
        description: nextDescription,
        requirementDraft: nextRequirementDraft,
        title: nextTitle
      });
    },
    []
  );

  useEffect(() => {
    setTitle(activity.title);
    setDescription(activity.description);
  }, [activity.description, activity.id, activity.title]);

  const applyChallengeQuestions = useCallback((questions: CodingHomeworkStudentChallengeQuestionRecord[]) => {
    setChallengeQuestions(questions);
    setChallengeAnswers(
      Object.fromEntries(questions.map((question) => [question.id, question.studentAnswer ?? ""]))
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!canManage || !authoringClient) {
      const initial = defaultAuthoring(activity);
      applyAuthoring(initial, activity.title, activity.description);
      setLoading(false);
      return;
    }

    setLoading(true);
    authoringClient
      .get(activity.id)
      .then((record) => {
        if (!cancelled) {
          applyAuthoring(record, activity.title, activity.description);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          notifications.error(error instanceof Error ? error.message : copy.saveError);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activity, applyAuthoring, authoringClient, canManage, copy.saveError, notifications]);

  useEffect(() => {
    let cancelled = false;
    if (canManage || !submissionClient) {
      setStudentAssignment(null);
      setLatestSubmission(null);
      applyChallengeQuestions([]);
      setLoadingStudentAssignment(false);
      return;
    }

    setLoadingStudentAssignment(true);
    submissionClient
      .getAssignment(activity.id)
      .then((record) => {
        if (!cancelled) {
          setStudentAssignment(record);
          setLatestSubmission(record.latestSubmission);
          applyChallengeQuestions(record.latestSubmission?.questions ?? []);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          notifications.error(error instanceof Error ? error.message : copy.saveError);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingStudentAssignment(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activity.id, applyChallengeQuestions, canManage, copy.saveError, notifications, submissionClient]);

  const latestSubmissionId = latestSubmission?.submission.id ?? null;
  const latestSubmissionStatus = latestSubmission?.submission.status ?? null;

  useEffect(() => {
    if (canManage || !submissionClient || !latestSubmissionId || !isSubmissionProcessing(latestSubmissionStatus) || challengeQuestions.length) {
      return;
    }

    let cancelled = false;
    const refresh = async () => {
      try {
        const next = await submissionClient.getLatestSubmission(activity.id);
        if (cancelled || !next) {
          return;
        }
        setLatestSubmission(next);
        applyChallengeQuestions(next.questions);
      } catch {
        // Keep polling; transient job/status checks should not interrupt the student.
      }
    };
    const interval = window.setInterval(() => {
      void refresh();
    }, processingPollIntervalMs);
    void refresh();
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activity.id, applyChallengeQuestions, canManage, challengeQuestions.length, latestSubmissionId, latestSubmissionStatus, submissionClient]);

  const loadDocumentationPreview = useCallback(
    async (options?: { notify?: boolean }) => {
      if (!authoringClient?.getDocumentationPreview) {
        setDocumentationPreview(null);
        return;
      }

      setLoadingDocumentation(true);
      try {
        const preview = await authoringClient.getDocumentationPreview(activity.id);
        setDocumentationPreview(preview);
        if (options?.notify) {
          notifications.success(copy.documentationUpdated);
        }
      } catch (error) {
        notifications.error(error instanceof Error ? error.message : copy.saveError);
      } finally {
        setLoadingDocumentation(false);
      }
    },
    [activity.id, authoringClient, copy.documentationUpdated, copy.saveError, notifications]
  );

  useEffect(() => {
    if (!canManage || !authoringClient?.getDocumentationPreview) {
      setDocumentationPreview(null);
      setLoadingDocumentation(false);
      return;
    }

    void loadDocumentationPreview();
  }, [authoringClient, canManage, loadDocumentationPreview]);

  const currentSnapshot = useMemo(
    () =>
      serializeSnapshot({
        assignment,
        description,
        requirementDraft,
        title
      }),
    [assignment, description, requirementDraft, title]
  );
  const hasUnsavedChanges = savedSnapshotRef.current !== "" && currentSnapshot !== savedSnapshotRef.current;

  const discardChanges = useCallback(() => {
    if (!savedSnapshotRef.current) {
      return;
    }
    const snapshot = JSON.parse(savedSnapshotRef.current) as {
      assignment: CodingHomeworkAssignmentRecord;
      description: string;
      requirementDraft: RequirementDraft;
      title: string;
    };
    setAssignment(snapshot.assignment);
    setDescription(snapshot.description);
    setRequirementDraft(snapshot.requirementDraft);
    setTitle(snapshot.title);
  }, []);

  const saveHomework = useCallback(
    async (options?: { rethrow?: boolean }) => {
      if (!authoringClient || !onSave) {
        return;
      }

      setSaving(true);
      try {
        const requirements = draftToRequirements(requirementDraft, assignment.languageKey);
        await onSave({
          title,
          description,
          config: {
            ...(activity.config ?? {}),
            languageKey: assignment.languageKey,
            questionCount: assignment.questionCount
          }
        });
        const record = await authoringClient.save(activity.id, {
          assignment: {
            candidateLimit: assignment.candidateLimit,
            generationInstructions: assignment.generationInstructions,
            languageKey: assignment.languageKey,
            promptMarkdown: assignment.promptMarkdown,
            promptPdfAttachmentId: assignment.promptPdfAttachmentId,
            questionCount: assignment.questionCount,
            retrievedExampleCount: assignment.retrievedExampleCount,
            settings: assignment.settings
          },
          requirements
        });
        applyAuthoring(record, title, description);
        notifications.success(copy.saved);
      } catch (error) {
        notifications.error(error instanceof Error ? error.message : copy.saveError);
        if (options?.rethrow) {
          throw error;
        }
      } finally {
        setSaving(false);
      }
    },
    [activity.config, activity.id, applyAuthoring, assignment, authoringClient, copy.saveError, copy.saved, description, notifications, onSave, requirementDraft, title]
  );

  useUnsavedChangesGuard(
    useMemo(
      () => ({
        isDirty: hasUnsavedChanges,
        onDiscard: discardChanges,
        onSave: () => saveHomework({ rethrow: true })
      }),
      [discardChanges, hasUnsavedChanges, saveHomework]
    )
  );

  async function saveForm(event: FormEvent) {
    event.preventDefault();
    await saveHomework();
  }

  async function uploadPdf(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !authoringClient) {
      return;
    }

    setUploadingPdf(true);
    try {
      const wasDirty = hasUnsavedChanges;
      const record = await authoringClient.uploadAssignmentPdf(activity.id, await fileToUploadInput(file));
      const nextAssignment = {
        ...assignment,
        promptPdfAttachmentId: record.assignment.promptPdfAttachmentId
      };
      setAssignment(nextAssignment);
      setAssignmentPdf(record.assignmentPdf);
      if (!wasDirty) {
        savedSnapshotRef.current = serializeSnapshot({
          assignment: nextAssignment,
          description,
          requirementDraft,
          title
        });
      }
      notifications.success(copy.pdfUploaded);
    } catch (error) {
      notifications.error(error instanceof Error ? error.message : copy.saveError);
    } finally {
      setUploadingPdf(false);
    }
  }

  async function importRequirements(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !authoringClient) {
      return;
    }

    setImportingRequirements(true);
    try {
      const wasDirty = hasUnsavedChanges;
      const record = await authoringClient.importRequirements(activity.id, await fileToUploadInput(file));
      const nextRequirementDraft = requirementsToDraft(record.requirements.requirements);
      setRequirementDraft(nextRequirementDraft);
      setRequirementsUpload(record.requirementsUpload);
      if (!wasDirty) {
        savedSnapshotRef.current = serializeSnapshot({
          assignment,
          description,
          requirementDraft: nextRequirementDraft,
          title
        });
      }
      notifications.success(copy.requirementsImported);
    } catch (error) {
      notifications.error(error instanceof Error ? error.message : copy.saveError);
    } finally {
      setImportingRequirements(false);
    }
  }

  async function createDocumentationSnapshot() {
    if (!authoringClient?.createDocumentationSnapshot) {
      return;
    }

    setCreatingSnapshot(true);
    try {
      const result = await authoringClient.createDocumentationSnapshot(activity.id);
      setDocumentationPreview(result.preview);
      notifications.success(copy.documentationSnapshotCreated);
    } catch (error) {
      notifications.error(error instanceof Error ? error.message : copy.documentationSnapshotError);
    } finally {
      setCreatingSnapshot(false);
    }
  }

  async function extractDocumentationSources() {
    const snapshotId = documentationPreview?.latestSnapshot?.id;
    if (!authoringClient?.extractDocumentation || !snapshotId) {
      return;
    }

    setExtractingDocumentation(true);
    try {
      const result = await authoringClient.extractDocumentation(activity.id, { snapshotId });
      setDocumentationPreview((current) =>
        current
          ? {
              ...current,
              latestSnapshot: result.snapshot
            }
          : current
      );
      notifications.success(copy.extractionCompleted);
    } catch (error) {
      notifications.error(error instanceof Error ? error.message : copy.extractionError);
    } finally {
      setExtractingDocumentation(false);
    }
  }

  async function runPreflight(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !preflightClient) {
      return;
    }

    setRunningPreflight(true);
    try {
      const result = await preflightClient.run(activity.id, await fileToUploadInput(file));
      setPreflightResult(result);
      notifications[result.summary.isValid ? "success" : "error"](result.summary.isValid ? copy.preflightReady : copy.preflightInvalid);
    } catch (error) {
      notifications.error(error instanceof Error ? error.message : copy.preflightError);
    } finally {
      setRunningPreflight(false);
    }
  }

  async function submitFinalSubmission(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !submissionClient) {
      return;
    }

    setSubmitting(true);
    try {
      const result = await submissionClient.submit(activity.id, {
        ...(await fileToUploadInput(file)),
        idempotencyKey: uploadIdempotencyKey(activity.id, file),
        locale
      });
      setSubmissionResult(result);
      const questions = result.questions ?? [];
      setLatestSubmission({ files: result.files, questions, submission: result.submission });
      applyChallengeQuestions(questions);
      notifications[result.summary.isValid ? "success" : "error"](result.summary.isValid ? (questions.length ? copy.challengesReady : copy.submissionProcessing) : copy.submissionInvalid);
    } catch (error) {
      notifications.error(error instanceof Error ? error.message : copy.submissionError);
    } finally {
      setSubmitting(false);
    }
  }

  async function saveChallengeAnswers() {
    if (!submissionClient || !latestSubmission) {
      return;
    }

    setSavingAnswers(true);
    try {
      const result = await submissionClient.saveAnswers(activity.id, {
        answers: challengeQuestions.map((question) => ({ questionId: question.id, answer: challengeAnswers[question.id] ?? "" })),
        submissionId: latestSubmission.submission.id
      });
      setLatestSubmission((current) => (current ? { ...current, questions: result.questions, submission: result.submission } : current));
      applyChallengeQuestions(result.questions);
      notifications.success(copy.answersSaved);
    } catch (error) {
      notifications.error(error instanceof Error ? error.message : copy.answersError);
    } finally {
      setSavingAnswers(false);
    }
  }

  async function submitChallengeAnswers() {
    if (!submissionClient || !latestSubmission) {
      return;
    }

    setSubmittingAnswers(true);
    try {
      const result = await submissionClient.submitAnswers(activity.id, {
        answers: challengeQuestions.map((question) => ({ questionId: question.id, answer: challengeAnswers[question.id] ?? "" })),
        submissionId: latestSubmission.submission.id
      });
      setLatestSubmission((current) => (current ? { ...current, questions: result.questions, submission: result.submission } : current));
      applyChallengeQuestions(result.questions);
      notifications.success(copy.answersSubmitted);
    } catch (error) {
      notifications.error(error instanceof Error ? error.message : copy.answersError);
    } finally {
      setSubmittingAnswers(false);
    }
  }

  if (!canManage) {
    const submissionStatus = latestSubmission?.submission.status ?? null;
    const processingSubmission = isSubmissionProcessing(submissionStatus) && !challengeQuestions.length;
    return (
      <section className="section stack" aria-busy={processingSubmission}>
        <h2>{activity.title}</h2>
        {loadingStudentAssignment ? <p>{copy.loading}</p> : <MarkdownRenderer markdown={studentAssignment?.assignment.promptMarkdown || activity.description} />}
        {studentAssignment?.assignment.promptPdf ? <p className="muted">{studentAssignment.assignment.promptPdf.originalName}</p> : null}
        <PreflightPanel copy={copy} disabled={processingSubmission} preflightResult={preflightResult} runningPreflight={runningPreflight} onUpload={runPreflight} />
        {submissionClient ? (
          <>
            <SubmissionPanel
              copy={copy}
              disabled={processingSubmission}
              latestSubmission={latestSubmission}
              onUpload={submitFinalSubmission}
              submissionResult={submissionResult}
              submitting={submitting}
            />
            <ChallengeQuestionsPanel
              answers={challengeAnswers}
              copy={copy}
              questions={challengeQuestions}
              saving={savingAnswers}
              status={latestSubmission?.submission.status ?? null}
              submitting={submittingAnswers}
              onAnswerChange={(questionId, answer) => setChallengeAnswers((current) => ({ ...current, [questionId]: answer }))}
              onSave={() => void saveChallengeAnswers()}
              onSubmit={() => void submitChallengeAnswers()}
            />
            {processingSubmission ? <ProcessingWaitPanel copy={copy} startedAt={latestSubmission?.submission.createdAt ?? null} /> : null}
          </>
        ) : null}
      </section>
    );
  }

  if (loading) {
    return (
      <section className="section stack">
        <p>{copy.loading}</p>
      </section>
    );
  }

  return (
    <form className="section stack" onSubmit={saveForm}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{copy.teacherSetup}</p>
          <h2>{copy.authoringTitle}</h2>
        </div>
        <button className="button primary" disabled={saving || !authoringClient || !onSave} type="submit">
          {saving ? "..." : copy.save}
        </button>
      </div>

      <div className="coding-homework-authoring-grid">
        <section className="stack">
          <div className="field">
            <label htmlFor="coding-homework-title">{copy.title}</label>
            <input id="coding-homework-title" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="coding-homework-description">{copy.description}</label>
            <textarea
              id="coding-homework-description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={copy.activityDescription}
            />
          </div>
          <div className="field">
            <label htmlFor="coding-homework-prompt">{copy.prompt}</label>
            <textarea
              id="coding-homework-prompt"
              rows={14}
              value={assignment.promptMarkdown}
              onChange={(event) => setAssignment((current) => ({ ...current, promptMarkdown: event.target.value }))}
            />
          </div>
          <div className="field">
            <label>{copy.assignmentPdf}</label>
            <div className="inline-actions">
              <label className="button secondary">
                {uploadingPdf ? "..." : copy.uploadPdf}
                <input accept="application/pdf,.pdf" hidden type="file" onChange={uploadPdf} />
              </label>
              <span className="muted">{assignmentPdf?.originalName ?? copy.noPdf}</span>
            </div>
          </div>
        </section>

        <section className="stack">
          <div className="settings-grid">
            <div className="field">
              <label htmlFor="coding-homework-language">{copy.language}</label>
              <select
                id="coding-homework-language"
                value={assignment.languageKey}
                onChange={(event) => {
                  const languageKey = event.target.value;
                  setAssignment((current) => ({ ...current, languageKey }));
                  setRequirementDraft((current) => ({ ...current }));
                }}
              >
                <option value="c">C</option>
              </select>
            </div>
            <NumberField
              id="coding-homework-question-count"
              label={copy.questionCount}
              max={20}
              min={1}
              value={assignment.questionCount}
              onChange={(questionCount) => setAssignment((current) => ({ ...current, questionCount }))}
            />
            <NumberField
              id="coding-homework-candidate-limit"
              label={copy.candidateLimit}
              max={50}
              min={1}
              value={assignment.candidateLimit}
              onChange={(candidateLimit) => setAssignment((current) => ({ ...current, candidateLimit }))}
            />
            <NumberField
              id="coding-homework-retrieved-examples"
              label={copy.retrievedExamples}
              max={20}
              min={1}
              value={assignment.retrievedExampleCount}
              onChange={(retrievedExampleCount) => setAssignment((current) => ({ ...current, retrievedExampleCount }))}
            />
          </div>

          <div className="field">
            <label htmlFor="coding-homework-generation-instructions">{copy.generationInstructions}</label>
            <textarea
              id="coding-homework-generation-instructions"
              rows={4}
              value={assignment.generationInstructions}
              onChange={(event) => setAssignment((current) => ({ ...current, generationInstructions: event.target.value }))}
            />
          </div>

          <div className="section-subheading">
            <h3>{copy.requirements}</h3>
            <label className="button secondary">
              {importingRequirements ? "..." : copy.importRequirements}
              <input accept="application/json,.json" hidden type="file" onChange={importRequirements} />
            </label>
          </div>
          {requirementsUpload ? <p className="muted">{requirementsUpload.originalName}</p> : null}
          <div className="settings-grid">
            <div className="field">
              <label htmlFor="coding-homework-max-file-count">{copy.maxFileCount}</label>
              <input
                id="coding-homework-max-file-count"
                min={1}
                type="number"
                value={requirementDraft.maxFileCount}
                onChange={(event) => setRequirementDraft((current) => ({ ...current, maxFileCount: readNumber(event.target.value, 1) }))}
              />
            </div>
            <div className="field">
              <label htmlFor="coding-homework-max-archive">{copy.maxArchiveMb}</label>
              <input
                id="coding-homework-max-archive"
                min={1}
                type="number"
                value={requirementDraft.maxArchiveMb}
                onChange={(event) => setRequirementDraft((current) => ({ ...current, maxArchiveMb: readNumber(event.target.value, 1) }))}
              />
            </div>
          </div>
          <TextAreaField
            id="coding-homework-required-files"
            label={copy.requiredFiles}
            value={requirementDraft.requiredFilesText}
            onChange={(requiredFilesText) => setRequirementDraft((current) => ({ ...current, requiredFilesText }))}
          />
          <TextAreaField
            id="coding-homework-required-folders"
            label={copy.requiredFolders}
            value={requirementDraft.requiredFoldersText}
            onChange={(requiredFoldersText) => setRequirementDraft((current) => ({ ...current, requiredFoldersText }))}
          />
          <TextAreaField
            id="coding-homework-required-functions"
            label={copy.requiredFunctions}
            value={requirementDraft.requiredFunctionsText}
            onChange={(requiredFunctionsText) => setRequirementDraft((current) => ({ ...current, requiredFunctionsText }))}
          />
          <TextAreaField
            id="coding-homework-ignored-paths"
            label={copy.ignoredPaths}
            value={requirementDraft.ignoredPathsText}
            onChange={(ignoredPathsText) => setRequirementDraft((current) => ({ ...current, ignoredPathsText }))}
          />
          <div className="field">
            <label htmlFor="coding-homework-allowed-extensions">{copy.allowedExtensions}</label>
            <input
              id="coding-homework-allowed-extensions"
              value={requirementDraft.allowedExtensionsText}
              onChange={(event) => setRequirementDraft((current) => ({ ...current, allowedExtensionsText: event.target.value }))}
            />
          </div>
        </section>
      </div>

      <section className="stack">
        <h3>{copy.preview}</h3>
        <div className="preview-panel">
          <MarkdownRenderer markdown={assignment.promptMarkdown || description} />
        </div>
      </section>

      {authoringClient?.getDocumentationPreview ? (
        <section className="stack">
          <div className="section-subheading">
            <div>
              <h3>{copy.documentation}</h3>
              {documentationPreview ? (
                <p className="muted">{formatMessage(copy.resourceCount, { count: documentationPreview.resourceCount })}</p>
              ) : null}
            </div>
            <div className="inline-actions">
              <button className="button secondary" disabled={loadingDocumentation} type="button" onClick={() => void loadDocumentationPreview({ notify: true })}>
                {loadingDocumentation ? "..." : copy.preview}
              </button>
              <button
                className="button secondary"
                disabled={creatingSnapshot || loadingDocumentation || !documentationPreview?.anchor}
                type="button"
                onClick={() => void createDocumentationSnapshot()}
              >
                {creatingSnapshot ? "..." : copy.documentationSnapshot}
              </button>
              {authoringClient.extractDocumentation ? (
                <button
                  className="button secondary"
                  disabled={extractingDocumentation || !documentationPreview?.latestSnapshot}
                  type="button"
                  onClick={() => void extractDocumentationSources()}
                >
                  {extractingDocumentation ? "..." : copy.extractDocumentation}
                </button>
              ) : null}
            </div>
          </div>
          {!documentationPreview?.anchor ? <p className="muted">{copy.documentationAnchorMissing}</p> : null}
          {documentationPreview?.resources.length ? (
            <ul className="documentation-resource-list">
              {documentationPreview.resources.map((resource) => (
                <li key={`${resource.itemId}-${resource.orderIndex}`}>
                  <span>{resource.title}</span>
                  <span className="muted">{resource.path.length ? resource.path.join(" / ") : resource.sourceKind}</span>
                </li>
              ))}
            </ul>
          ) : documentationPreview?.anchor ? (
            <p className="muted">{copy.noPriorResources}</p>
          ) : null}
          {documentationPreview?.latestSnapshot ? (
            <p className="muted">
              {copy.latestSnapshot}: {new Date(documentationPreview.latestSnapshot.createdAt).toLocaleString()}
              {extractionDocumentCount(documentationPreview.latestSnapshot.metadata) !== null
                ? ` · ${formatMessage(copy.documentCount, { count: extractionDocumentCount(documentationPreview.latestSnapshot.metadata) as number })}`
                : ""}
            </p>
          ) : null}
        </section>
      ) : null}

      {preflightClient ? (
        <section className="stack">
          <h3>{copy.preflight}</h3>
          <PreflightPanel copy={copy} preflightResult={preflightResult} runningPreflight={runningPreflight} onUpload={runPreflight} />
        </section>
      ) : null}
    </form>
  );
}

function PreflightPanel({
  copy,
  disabled = false,
  onUpload,
  preflightResult,
  runningPreflight
}: {
  copy: CodingHomeworkCopy;
  disabled?: boolean;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  preflightResult: CodingHomeworkPreflightResult | null;
  runningPreflight: boolean;
}) {
  return (
    <div className="stack">
      <div className="inline-actions">
        <label className={`button secondary${disabled ? " is-disabled" : ""}`}>
          {runningPreflight ? "..." : copy.preflightUpload}
          <input accept="application/zip,.zip" disabled={disabled || runningPreflight} hidden type="file" onChange={onUpload} />
        </label>
        {preflightResult ? (
          <span className={preflightResult.summary.isValid ? "status-pill is-enabled" : "status-pill is-disabled"}>
            {preflightResult.summary.isValid ? copy.preflightReady : copy.preflightInvalid}
          </span>
        ) : null}
      </div>
      {preflightResult ? (
        <div className="preflight-summary">
          <div>
            <strong>{preflightResult.summary.fileCount}</strong>
            <span className="muted"> {copy.preflightFiles}</span>
          </div>
          <div>
            <strong>{preflightResult.summary.validFunctions.length}</strong>
            <span className="muted"> {copy.preflightFunctions}</span>
          </div>
          <div>
            <strong>{preflightResult.summary.issues.length}</strong>
            <span className="muted"> {copy.preflightIssues}</span>
          </div>
        </div>
      ) : null}
      {preflightResult?.summary.issues.length ? (
        <ul className="preflight-issue-list">
          {preflightResult.summary.issues.map((issue, index) => (
            <li key={`${issue.code}-${issue.path ?? ""}-${issue.functionName ?? ""}-${index}`}>
              <span>{issue.message}</span>
              {issue.path ? <span className="muted">{issue.path}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SubmissionPanel({
  copy,
  disabled = false,
  latestSubmission,
  onUpload,
  submissionResult,
  submitting
}: {
  copy: CodingHomeworkCopy;
  disabled?: boolean;
  latestSubmission: CodingHomeworkLatestSubmissionResult;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  submissionResult: CodingHomeworkSubmissionResult | null;
  submitting: boolean;
}) {
  const currentSubmissionStatus = submissionResult?.submission.status ?? latestSubmission?.submission.status ?? null;
  const status = submissionResult && !submissionResult.summary.isValid
      ? copy.submissionInvalid
      : currentSubmissionStatus === "ready_for_grading"
        ? copy.submissionComplete
        : currentSubmissionStatus === "challenge_ready"
          ? copy.challengesReady
          : currentSubmissionStatus === "structure_valid" || currentSubmissionStatus === "validating" || currentSubmissionStatus === "processing"
            ? copy.submissionProcessing
            : currentSubmissionStatus === "invalid_structure"
              ? copy.submissionInvalid
              : currentSubmissionStatus === "failed"
                ? copy.submissionFailed
              : null;
  const isValid = submissionResult
    ? submissionResult.summary.isValid
    : currentSubmissionStatus === "structure_valid" || currentSubmissionStatus === "validating" || currentSubmissionStatus === "processing" || currentSubmissionStatus === "challenge_ready" || currentSubmissionStatus === "ready_for_grading";
  const fileCount = submissionResult?.files.length ?? latestSubmission?.files.length ?? 0;
  const uploadLocked =
    disabled ||
    currentSubmissionStatus === "validating" ||
    currentSubmissionStatus === "structure_valid" ||
    currentSubmissionStatus === "processing" ||
    currentSubmissionStatus === "challenge_ready" ||
    currentSubmissionStatus === "ready_for_grading";

  return (
    <div className="stack">
      <h3>{copy.submission}</h3>
      <div className="inline-actions">
        <label className={`button primary${uploadLocked ? " is-disabled" : ""}`}>
          {submitting ? "..." : copy.submissionUpload}
          <input accept="application/zip,.zip" disabled={uploadLocked || submitting} hidden type="file" onChange={onUpload} />
        </label>
        {status ? <span className={isValid ? "status-pill is-enabled" : "status-pill is-disabled"}>{status}</span> : null}
      </div>
      {uploadLocked && !isSubmissionProcessing(currentSubmissionStatus) ? <p className="muted">{copy.submissionLocked}</p> : null}
      {isSubmissionProcessing(currentSubmissionStatus) ? <p className="muted">{copy.submissionProcessingDetail}</p> : null}
      {currentSubmissionStatus === "failed" && latestSubmission?.submission.processingError ? <p className="muted">{latestSubmission.submission.processingError}</p> : null}
      {latestSubmission ? (
        <p className="muted">
          {copy.latestSubmission}: {new Date(latestSubmission.submission.createdAt).toLocaleString()}
        </p>
      ) : null}
      {fileCount ? (
        <div className="preflight-summary">
          <div>
            <strong>{fileCount}</strong>
            <span className="muted"> {copy.submissionFiles}</span>
          </div>
          <div>
            <strong>{submissionResult?.summary.validFunctions.length ?? 0}</strong>
            <span className="muted"> {copy.preflightFunctions}</span>
          </div>
          <div>
            <strong>{submissionResult?.summary.issues.length ?? 0}</strong>
            <span className="muted"> {copy.preflightIssues}</span>
          </div>
        </div>
      ) : null}
      {submissionResult?.summary.issues.length ? (
        <ul className="preflight-issue-list">
          {submissionResult.summary.issues.map((issue, index) => (
            <li key={`${issue.code}-${issue.path ?? ""}-${issue.functionName ?? ""}-${index}`}>
              <span>{issue.message}</span>
              {issue.path ? <span className="muted">{issue.path}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function isSubmissionProcessing(status: string | null) {
  return status === "validating" || status === "structure_valid" || status === "processing";
}

function ProcessingWaitPanel({ copy, startedAt }: { copy: CodingHomeworkCopy; startedAt: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);
  const elapsedSeconds = startedAt ? Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000)) : 0;

  return (
    <section className="stack">
      <style>{`@keyframes coding-homework-spin { to { transform: rotate(360deg); } }`}</style>
      <div className="section-subheading">
        <div>
          <h3>{copy.challengeQuestions}</h3>
          <p className="muted">{copy.submissionProcessingDetail}</p>
          <p className="muted">
            {formatMessage(copy.submissionProcessingElapsed, { seconds: elapsedSeconds })} · {copy.submissionProcessingPoll}
          </p>
        </div>
        <span className="status-pill is-enabled" style={{ alignItems: "center", display: "inline-flex", gap: "0.45rem" }}>
          <span aria-hidden="true" style={spinnerStyle} />
          {copy.submissionProcessing}
        </span>
      </div>
    </section>
  );
}

const spinnerStyle = {
  animation: "coding-homework-spin 0.9s linear infinite",
  border: "2px solid rgba(13, 27, 71, 0.2)",
  borderTopColor: "#0d1b47",
  borderRadius: "999px",
  display: "inline-block",
  height: "0.85rem",
  width: "0.85rem"
} as const;

function ChallengeQuestionsPanel({
  answers,
  copy,
  onAnswerChange,
  onSave,
  onSubmit,
  questions,
  saving,
  status,
  submitting
}: {
  answers: Record<string, string>;
  copy: CodingHomeworkCopy;
  onAnswerChange: (questionId: string, answer: string) => void;
  onSave: () => void;
  onSubmit: () => void;
  questions: CodingHomeworkStudentChallengeQuestionRecord[];
  saving: boolean;
  status: string | null;
  submitting: boolean;
}) {
  if (!questions.length) {
    return null;
  }

  const complete = status === "ready_for_grading" || status === "graded";
  const allAnswered = questions.every((question) => (answers[question.id] ?? "").trim());

  return (
    <section className="stack">
      <div className="section-subheading">
        <div>
          <h3>{copy.challengeQuestions}</h3>
          <p className="muted">{complete ? copy.answersComplete : copy.challengeQuestionsReady}</p>
        </div>
        <span className={complete ? "status-pill is-enabled" : "status-pill"}>{complete ? copy.submissionComplete : copy.challengesReady}</span>
      </div>
      <div className="stack">
        {questions.map((question) => (
          <div className="challenge-question" key={question.id}>
            <p>
              <strong>{question.orderIndex + 1}.</strong> {question.questionText}
            </p>
            <textarea
              aria-label={`${copy.answer} ${question.orderIndex + 1}`}
              disabled={complete}
              rows={5}
              value={answers[question.id] ?? ""}
              onChange={(event) => onAnswerChange(question.id, event.target.value)}
            />
          </div>
        ))}
      </div>
      {complete ? null : (
        <div className="inline-actions">
          <button className="button secondary" disabled={saving || submitting} type="button" onClick={onSave}>
            {saving ? "..." : copy.saveDraft}
          </button>
          <button className="button primary" disabled={!allAnswered || saving || submitting} type="button" onClick={onSubmit}>
            {submitting ? "..." : copy.submitAnswers}
          </button>
        </div>
      )}
    </section>
  );
}

function NumberField({
  id,
  label,
  max,
  min,
  onChange,
  value
}: {
  id: string;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} max={max} min={min} type="number" value={value} onChange={(event) => onChange(readNumber(event.target.value, min))} />
    </div>
  );
}

function TextAreaField({
  id,
  label,
  onChange,
  value
}: {
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} rows={3} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

async function fileToUploadInput(file: File) {
  return {
    base64: bufferToBase64(await file.arrayBuffer()),
    fileName: file.name,
    mimeType: file.type || undefined
  };
}

function bufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function uploadIdempotencyKey(activityId: string, file: File) {
  return `submission:${activityId}:${file.name}:${file.size}:${file.lastModified}`.replace(/[^a-zA-Z0-9._:-]/g, "_").slice(0, 120);
}

function requirementsToDraft(requirements: CodingHomeworkAuthoringSubmissionRequirements): RequirementDraft {
  return {
    allowedExtensionsText: requirements.allowedExtensions.join(", "),
    ignoredPathsText: requirements.ignoredPaths.join("\n"),
    maxArchiveMb: Math.max(1, Math.round(requirements.maxArchiveBytes / (1024 * 1024))),
    maxFileCount: requirements.maxFileCount,
    requiredFilesText: requirements.requiredFiles.map((item) => item.path).join("\n"),
    requiredFoldersText: requirements.requiredFolders.map((item) => item.path).join("\n"),
    requiredFunctionsText: requirements.requiredFunctions.map((item) => (item.filePath ? `${item.filePath}:${item.name}` : item.name)).join("\n")
  };
}

function draftToRequirements(draft: RequirementDraft, languageKey: string): CodingHomeworkAuthoringSubmissionRequirements {
  return {
    allowedExtensions: splitCommaList(draft.allowedExtensionsText),
    ignoredPaths: splitLineList(draft.ignoredPathsText),
    languageKey,
    maxArchiveBytes: Math.max(1, draft.maxArchiveMb) * 1024 * 1024,
    maxFileCount: Math.max(1, draft.maxFileCount),
    requiredFiles: splitLineList(draft.requiredFilesText).map((path) => ({ path })),
    requiredFolders: splitLineList(draft.requiredFoldersText).map((path) => ({ path })),
    requiredFunctions: splitLineList(draft.requiredFunctionsText).map((line) => {
      const separatorIndex = line.lastIndexOf(":");
      return separatorIndex > 0
        ? {
            filePath: line.slice(0, separatorIndex).trim(),
            name: line.slice(separatorIndex + 1).trim(),
            required: true
          }
        : {
            name: line,
            required: true
          };
    })
  };
}

function splitLineList(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitCommaList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function serializeSnapshot(input: {
  assignment: CodingHomeworkAssignmentRecord;
  description: string;
  requirementDraft: RequirementDraft;
  title: string;
}) {
  return JSON.stringify({
    assignment: input.assignment,
    description: input.description,
    requirementDraft: input.requirementDraft,
    title: input.title
  });
}

function readNumber(value: unknown, fallback: number) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function readString(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function formatMessage(template: string, params: Record<string, string | number>) {
  return Object.entries(params).reduce((current, [key, value]) => current.replaceAll(`{${key}}`, String(value)), template);
}

function extractionDocumentCount(metadata: Record<string, unknown>) {
  const extraction = metadata.extraction;
  if (!extraction || typeof extraction !== "object" || Array.isArray(extraction)) {
    return null;
  }
  const count = (extraction as { documentCount?: unknown }).documentCount;
  return typeof count === "number" ? count : null;
}
