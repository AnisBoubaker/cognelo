# Atomic AI grading and interruption recovery

Teacher **Assess with AI** actions (one submission or a class batch) use a durable `AiGradingRun`. Each compound Test is evaluated completely before any of its exercise grades or feedback can replace existing work. Normal completion saves the prepared results; cancellation or interruption asks the initiating teacher whether to keep completed copies or discard the run.

## Teacher experience

- The shared progress dialog shows completed students and a keyboard-accessible **Cancel** button. A copy counts as complete only after every applicable question has succeeded and the Test can produce a complete grade.
- Cancellation stops further requests. The decision dialog names the students with completed grading and those not graded, including the interrupted or failed copy, and offers **Keep completed grading** and **Discard this run**. Existing grades and feedback stay unchanged until Keep or successful completion.
- A provider failure, transport error, or expired browser heartbeat stops the run with the same decision. Reopening the activity report recovers the unresolved run. A fresh heartbeat from another open controlling tab is respected; otherwise a lost browser is detected after 45 seconds. Recovery reads retry after temporary connection errors.
- Keep publishes only complete copies. Discard removes the prepared results from the run and preserves previous grades, feedback, submission state and release settings. Private staged evaluation artifacts remain for audit and are excluded from ordinary reports/history.
- A successful run saves all completed results automatically. The short final database save cannot be cancelled once it commits; the UI disables Cancel while saving. A lost final response is reconciled with the saved terminal status and never repeats grading.
- Templates remain excluded from targets. The optional standalone instruction-persistence checkbox still saves the teacher's instructions independently of the grading decision. Test instructions remain question-owned.

## Persistence and concurrency

`AiGradingRun` is core-owned, cascades with its actor/course/activity, and records the targets, names, status, heartbeat, guidance, and private prepared results. One unresolved run is permitted per initiating teacher/activity. Requests are restricted to the initiating user and recheck current course/section grading permissions. Responses expose only progress, participant names, and safe failures; evaluation payloads never enter the progress DTO.

The browser drives one target request at a time, with a heartbeat every 10–12 seconds. This does not use `BackgroundJob`, a scheduled worker, submission-triggered evaluation, or automatic model retries. A database row lock claims each target once. A repeated request for an already-completed target returns its status. Cancellation changes the durable state under the same lock, so a late provider response cannot reattach its results or start another question. Lease expiry is enforced on reads and before accepting prepared results; no scanner is necessary.

Model calls occur outside database transactions. Preparation captures the attempt, existing grade, and every child revision. A short serializable transaction rechecks those revisions, publishes plugin artifacts, writes all child feedback/grades, recomputes the parent total, and records ordinary grade events plus research/course audit events. Keeping a subset of completed students uses the same transaction for that entire selected set. A stale/reopened/deleted submission, competing regrade, or changed grade rejects the save without overwriting a newer teacher decision. The run remains available to discard. No partial Test is committed, and release flags remain unchanged.

The legacy direct Test AI endpoint also stages every child and commits them together, protecting callers outside the new run UI. Automatic deterministic regrading and manual review retain their separate contracts; this document governs AI evaluation.

## Plugin contract

`aiFeedback.evaluateAttempt` accepts `deferPublication: true`. Supported providers save successful private artifacts with status `staged`, which every ordinary history/report fallback excludes. `aiFeedback.publishEvaluation` validates the exact activity, core attempt and feedback reference and promotes that artifact through the host's neutral transaction executor. Deterministic no-answer feedback may have no artifact. Plugins without this explicit capability cannot enter cancellable grading. Programming Exercises and MCQ implement it; ordinary formative evaluation remains unchanged.

The host never updates plugin tables directly, deletes immutable model evidence, runs code during publication, or stores private provider credentials in a run. Submitted answers and authored configurations remain untouched.

## Migration and verification

Migration `202610310001_atomic_ai_grading_runs` adds the core run table and indexes idempotently. Apply through `npm run db:migrate:all` and restart application services so they load the generated client. There are no environment-variable or execution-service changes.

`atomic-ai-grading.spec.ts` uses disposable local records and a controlled model endpoint to verify mid-Test failure, cancellation with an in-flight response, named lists, Keep, Discard, expired-session recovery after reload, hidden staged results, student rejection, optimistic conflicts, mobile layout and keyboard cancellation. `test-coding-ai-grading.spec.ts` verifies successful atomic publication with question-specific templates; `guided-ai-grading.spec.ts` covers standalone guidance/exclusion. Core preparation and plugin tests cover deferred publication, cancellation checks, common transaction use and stale-grade rejection. No production browser tests are permitted.
