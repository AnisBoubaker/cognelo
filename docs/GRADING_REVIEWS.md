# Required teacher grading reviews

Core owns required-review state independently of activity types. Programming Exercises is the first consumer, for the interaction conflict in its code-blanks response mode. Blanks remain part of the `coding-exercise` activity type and the `coding-exercises` plugin.

## Plugin contract

`GradingReviewRequest` contains a stable `reasonCode`, a bounded plain-text staff-facing `message`, and an optional opaque `evidenceRef`. Detailed evidence, test artifacts and private configuration stay in plugin-owned storage. Core staff DTOs and audit snapshots omit the evidence reference and plugin-private data.

A standalone plugin passes `reviewRequired` to `submitActivityAttempt`; core submits and requests review in one transaction. An existing submitted attempt can use `requestActivityGradingReview`. A grading handler may return `{ deferred: true, reason, reviewRequired }`; the shared regrade route persists that request. A composite submission/regrade returns `gradingResult: null` plus `reviewRequired`. A result cannot request review and award an automatic grade together.

For initial Test submission, the request is retained with the submitted child result. Core publishes reviews for the final submitted question manifest atomically with the parent submission, avoiding pending reviews for questions removed during an interrupted submission. Current-answer regrading requests a child review in the same transaction as its new evidence.

## State and publication

`ActivityGradingReview` is a sparse core table keyed by standalone attempt or Test child. It records reason, requesting plugin, version, requested/resolved timestamps and resolving staff identity. Parent/child deletion cascades. Only the learner owning the attempt or staff authorized to grade its section can request a review. Repeated reason/evidence references are idempotent, including after resolution; genuinely new evidence can require review again.

Pending reviews block automatic grade writes, AI grading preparation/publication and use as a completed grading example, Test aggregation and grade release. A regrade can preserve an earlier grade as historical evidence while the new review is pending. The student grade projection and assignment release projection withhold that participant's grade until resolution, even if the item was previously released. Deleted or currently reopened attempts do not contribute pending reviews to gradebook completion. Gradebook rows display **Needs teacher review** and shared teacher review panels explain the reason.

An authorized teacher resolves review by explicitly entering a final activity grade, or an explicit Test-question score for that child. Saving narrative feedback or rubric scores alone does not resolve it. A whole-activity override resolves every pending summative review for that gradebook item/participant; a question score resolves only its question. These changes commit with the grade and an audit event. The generic review notice surrounds the plugin's answer/evidence renderer, including manual-only review. Whole-activity final-grade decisions expose outstanding reasons from earlier submitted attempts as well.

Whole-activity overrides carry `expectedGradingReviewRevision`, a digest of the displayed review IDs/versions, alongside ordinary grade concurrency checks. Missing/stale digests cannot acknowledge pending reviews. Test-question saves use the child update timestamp, which a new review request changes. A Test batch checks the original review revision before changing questions or resolving its total. Re-entering the existing score is an explicit decision too.

Teacher reopening withdraws the old review together with the old grade, recording `grading_review_withdrawn`; the retained row is resolved and can be requested again for new evidence. The resubmission is evaluated afresh. Ordinary resolution records `grading_review_resolved`; requests record `grading_review_requested`. No email or external notification is sent.

## Database and verification

Apply the additive core migration `202611230001_activity_grading_reviews` through `npm run db:migrate:all` and regenerate clients through the same command. No environment variables change. Existing activities have no review rows and retain their grading behavior.

`packages/core/src/grading-review.test.ts` covers neutral plugin requests, scoped authorization, safe DTOs, evidence idempotency, automatic-grade blocking, stale resolution and child-only resolution. `tests/e2e/coding-blank-grading.spec.ts` exercises real local Judge0 grading, required-review persistence/release blocking, explicit teacher resolution, Test children, regrading and private substituted output. Regression suites cover ordinary Programming Exercises, MCQ, Parsons and shared Test/manual grading.
