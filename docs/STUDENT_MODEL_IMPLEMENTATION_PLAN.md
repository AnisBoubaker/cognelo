# Student Model Implementation Plan

This document records the planned implementation of Cognelo's student model.
It is intentionally a planning artifact. Implementation should proceed incrementally and update this file whenever the persistence model, evidence contract, inference algorithm, privacy boundary, product behavior, or rollout order changes.

## Objective

Implement an explainable core platform service that converts learner interactions into a continuously updated estimate of each learner's skill state.

The durable processing model is:

```text
Activity interaction
        |
        v
Normalized learning evidence
        |
        v
Participant x skill state
        |
        +-- mastery estimate
        +-- confidence
        +-- evidence history
        +-- misconception/difficulty signals
        +-- last practiced
        |
        v
Teacher/student views, recommendations, and bounded AI tutor context
```

The core architectural rule is to keep three layers separate:

1. **Evidence** records what happened and remains auditable.
2. **Inference** records what a named, versioned model currently estimates.
3. **Intervention** decides what Cognelo recommends, displays, or sends to an AI tutor.

Cognelo must not store mastery only as an opaque mutable number. Every projection must be reproducible from retained evidence, and every displayed estimate must be explainable in terms of the model version and supporting evidence.

## Goals

- Give subject skills stable identities suitable for longitudinal evidence.
- Preserve immutable activity-to-skill mappings at the activity-version/attempt boundary.
- Normalize summative, formative, compound-Test, and teacher-provided observations into a core-neutral evidence model.
- Maintain a cheap, transparent, rebuildable first-generation mastery projection.
- Distinguish low estimated mastery from insufficient evidence.
- Support participants who do not yet have platform user accounts.
- Provide teacher and student views without exposing plugin-private grading artifacts.
- Provide a compact, uncertainty-aware context for future AI tutoring.
- Preserve a path to later Bayesian Knowledge Tracing, IRT, or learned models without rewriting evidence ingestion.

## Non-Goals For The First Release

- Fully adaptive course sequencing.
- Automatic remediation assignment.
- Cross-course learner profiles.
- Institution-wide or email-based identity merging.
- Using an LLM to calculate mastery.
- Inferring direct evidence for prerequisites that were not observed.
- Training or deploying BKT, IRT, deep knowledge tracing, or other learned models.
- Treating grades, lateness, or gradebook selection policy as equivalent to learning evidence.
- Migrating every existing plugin event into rich skill evidence in the first vertical slice.

## Existing Foundation

Cognelo already provides most upstream structures:

- `SubjectKnowledgeConcept` and `SubjectKnowledgePrerequisite` define a subject-scoped knowledge graph.
- `SubjectKnowledgeConcept.skills` contains observable skills as normalized newline-delimited text.
- Bank activities, immutable activity versions, and course activities carry concept/skill selections.
- `ActivityAttempt`, `Grade`, and append-only `GradeEvent` records provide summative history.
- Compound Tests preserve item-level results through `TestItemAttempt`.
- Plugins can retain formative interaction events and plugin-specific grading dimensions.
- `CourseGroupParticipant` is the enrollment identity and may optionally link to a `User`.
- The core background-job service can run durable asynchronous projection work.

The main missing pieces are stable skill identity, normalized evidence, a versioned inference projection, and product/API surfaces.

## Agreed Design Decisions

### Ownership Boundary

- The student model is a **core platform capability**, not an activity plugin.
- Core owns stable skill identity, normalized evidence, inference configuration, projections, authorization, and generic APIs.
- Activity plugins own their raw interaction state, artifacts, and domain-specific interpretation.
- Plugins may emit core-neutral learning signals through a shared SDK contract.
- Plugins must not write `LearnerEvidence` or `LearnerSkillState` directly.
- Core validates emitted signals against the immutable activity skill mapping before persistence.

### Participant Scope

- The initial model is keyed by `CourseGroupParticipant`.
- `userId` remains optional and is stored only as a useful secondary reference.
- The first release is section/course-local even when a participant has a `userId`.
- Participants must never be merged solely by email.
- Cross-course aggregation is deferred until identity, consent, curriculum-version, and teacher-visibility policies are explicitly designed.

### Evidence Versus Grade

- Learning evidence normally consumes the demonstrated **raw outcome**, before gradebook normalization or policy.
- Late penalties are excluded from mastery evidence.
- Gradebook points scaling is excluded.
- Grade release state is excluded.
- `latest`, `best`, `first`, and `weighted_average` grade selection strategies do not select evidence; each valid graded attempt may contribute evidence according to the inference configuration.
- Plugin-provided granular evidence takes precedence over distributing one overall score across all linked skills.
- A coarse overall score mapped to multiple skills receives lower weight than a direct skill-specific observation.

### Prerequisites

- Prerequisites guide recommendations and interpretation but do not manufacture direct evidence.
- Demonstrating an advanced skill does not automatically create successful evidence rows for its prerequisites.
- Any future prerequisite-derived estimate must be separately labeled as inferred, weak, and model-versioned; it must not be indistinguishable from observed evidence.

### Explainability And Rebuilding

- `LearnerEvidence` is the authoritative normalized input history.
- `LearnerSkillState` is a disposable projection.
- Projection rows identify the inference model key and version.
- A rebuild command/job must be able to delete and reproduce projections without modifying evidence.
- Regrades, deleted submissions, and corrected mappings supersede prior evidence rather than silently rewriting its meaning.

## Phase 1 Data Model: Stable Skills

The current newline-delimited `SubjectKnowledgeConcept.skills` strings are not durable identifiers. Renaming a line currently makes it indistinguishable from deleting one skill and creating another.

Add a normalized core model:

```prisma
model SubjectKnowledgeSkill {
  id        String   @id @default(cuid())
  subjectId String
  conceptId String
  title     String
  position  Int
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  subject   Subject                  @relation(fields: [subjectId], references: [id], onDelete: Cascade)
  concept   SubjectKnowledgeConcept  @relation(fields: [conceptId], references: [id], onDelete: Cascade)

  @@unique([conceptId, position])
  @@index([subjectId, active])
  @@index([conceptId, active])
}
```

Exact constraints remain subject to schema implementation. Skill titles do not need to be globally unique. Stable IDs, not titles or positions, define identity.

### Skill Editing Semantics

- Editing a title preserves the skill ID.
- Reordering preserves the skill ID and updates `position`.
- Removing a skill sets `active = false` when historical references exist; it must not cascade-delete evidence.
- A genuinely new skill receives a new ID even when its title matches a formerly retired skill.
- The subject editor may continue to present a newline-oriented UX, but it must reconcile its draft to stable rows rather than replace identity by text.
- Ambiguous reconciliation must require an explicit user decision rather than guessing from text similarity.

### Activity Skill Snapshots

Replace string-only activity skill selections with normalized mappings that preserve both identity and historical labels. Provisional models are:

```prisma
model ActivityVersionKnowledgeSkill {
  activityVersionId String
  skillId           String
  conceptId         String
  skillTitleSnapshot String
  conceptTitleSnapshot String
  createdAt         DateTime @default(now())

  @@id([activityVersionId, skillId])
  @@index([skillId])
}

model ActivityKnowledgeSkill {
  activityId          String
  skillId             String
  conceptId           String
  skillTitleSnapshot  String
  conceptTitleSnapshot String
  createdAt           DateTime @default(now())

  @@id([activityId, skillId])
  @@index([skillId])
}
```

Bank activity mappings need an equivalent authoring representation. Exact table names should follow the current bank/version/course knowledge-link naming convention.

Whole-concept selection remains an authoring intent. When an immutable `ActivityVersion` is created, Cognelo resolves the selected concept to its currently active skill IDs and snapshots that concrete mapping. A later skill addition must not retroactively alter an existing version or attempt.

During course assignment, the selected activity-version mapping is copied to the course activity. Course-local edits create an independent course mapping.

At attempt start, store or resolve an immutable skill-mapping fingerprint/snapshot so later course-activity edits cannot change the meaning of completed evidence. The implementation may either add normalized attempt-skill rows or place a validated compact snapshot in attempt metadata initially; normalized rows are preferred for queryability.

### Migration Strategy

The migration should:

1. Split every non-empty normalized `SubjectKnowledgeConcept.skills` line into a `SubjectKnowledgeSkill` row, preserving line order.
2. Resolve existing selected skill strings within each concept to the new IDs.
3. Expand existing `selectsAllSkills = true` links to the concept's active skill IDs when creating immutable version/course mappings.
4. Retain title snapshots on every migrated mapping.
5. Report unmatched or duplicate normalized strings instead of silently dropping them.
6. Update seed data and tests.
7. Remove or deprecate string-array persistence only after every read/write path uses stable IDs.

Because current development data is not guaranteed to be durable production data, implementation may choose a simpler migration after confirming deployment requirements. The stable-ID semantics must remain the same.

## Phase 2 Data Model: Normalized Evidence

Add an append-only core evidence table. Provisional schema:

```prisma
model LearnerEvidence {
  id                 String   @id @default(cuid())
  participantId      String
  userId             String?
  courseId           String
  groupId            String
  subjectId          String
  activityId         String?
  attemptId          String?
  gradeEventId       String?
  skillId            String
  skillTitleSnapshot String

  outcome             Float
  weight              Float
  evidenceType        LearnerEvidenceType
  evidenceKind        LearnerEvidenceKind
  sourcePluginKey     String?
  sourceEventKey      String
  observedAt          DateTime
  supersededAt        DateTime?
  supersededById      String?
  metadata            Json     @default("{}")
  createdAt           DateTime @default(now())

  @@unique([sourceEventKey, skillId])
  @@index([participantId, skillId, observedAt])
  @@index([courseId, groupId, observedAt])
  @@index([attemptId])
  @@index([gradeEventId])
  @@index([skillId, observedAt])
  @@index([supersededAt])
}
```

Likely enums:

```prisma
enum LearnerEvidenceType {
  formative_check
  summative_submission
  test_item
  manual_assessment
  inferred
}

enum LearnerEvidenceKind {
  practice
  assessment
  teacher_judgment
}
```

`inferred` is reserved and should not be produced in the initial release.

### Evidence Invariants

- `outcome` is finite and between `0` and `1`, inclusive.
- `weight` is finite, positive, and capped by the active inference configuration.
- `sourceEventKey` is deterministic and names the source event plus signal version.
- The same source event and skill cannot be inserted twice.
- A row's participant, subject, activity, attempt, and skill must belong to a consistent authorized scope.
- A plugin cannot emit evidence for a skill absent from the attempt's immutable skill mapping.
- Evidence metadata must not contain hidden tests, full submitted artifacts, secrets, or unrestricted plugin payloads.
- Historical rows are not edited to change outcome or weight. Corrections supersede them and create replacement rows.

### Shared Plugin Contract

Add a shared SDK contract similar to:

```ts
type LearningEvidenceSignal = {
  skillId: string;
  outcome: number;
  weight?: number;
  kind: "practice" | "assessment" | "teacher_judgment";
  dimensions?: Record<string, number>;
  metadata?: Record<string, unknown>;
};

type LearningEvidenceContext = {
  courseId: string;
  groupId: string;
  participantId: string;
  activityId: string;
  attemptId?: string;
  allowedSkills: Array<{
    skillId: string;
    conceptId: string;
    skillTitleSnapshot: string;
  }>;
};
```

The precise handler may be a grading-result extension or a server hook. The first implementation should prefer a grading-result extension for synchronous summative signals because it keeps the evidence source adjacent to the authoritative raw grade. Formative events need a separate explicit ingestion service/hook.

Plugins return signals; core:

- validates schema and scope;
- applies configured default/capped weights;
- assigns deterministic source keys;
- stores evidence;
- schedules projection updates.

### Coarse Core Fallback

When no plugin-specific signals exist, core may derive one coarse signal per linked skill from:

```text
outcome = clamp(rawScore / rawMaxScore, 0, 1)
```

This fallback:

- uses the raw attempt result before late penalties and gradebook normalization;
- distributes the outcome only across the immutable attempt skill mapping;
- uses a lower configured weight because the score may not measure each skill independently;
- records `metadata.derivation = "activity_raw_score_fallback"`;
- must not run when the plugin supplied valid granular signals for the same skill/source.

Activities with no mapped skills create no learning evidence. They remain valid gradebook activities.

### Regrades, Overrides, And Deletions

- Regrading supersedes evidence produced from the earlier grade event for that attempt and inserts evidence linked to the new event.
- Submission deletion supersedes all active evidence derived from that submission/attempt.
- A manual grade override does not automatically become teacher-judgment evidence unless the grading UI explicitly supplies skill-level observations or the product decision intentionally treats the raw override as a coarse replacement signal.
- The initial implementation should treat a normal overall override as coarse replacement evidence with a distinct `manual_assessment` type and conservative weight, while preserving the prior evidence as superseded.
- Changing current activity skill mappings does not rewrite historical attempt evidence.
- A dedicated administrative repair path may correct a mistaken historical mapping by superseding old evidence and inserting replacement evidence with an audit reason.

## Phase 3 Data Model: Projected Skill State

Add a rebuildable projection table:

```prisma
model LearnerSkillState {
  id                   String   @id @default(cuid())
  participantId        String
  userId               String?
  courseId             String
  groupId              String
  subjectId            String
  skillId              String

  masteryProbability   Float
  confidence           Float
  effectiveEvidence    Float
  successfulEvidence   Float
  unsuccessfulEvidence Float
  evidenceCount        Int
  distinctActivityCount Int
  lastPracticedAt      DateTime?
  status               LearnerSkillStatus
  modelKey             String
  modelVersion         Int
  explanation          Json     @default("{}")
  computedAt           DateTime @default(now())
  updatedAt            DateTime @updatedAt

  @@unique([participantId, skillId, modelKey, modelVersion])
  @@index([courseId, groupId, skillId])
  @@index([participantId, status])
  @@index([skillId, status])
}
```

Likely status enum:

```prisma
enum LearnerSkillStatus {
  unknown
  emerging
  developing
  proficient
  secure
}
```

Status thresholds are inference-policy configuration, not database truth.

## Initial Inference Model

Use a weighted Beta model for the first release:

```text
success = sum(effectiveWeight * outcome)
failure = sum(effectiveWeight * (1 - outcome))

mastery = (priorSuccess + success)
          / (priorSuccess + priorFailure + success + failure)
```

The first policy should define and version:

- `priorSuccess` and `priorFailure`;
- default weight by evidence kind/type;
- maximum plugin-requested weight;
- fallback activity-score weight;
- repeated-attempt decay;
- optional time decay;
- confidence calculation;
- status thresholds;
- minimum effective evidence and distinct contexts required for `proficient` and `secure`.

Provisional repeated-attempt factors are:

```text
first attempt       1.00
second attempt      0.70
third attempt       0.49
later attempt n     0.70^(n - 1)
```

Provisional evidence weights are:

```text
granular summative assessment  1.00
coarse activity-score fallback 0.50
formative check                0.25
teacher skill judgment         1.50
```

These values are starting hypotheses, not final pedagogical claims. They must live in a named model configuration such as `weighted_beta_v1`, be tested, and be recalibrated through validation.

### Confidence

`masteryProbability` and `confidence` must remain separate. A neutral prior with no evidence may have a mastery mean near `0.5`, but its confidence is low and its status is `unknown`.

The first confidence function may be a bounded monotonic transformation of effective evidence, for example:

```text
confidence = effectiveEvidence / (effectiveEvidence + confidenceScale)
```

`confidenceScale` is versioned configuration. Status calculation must also account for distinct activity/context count so repeated retries on one activity cannot alone establish `secure` status.

### Time Decay

Time decay is optional for the first vertical slice. If enabled, use a documented half-life and compute effective weight at projection time rather than mutating stored evidence. This keeps evidence historically accurate and makes alternate projections possible.

## Processing Lifecycle

The target summative flow is:

1. Core records the attempt, grade, and `GradeEvent` through the existing gradebook transaction.
2. The same reliable boundary writes a student-model outbox request describing the authoritative source event.
3. A background-job handler resolves the immutable attempt-to-skill mapping.
4. It obtains validated plugin signals or derives coarse fallback signals.
5. It inserts evidence idempotently and supersedes earlier source evidence when required.
6. It enqueues or performs projection recomputation for the affected participant/skill pairs.
7. Projection rows are upserted with the active model key/version and an explanation summary.

The grade transaction must not depend on an external model or LLM. Evidence/projection processing may be asynchronous, but a successful grade must always leave a durable outbox/job record so student-model updates cannot be silently lost.

### Background Job Handlers

Provisional handler keys:

```text
student-model.materialize-evidence
student-model.recompute-skill-state
student-model.rebuild-participant
student-model.rebuild-course
```

Handlers must be idempotent and safe to retry. Bulk rebuilds should page through participants/evidence rather than enqueue an unbounded job payload.

### Projection Explanation

The `explanation` JSON should remain compact and sanitized. It may include:

```json
{
  "modelKey": "weighted_beta",
  "modelVersion": 1,
  "activeEvidenceCount": 4,
  "distinctActivityCount": 2,
  "effectiveEvidence": 2.2,
  "mostRecentEvidenceAt": "...",
  "statusReasons": ["sufficient evidence", "mixed outcomes"]
}
```

It must not duplicate full plugin artifacts or student submissions.

## Initial Evidence Sources

### Summative Attempts

- First vertical-slice source.
- Integrate at `recordActivityAttemptGradingResult` through a durable outbox/job record.
- Prefer plugin granular signals; otherwise use raw-score fallback.

### Compound Test Items

- Use `TestItemAttempt` results and the child activity's immutable skill mapping.
- Do not apply the parent Test score to every skill when item-level evidence exists.
- Item-level manual adjustments must supersede the affected item evidence and trigger recomputation.

### Formative Plugin Events

- Add after the summative vertical slice.
- Parsons should be the first formative integration because its check events already distinguish order and indentation behavior.
- A coding plugin should follow, using test/rubric categories rather than raw execution logs.
- Formative event ingestion must be explicit and idempotent; analytics tables must not be polled heuristically.

### Teacher Judgments

- A future teacher workflow may record skill-level observations directly.
- Teacher judgments require an actor, reason/note, scope, and audit record.
- They receive higher default weight but remain supersedable, visible in evidence drill-down, and distinguishable from activity evidence.

## Authorization And Privacy

- Course owners, course teachers, TAs, and authorized group teachers may view student-model data within their existing course/group scope.
- Students may view only their own model data through participant-scoped authorization.
- Grade release does not determine whether evidence exists; student-facing visibility policy is separate and must be explicitly defined before enabling the student view.
- The first teacher view may include unreleased assessment evidence because authorized teachers already manage the underlying work.
- Student APIs must not reveal hidden tests, reference answers, raw plugin payloads, other participants, or teacher-only notes.
- Research export and research consent remain separate concerns. Student-model data must not automatically enter research exports until those policies are implemented.
- AI tutor context must be minimal, structured, and scoped to the current participant/course. It must not include unrestricted evidence history or private grading artifacts.

## API Plan

Exact route names remain provisional.

Teacher APIs:

```text
GET /api/courses/:courseId/student-model/skills
GET /api/courses/:courseId/groups/:groupId/student-model
GET /api/courses/:courseId/groups/:groupId/participants/:participantId/student-model
GET /api/courses/:courseId/groups/:groupId/participants/:participantId/student-model/skills/:skillId/evidence
POST /api/courses/:courseId/student-model/rebuild
```

Student APIs:

```text
GET /api/courses/:courseId/groups/:groupId/student-model/me
GET /api/courses/:courseId/groups/:groupId/student-model/me/skills/:skillId/evidence
```

AI tutor service contract:

```ts
type StudentModelTutorContext = {
  strongSkills: SkillSummary[];
  developingSkills: SkillSummary[];
  uncertainSkills: SkillSummary[];
  recentDifficulties: DifficultySummary[];
  recommendedPrerequisites: SkillSummary[];
  generatedAt: string;
  modelKey: string;
  modelVersion: number;
};
```

The tutor context service must return bounded arrays, localized display snapshots where needed, confidence/status information, and no unrestricted grade or submission history.

## Product Surfaces

### Teacher Skill Matrix

The smallest useful teacher surface is a section-level matrix:

- rows: student participants;
- columns: active subject skills, grouped by concept;
- cells: status plus confidence indicator;
- explicit `unknown`/insufficient-evidence state;
- filters by concept, skill status, and student;
- drill-down from a cell to supporting active and superseded evidence;
- class-level distribution for the selected skill;
- prerequisite-support indicators derived from recommendation rules, not fabricated evidence.

The matrix must not imply false precision. Prefer status and confidence with an optional percentage detail over presenting mastery probability alone as a definitive grade.

### Student Skill Summary

After teacher validation, add a student-facing view showing:

- skills practiced;
- evidence-informed status and confidence language;
- activities that contributed visible evidence;
- suggested prerequisite or practice activity;
- a plain-language explanation of why the suggestion appears;
- no comparative ranking against classmates in the first release.

### Recommendations

Recommendations are a separate intervention layer. Initial deterministic rules may consider:

- low/developing status with sufficient evidence;
- unknown prerequisites blocking a target skill;
- recent unsuccessful evidence;
- available activities mapped to the needed skill;
- whether an activity is currently visible and available to the participant;
- avoiding immediate repetition of the same activity when alternatives exist.

Recommendation output must store or return its rationale. It does not update mastery merely because it was shown.

## Validation Strategy

Before considering a more complex model:

- compare projected states with independent teacher judgments;
- inspect calibration by mastery/confidence bands;
- measure how often `unknown` is correctly preserved when evidence is sparse;
- analyze repeated-attempt behavior and gaming resistance;
- compare coarse fallback evidence with plugin-granular evidence;
- test stability under regrade, deletion, and rebuild;
- review differential behavior across activity types and student groups;
- document known validity limitations.

Model changes must create a new `modelVersion` and allow side-by-side/rebuild evaluation. Do not silently reinterpret existing projection rows under changed parameters.

## Implementation Phases

### Phase 0: Finalize Schema And Contracts

- Confirm stable skill editing/reconciliation UX.
- Confirm activity-version and attempt skill snapshot tables.
- Confirm evidence enums, source key format, and supersession relationships.
- Confirm inference configuration storage: code-owned versioned constants initially versus a database model.
- Confirm privacy/visibility behavior for the first teacher-only release.

### Phase 1: Stable Skill Identity

- Add `SubjectKnowledgeSkill` and migrations.
- Migrate current concept skill lines.
- Update subject contracts/services/editor to preserve skill IDs.
- Add bank, activity-version, course-activity, and attempt mapping/snapshot support.
- Update AI authoring knowledge contracts to use stable skill IDs while still sending titles as model context.
- Update all affected root/plugin documentation and tests.

### Phase 2: Evidence Foundation

- Add `LearnerEvidence` and any outbox/source-processing model.
- Add core ingestion and supersession services.
- Extend the activity SDK with validated learning-evidence signals.
- Integrate summative grading with durable evidence materialization.
- Implement the coarse raw-score fallback.
- Add repair/replay tooling for a source event.

### Phase 3: Weighted Beta Projection

- Add `LearnerSkillState` and status enum.
- Implement `weighted_beta_v1` as a pure, unit-tested projection function.
- Add repeated-attempt weighting and confidence calculation.
- Add idempotent recompute and paged rebuild jobs.
- Store compact explanations and model version metadata.

### Phase 4: Smallest Credible Vertical Slice

- Support summative attempt evidence for at least MCQ and Parsons.
- Add teacher section skill-matrix API.
- Add teacher matrix UI and evidence drill-down.
- Verify regrade, override, deletion, and rebuild behavior end to end.
- Keep the surface teacher-only during validation.

### Phase 5: Granular And Formative Evidence

- Add Parsons order/indentation skill signals.
- Add one coding plugin's test/rubric skill signals.
- Add explicit formative-event ingestion.
- Compare granular projections with coarse fallback results.
- Refine versioned weights based on validation.

### Phase 6: Student View And Tutor Context

- Define student visibility policy.
- Add student skill summary and sanitized evidence explanations.
- Add the bounded AI tutor context service.
- Ensure tutor prompts describe estimates as uncertain and evidence-informed.

### Phase 7: Recommendations

- Implement deterministic prerequisite/practice recommendation rules.
- Filter recommendations by visible, available course activities.
- Expose rationales to students and teachers.
- Record recommendation impressions/actions separately from evidence.

### Phase 8: Model Validation And Future Models

- Validate against teacher judgments and outcome data.
- Publish calibration/limitations documentation.
- Decide whether BKT, IRT, or another version adds enough value.
- If adopted, keep normalized evidence unchanged and write a new side-by-side projection version.

## Smallest Credible Vertical Slice

The recommended first implementation milestone is:

```text
stable skills
  -> immutable summative attempt-to-skill mappings
  -> append-only raw-score evidence
  -> weighted_beta_v1 skill state
  -> teacher-only section skill matrix and evidence drill-down
```

This slice is useful, explainable, testable, and independent of adaptive sequencing. It also exercises the most important architectural guarantees before formative signals and recommendations increase complexity.

## Testing Strategy

### Schema And Migration Tests

- skill IDs survive title edits and reordering;
- retired skills preserve historical mappings/evidence;
- whole-concept version snapshots expand deterministically;
- string-to-ID migration reports unmatched selections;
- foreign keys prevent cross-subject mappings.

### Evidence Service Tests

- raw outcomes exclude late penalties and normalized gradebook scaling;
- source keys make insertion idempotent;
- plugin signals outside the allowed mapping are rejected;
- granular signals suppress overlapping coarse fallback signals;
- regrades and overrides supersede the correct evidence;
- deletion leaves auditable superseded rows;
- activities without skills create no evidence;
- hidden plugin artifacts never enter evidence metadata.

### Projection Tests

- empty evidence produces `unknown` with low confidence;
- fractional outcomes calculate expected posterior values;
- repeated-attempt decay is deterministic;
- superseded evidence is excluded;
- time decay, if enabled, is computed rather than persisted into evidence;
- rebuild produces byte-equivalent numeric/status results for a fixed model version;
- distinct-context requirements prevent one repeatedly retried activity from producing `secure`.

### Authorization And API Tests

- teachers/TAs remain within authorized course/group scope;
- students can read only their own sanitized state;
- inactive/unlinked participants remain supported;
- tutor context is bounded and excludes raw submissions/hidden tests;
- rebuild routes are manager/admin only and idempotent.

### Integration Tests

- MCQ summative grading creates evidence and updates projections;
- Parsons granular results map to the intended skills;
- compound Test item evidence uses child mappings rather than the parent score;
- regrading triggers supersession and recomputation;
- submission deletion removes evidence from the active projection;
- background-job retries do not duplicate evidence.

## Operational Requirements

- Add metrics for pending/failed evidence and projection jobs.
- Make evidence/job lag visible to operators; UI may show a last-updated timestamp.
- Provide scoped rebuild commands for a participant, course, model version, and eventually all data.
- Rebuilds must be resumable/paged and safe alongside normal ingestion.
- Backups must include normalized evidence; projections can be rebuilt but should still be backed up for operational continuity.
- Do not log evidence metadata or tutor context at unrestricted verbosity.

## Open Design Questions

These should be resolved in Phase 0 and recorded here:

1. Should inference policy be code-owned versioned configuration initially, or stored in a database table from the start?
2. Should attempt skill snapshots be normalized rows or a JSON snapshot plus fingerprint in the first migration?
3. How should the subject editor explicitly distinguish rename, retire, split, and merge operations?
4. Should overall manual grade overrides automatically create coarse evidence, or require an explicit teacher choice?
5. What minimum effective evidence and distinct activity counts define `proficient` and `secure` for `weighted_beta_v1`?
6. Is time decay required in version 1, and if so what half-life is pedagogically defensible?
7. When should students see evidence derived from unreleased summative work?
8. Which coding plugin is the first granular/formative integration after Parsons?
9. How should a Test item mapped to several skills apportion granular evidence when the child plugin supplies only an overall item score?
10. What course/research consent rules apply before student-model data is included in analytics exports?

## Documentation Updates Required During Implementation

Every phase must review and update, where affected:

- root `README.md`;
- `docs/PROJECT_MEMORY.md`;
- `docs/ARCHITECTURE.md`;
- this implementation plan;
- `docs/GRADEBOOK_IMPLEMENTATION_PLAN.md` when grading/evidence boundaries change;
- `docs/plugin-authoring/` for the learning-evidence SDK contract;
- each affected activity plugin's `README.md` and `PROJECT_MEMORY.md`.

