# AI Feedback, Grading, And Grade Challenges Implementation Plan

This document records the implemented direction for plugin-provided AI feedback ("retroaction"), AI-assisted grading, and student challenges, plus the remaining production-hardening work.

Status: initial end-to-end implementation completed on 2026-09-19 for Programming Exercises, MCQ, the shared gradebook, and Compound Tests. Plugin-owned standalone feedback authoring/review/editing is also complete for every submitted attempt and does not require an AI result. Phase 6 privacy/operations hardening remains incomplete as listed below.

## Terminology

- **AI feedback** is the student-facing retroaction produced from a submitted activity.
- **AI grading** means that some or all of the activity grade is calculated from that feedback evaluation.
- **Feedback challenge** or **grade challenge** is a student's formal contestation of released AI feedback that influenced a grade.
- Coding Homework Grader's existing generated **challenge questions** are a separate pedagogical workflow and must not be renamed or reused as grade challenges.

Teacher/admin product copy may use **AI feedback** and **Grade challenge** (French: **Rétroaction par IA** and **Contestation de la rétroaction/note**). Learner-facing copy must use mechanism-neutral terms such as **Assessment feedback**, **Feedback**, and **Grade challenge**; it must not say that feedback or grading was produced by AI.

## Goals

- Let an activity plugin opt into AI feedback and, separately, AI grading.
- Use an AI model selected and enabled for the course; students never supply the grading model or credentials.
- Require complete plugin-specific feedback configuration whenever AI feedback is enabled on an activity.
- Generate formative feedback immediately after the learner submits the formative activity.
- Require an explicit teacher action to start summative AI feedback/grading.
- Keep summative AI feedback hidden from the student until the gradebook item is released.
- Let plugins decide whether AI feedback affects grading and how it combines with deterministic grading.
- Preserve deterministic grading where it is authoritative, especially MCQ answer-key grading.
- Let a student challenge any released AI feedback that contributed to an automatic grade.
- Give teachers one course-wide challenge queue with a response and audited grade-adjustment workflow.
- Let teachers author learner feedback directly, whether or not AI feedback is enabled or generated.
- Retain reproducible, privacy-aware data for educational research, model evaluation, audit, and later student-model evidence work.

## Effective Enablement

AI feedback is effective only when every required layer is satisfied:

```text
course AI feedback switch is enabled
+ course feedback/grading model is selected and available
+ activity plugin declares AI feedback support
+ course activity enables AI feedback
+ the plugin validates the complete activity feedback configuration
= effective AI feedback
```

The activity-level configuration applies to the course activity and therefore to every section/group where that activity is assigned. Per-section feedback rubrics or weights are not part of the initial scope.

Bank activities may contain reusable plugin-owned feedback configuration. The plugin must copy that configuration into independent course-owned rows when the activity is added to a course, using the existing lifecycle hooks. Later bank changes must not modify the course copy.

Enabling AI feedback without a complete rubric, instructions, output contract, or grading policy must fail validation. A disabled activity may retain a draft configuration, but it must not generate feedback or influence grades.

## Course AI Settings

Course settings include a dedicated assessment-feedback policy under **AI settings**:

- `automaticFeedbackEnabled`
- `assessmentFeedbackAiAgentConnectionId`

The setting reuses existing personal/global `AiAgentConnection` records and server-side credential handling. It should remain separate from `studentSupportAiAgentConnectionId`: a support assistant and a grading model have different cost, accountability, reproducibility, and change-control requirements. A teacher may deliberately select the same connection for both purposes.

The current course UI:

- require an accessible enabled model before the master switch can be enabled;
- explains that formative feedback runs on submission while summative evaluation waits for a teacher.

An activity-count summary and proactive per-activity ineffective-configuration warnings remain UI follow-up work; server-side evaluation still fails closed when any effective-enablement layer is missing.

The model is always resolved server-side. Provider keys, raw credentials, private prompts, hidden rubrics, reference answers, and unrestricted model output must never be sent to students.

## Trigger And Execution Policy

### Formative Activities

- The learner's explicit formative submission starts AI feedback immediately.
- The plugin submission route directly invokes the feedback evaluation workflow; it is not waiting for a teacher action or a scheduled scan.
- The student UI may show a generating state while the model call runs and presents the feedback as soon as it completes.
- Formative feedback remains plugin-owned analytics/research data and does not create a core gradebook grade.
- Retrying a failed formative evaluation must be explicit and idempotent.

### Summative Activities

- Student submission stores the immutable submission and leaves it awaiting AI evaluation when the activity needs AI feedback or AI grading.
- Submission must not automatically enqueue or run summative AI grading.
- A teacher starts AI evaluation from the gradebook/review surface, for one attempt, selected attempts, or a bounded batch.
- The initial implementation must not use the shared `BackgroundJob` worker to start or execute summative AI grading. The teacher action invokes the grading route directly and the UI remains responsible for showing progress and individual failures.
- Do not add a scheduled scanner, submission-triggered job, or silent automatic retry for summative grading.
- If later scale requires asynchronous execution, that is a new design decision requiring explicit approval. It must preserve teacher initiation and must not turn summative grading into submission-triggered automation.
- A teacher may retry a failed evaluation. Each retry creates a new immutable evaluation version and supersedes the previous result; it never overwrites research or audit history.
- The teacher can review generated feedback and the score breakdown before grade release.
- The detailed gradebook offers **Feedback** for every submitted attempt and a whole-class review flow across all submitted learners. The activity plugin renders the submitted answer, any plugin-relevant submission evidence such as Programming Exercise test outcomes, and editable feedback fields. Generated feedback pre-populates the form; otherwise the plugin supplies an empty teacher-authoring draft.
- Teacher revisions may update learner-visible narrative feedback before or after release. A plugin may also expose editable rubric percentages and return a validated grading result; Programming Exercises then recompute the AI and combined scores with the immutable deterministic result and configured weights, and core records the change through its audited regrade path. Core preserves the immutable original evaluation artifact, records previous/next feedback and research telemetry, and blocks further edits after that feedback version is challenged.
- Student-safe summative AI feedback is exposed only after the associated `GradebookItem` is released.

Teacher-triggered batch grading processes attempts sequentially and independently, so one provider or parsing failure does not erase successful results for other attempts. The completion notice reports the failure count and most common actionable reason rather than expanding every learner name. A durable maximum batch size plus cancellation and timeout UX remain Phase 6 hardening.

## Responsibility Boundary

### Core Platform Responsibilities

- course enablement and model selection;
- secure course model resolution;
- common activity capability and server result contracts;
- attempt, grade, release, override, and `GradeEvent` lifecycle;
- normalized, append-only cross-plugin research events;
- course-wide grade-challenge persistence, authorization, APIs, and queue;
- common student challenge status and teacher resolution controls;
- generic visibility rules preventing unreleased summative feedback disclosure;
- cross-plugin research export boundaries and consent filtering.

### Activity Plugin Responsibilities

- declaring AI feedback and AI-grading capabilities;
- activity-level enablement and required configuration validation;
- plugin-owned bank/course configuration and lifecycle copying;
- immutable per-attempt snapshots of the effective rubric and grading configuration;
- selecting the submission artifacts and context sent to the model;
- prompt construction, prompt versioning, model-output schema validation, and bounded retries;
- generation of a sanitized student-facing feedback result;
- deciding whether AI feedback affects the grade;
- composing deterministic and AI-derived grading components;
- detailed immutable evaluation artifacts, including private raw model output;
- plugin-specific student feedback and teacher review renderers;
- plugin-specific teacher submission loading and server-side validation of editable feedback fields;
- plugin-specific granular learning/research signals where available.

## Implemented Plugin Contracts

The SDK now exposes capabilities distinct from existing deterministic automatic grading:

- `supportsAiFeedback`
- `supportsAiFeedbackGrading`
- `aiFeedback.rendererKey` for the teacher feedback review renderer
- `aiFeedback.teacherReview.getSubmission` for the plugin-specific submitted answer
- `aiFeedback.teacherReview.createFeedbackDraft` for a valid empty plugin-owned teacher feedback shape
- `aiFeedback.teacherReview.reviseFeedback` for whitelisting and validating editable feedback fields and optionally returning a plugin grading result when rubric scores are teacher-editable

Server plugins need an evaluation handler that receives an immutable attempt/submission context plus the resolved course model and returns a validated result resembling:

```ts
type PluginAiFeedbackResult = {
  feedbackVersion: string;
  studentFeedback: {
    summary?: string;
    criteria?: Array<{
      key: string;
      title: string;
      feedback: string;
      awarded?: number;
      possible?: number;
    }>;
  };
  gradingContribution?: {
    rawScore: number;
    rawMaxScore: number;
    weightPercent: number;
  };
  analyticsPayload?: Record<string, unknown>;
  researchPayload?: Record<string, unknown>;
};
```

The browser must receive only the sanitized result. Raw provider responses, grading prompts, hidden rubrics, reference solutions, hidden tests, and teacher-only rationale remain plugin-private.

## Grading Semantics

### Programming Exercise Example

A programming exercise may configure:

```text
deterministic hidden tests: 60%
AI rubric evaluation:       40%
```

The plugin must validate that component weights total 100%. It stores the deterministic test result, criterion-level AI result, combined raw score, and full configuration/model snapshots. If the AI portion fails, Cognelo must not silently grade the learner on only the deterministic 60%; the attempt remains submitted and needs grading until the teacher retries or records a manual grade.

### MCQ Example

MCQ answer-key grading remains deterministic and authoritative. AI feedback may explain errors or suggest study areas, but it does not change the MCQ score. Because the AI result did not influence the grade, the mandatory AI-grade challenge workflow does not apply. Summative MCQ feedback is still teacher-triggered and release-gated; formative MCQ feedback is generated on submission.

### Regrading

- Formative/Test-child retries retain the attempt's immutable rubric/configuration snapshot. A teacher-started Programming Exercise evaluation uses the current rubric/reference solution/prompt and latest saved test result, without running tests, and snapshots those inputs in a new model-evaluation version.
- Programming Exercise **Regrade all** is a separate test-only action: rerun current enabled tests, append a test-evaluation record, and recompute the grade using current component weights and the latest existing rubric score. A missing rubric score defers final grading; no model call occurs. **Generate AI feedback for all** recomputes the rubric component without running tests. If both tests and rubric changed, teachers run these actions in that order.
- A completed explicit regrade creates a new result version and a `regraded` core grade event.
- Previous model outputs, parsed results, feedback, scores, and grade snapshots remain available for audit and research.
- Releasing, hiding, regrading, and challenging a grade are separate events; one must not overwrite another's history.

## Feedback Visibility

- Formative feedback is visible immediately after successful generation.
- Summative feedback can be visible to authorized teachers before release.
- Summative student endpoints must omit the feedback until the gradebook item is released.
- Existing provisional-score behavior for repeatable summative activities does not automatically expose the AI narrative or private rubric.
- A release action should surface pending/failed required feedback. The initial implementation must define whether release is blocked or requires an explicit teacher override; it must never silently claim that configured feedback is complete.
- Student-facing result envelopes must remain sanitized and must not include provider prompts, raw responses, model credentials, hidden tests, or other learners' material.

## Grade Challenges

Core should own a generic `GradeChallenge` model because the teacher needs one queue across every participating plugin.

Provisional fields:

- course, group/section, activity, gradebook item, participant, and attempt IDs;
- grade ID and grade-event ID where applicable;
- plugin key and immutable plugin feedback reference/version/hash;
- released-grade snapshot at challenge creation;
- mandatory student explanation;
- status: `open`, `upheld`, or `adjusted`;
- mandatory teacher response when resolved;
- resolver user and resolution timestamp;
- resulting grade/event snapshot when adjusted;
- timestamps and bounded metadata.

Rules:

- Only released AI feedback that contributed to grading can be challenged.
- A student can create one challenge for each immutable feedback version.
- The explanation is required and becomes read-only after submission.
- A challenge does not reopen the activity attempt or permit another submission.
- Authorized course owners, teachers, and TAs can review challenges within their grading scope.
- Resolving a challenge requires a teacher response.
- The teacher may uphold the result or change the final normalized grade through the existing override service.
- A grade adjustment writes the normal audited override event with the challenge ID in metadata.
- The student sees the challenge, status, teacher response, and resulting grade while reviewing the relevant answer/attempt.
- Re-evaluating challenged work creates a new immutable feedback version rather than modifying the contested artifact.

The course workspace has a manager-only **Challenges** tab listing open and resolved records with student, activity, section, explanation, status, response, and adjustment controls. Dedicated status/activity/section/student filter controls and a challenge-to-gradebook deep link into the plugin review surface remain UI follow-up work.

## Compound Test Behavior

Core Tests are always summative, so their AI feedback never runs automatically on Test submission.

- Test submission stores deterministic child results and any child states needed for AI evaluation.
- A teacher starts AI evaluation for the parent Test/selected attempts from the gradebook.
- Each participating child plugin evaluates its own item and returns its component result.
- Required AI-graded children must finish before the parent Test grade is recomputed.
- Child feedback remains hidden until the parent Test gradebook item is released.
- A grade challenge belongs to the released parent grade while identifying the child feedback version being contested.
- Test revisions must snapshot child AI feedback configuration and private grading data before attempts begin.

## Research And Audit Data

Research capture is a requirement of the first implementation, not a later optional analytics phase.

Use two complementary layers:

1. Each plugin stores detailed immutable evaluation artifacts needed to reproduce and analyze its feedback and grading behavior.
2. Core stores a normalized append-only AI-feedback research event envelope so cross-plugin and cross-activity studies do not require interpreting every plugin table.

### Required Plugin-Owned Evaluation Data

For every formative or summative evaluation, retain where applicable:

- stable evaluation ID and version;
- course, group/section, activity, participant, user, attempt, and plugin-submission references;
- formative or summative assessment mode;
- trigger kind: `formative_submission`, `teacher_single`, `teacher_selection`, or `teacher_batch`;
- triggering teacher for summative work;
- activity, plugin, rubric, grading-policy, prompt-template, and feedback-schema versions;
- hashes plus immutable snapshots of the effective rubric and grading configuration;
- AI provider, model, connection reference, and model parameters safe for audit;
- request start/end timestamps, latency, retry count, and terminal status;
- provider request/response identifiers and token/usage data when available;
- raw provider response in access-controlled plugin storage;
- validated parsed response and validation/retry diagnostics;
- sanitized student-facing feedback;
- criterion-level scores and feedback;
- deterministic grading components used by the plugin;
- AI grading contribution and configured weight;
- combined raw score returned to core;
- core grade/grade-event reference where one exists;
- whether and when feedback became visible to the student;
- teacher review, retry, regrade, manual adjustment, and release references;
- failure category without exposing secrets in ordinary logs.

### Required Core Research Events

Core should record normalized append-only events for at least:

- feedback requested;
- feedback generation succeeded or failed;
- summative AI grading started by a teacher;
- AI grading recorded;
- feedback released/hidden;
- feedback viewed by the student, when product instrumentation supports it;
- challenge opened;
- challenge upheld;
- challenge adjusted;
- AI regrade performed;
- manual replacement/override performed.
- teacher feedback revision performed.

The normalized event should include stable references, timestamps, assessment mode, trigger kind, model identity, immutable rubric hashes, prompt/schema versions, grading contribution, outcome status, and bounded plugin-provided research metadata. It must not copy complete submissions, hidden tests, provider credentials, unrestricted raw prompts, or raw model responses into core.

### Research Integrity

- Records are append-only. Retries, regrades, manual overrides, and challenge resolutions supersede prior interpretations but do not delete the original observations.
- Research timestamps must distinguish submission, teacher trigger, model request, model response, grade recording, release, student view, challenge, and resolution.
- Deterministic and AI-derived score components must remain separately queryable.
- Formative evaluations must be researchable even though they create no core grade.
- Summative records must preserve who initiated the AI evaluation.
- Failed, cancelled, invalid, and retried evaluations are part of the dataset and must not be discarded as noise.
- The attempt's immutable skill mapping may later receive validated learning-evidence signals, but research events and student-model evidence remain separate contracts.
- Gradebook late penalties and grade-selection strategy must not be confused with the raw demonstrated outcome or AI rubric score.

### Privacy, Consent, And Export

- Provider credentials and secrets are never research data.
- Raw submissions, raw model prompts/responses, and hidden grading artifacts remain permission-restricted and are excluded from ordinary exports by default.
- Research exports should support identifiable and pseudonymized/anonymized forms, external student IDs, and course/participant consent filtering when the planned consent model is implemented.
- Withdrawing research consent affects research export eligibility, not operational grading/audit retention.
- Access to identifiable evaluation and challenge data follows course grading authorization.
- Retention, deletion, and anonymization rules must be documented before production research export is enabled.
- Logs must not become an uncontrolled duplicate of research records or sensitive model content.

## Failure And Safety Rules

- Model output must be validated against a strict plugin schema before it can affect a grade.
- Invalid output receives only bounded, recorded correction retries.
- No grade may be calculated from malformed, partial, or unvalidated AI output.
- Summative evaluation failures remain teacher-visible and retryable; students see no hidden partial feedback.
- Formative failures show a safe retry/error state without exposing provider details.
- Repeated teacher requests must be idempotent and must not duplicate a grade or research event for the same evaluation version.
- Student-controlled text must be treated as untrusted model input. Plugins must delimit it and must not give the grading model tools or unrestricted data access.
- The model may use only the context explicitly authorized by the plugin and course configuration.

## Delivery Status

### Phase 0 — Confirm The Contract

Status: complete. Grade release is not blocked automatically when feedback is pending or failed; the teacher controls evaluation and release as separate explicit actions. The web batch is bounded by the attempts currently loaded for the activity and processes them sequentially.

- Confirm course settings, trigger semantics, visibility, direct teacher execution, challenge rules, and research fields.
- Confirm whether grade release is blocked by required feedback failures.
- Confirm bounded batch size and timeout behavior for direct teacher-triggered grading.

### Phase 1 — Shared Platform Foundation

Status: complete. Course settings, SDK contracts, secure model resolution, normalized research events, gradebook feedback persistence, release gating, and common challenge DTO/services/routes are implemented.

- Extend course AI settings and contracts.
- Add activity/plugin AI-feedback capabilities and server result contracts.
- Add normalized AI-feedback research events and ingestion validation.
- Add shared authorization and visibility helpers.
- Add common feedback result/challenge DTOs.

### Phase 2 — Programming Exercise Pilot

Status: complete. Programming Exercises support a private unnamed general grading rubric that remains available to teachers without automatic feedback, immediate formative evaluation when automation is enabled, teacher-triggered summative evaluation, configurable deterministic/rubric weighting, strict two-attempt structured-output validation, immutable private evaluation artifacts, submission-time private rubric snapshots, and teacher review of submitted code, latest successful hidden-test outcomes, and editable summary/strength/improvement/criterion scores and narrative. Course and bank editors expose a dedicated host Grading tab after Concepts with nested Rubric and Test cases side tabs. Rubrics may be generated only from a title, student prompt, and reference solution; both rubric and assessment-feedback generation resolve the Subject teaching language server-side.
Teacher correction workflows additionally append test-only reruns against current hidden tests and regenerate summative feedback against the current rubric and latest saved tests. Neither action invokes the other; the original submission snapshot and earlier evaluation artifacts remain immutable.

The development seed includes a reproducible two-section Programming Exercise batch at the submitted-but-not-evaluated boundary. This permits teacher single/batch generation, review, editing, release, learner review, challenge, and research-event testing without requiring Judge0 to execute dozens of fixture submissions during seeding. A clean course receives the fallback seed model, while reseeding preserves a teacher-selected assessment-feedback model and explicit feedback switch.

- Add plugin-owned bank/course feedback configuration, rubrics, and copy/sync hooks.
- Add formative submission-triggered feedback.
- Add teacher-triggered standalone summative evaluation.
- Add configurable deterministic-test/AI-rubric weighting.
- Snapshot all grading inputs and record detailed research artifacts.
- Add student and teacher feedback renderers.

### Phase 3 — Grade Challenges

Status: complete for the agreed core workflow. Students can challenge each released AI-graded feedback version with a required explanation; course managers have a Challenges tab and can uphold or adjust the grade with a required response. Adjustment uses the existing audited override service.

- Add the core challenge schema and migration.
- Add student create/read APIs and activity review panel.
- Add the course Challenges tab, filters, detail view, and manager APIs.
- Integrate teacher response, grade override, audit, and research events.

### Phase 4 — MCQ Feedback

Status: complete. MCQ supports required explanation instructions, immediate formative explanations, teacher-triggered/release-gated summative explanations, immutable evaluation artifacts, normalized research events, and teacher review of selected answers plus editable overall/per-question explanations. Its deterministic answer-key score remains authoritative and its AI feedback is not challengeable.

- Add activity-level AI feedback configuration.
- Keep deterministic MCQ grading unchanged.
- Add formative submission-triggered explanations.
- Add teacher-triggered summative explanations hidden until release.
- Record evaluation/research data without marking MCQ as AI-graded.

### Phase 5 — Compound Test Integration

Status: complete for Programming Exercise and MCQ children. A teacher-triggered parent evaluation dispatches supported children, records child feedback/scores, and recomputes the parent. Child feedback is visible only through the released parent grade, and every AI-graded child feedback version is independently challengeable.

- Snapshot child feedback configuration in Test revisions.
- Add teacher-triggered evaluation of supported children.
- Recompute parent grades only after required child AI grading completes.
- Add release-safe child feedback and challenge targeting.

### Phase 6 — Hardening And Research Export

Status: partial. The manager research endpoint is implemented with stable identifier pseudonymization on by default, and unit/regression coverage exists. The following items remain before production research use:

- make repeated/concurrent teacher evaluation requests idempotent at the database boundary;
- add course research-consent filtering and approved retention/deletion/anonymization policies;
- define and enforce raw provider-response retention;
- add operational dashboards for failures, latency, model usage, and pending teacher grading;
- add challenge-list filters and Compound Test child feedback review/edit rendering;
- add live-provider cross-plugin browser coverage and cancellation/timeout UX for larger batches;
- update the student-model evidence plan if AI rubric dimensions become learning-evidence signals.

## Verification Requirements

- Activity save rejects enabled but incomplete feedback configuration.
- Course enablement rejects an unavailable or inaccessible model.
- Formative submission starts feedback without teacher intervention.
- Summative submission never starts AI evaluation automatically.
- Only an authorized teacher action starts summative evaluation.
- Summative grading does not use the background-job worker.
- AI feedback stays hidden from students before release.
- Deterministic MCQ grading is unchanged by feedback generation or failure.
- Weighted programming grades preserve deterministic and AI components separately.
- Invalid/failed AI output cannot create a partial or silent grade.
- Retry and regrade preserve earlier evaluation versions and research events.
- Programming Exercise test-only regrading never invokes AI or creates another student attempt; later AI generation never reruns tests and uses the latest successful saved test result plus current rubric.
- Students can challenge only their own released AI-graded feedback.
- Teacher resolution requires a response and records any grade change through the audited override path.
- Course challenge listing and resolution authorization are enforced server-side.
- Research records cover successful, failed, retried, released, viewed, challenged, and adjusted evaluations.
- Teacher feedback revisions preserve the original evaluation and record previous/next snapshots plus normalized research telemetry; rubric-score revisions preserve deterministic components/configured weights and use the audited regrade path.
- Every standalone feedback-capable plugin provides a teacher answer/feedback review renderer and a server-side revision validator.
- Individual and whole-group feedback review include every submitted attempt, even when no AI result exists, and the first teacher save records `feedback_teacher_authored`.
- Programming Exercise feedback drafts include the configured rubric and editable criterion scores before any automatic evaluation; manual rubric score changes use the same audited grade recomposition path.
- Learner-facing feedback and challenge copy does not identify AI as the generating or grading mechanism.
- Raw prompts, responses, hidden tests, credentials, and other students' data never appear in student DTOs or ordinary research exports.
- Compound Tests expose child feedback only through the released parent result.

## Deferred Product And Policy Decisions

- Whether summative release should later be blocked while required AI feedback is pending/failed. The current implementation permits explicit release.
- A durable maximum batch size beyond the attempts loaded by the current detailed-gradebook view.
- Request timeout/cancellation behavior for larger direct bulk grading without a background worker.
- Whether Compound Test parent review should edit child feedback inline or open each child's plugin review renderer in a nested surface.
- Whether a teacher changes only the final normalized grade during challenge resolution or can also replace individual plugin rubric-component scores.
- Whether a regrade after release is immediately visible or requires a hide/re-release cycle.
- Retention and anonymization periods for raw provider responses and submitted artifacts.
