# Activity content after attempts end

Course content → activity Settings → General offers **Hide activity content when no further attempts are allowed**. It defaults off, including for existing activities. The switch is shared by all sections; one switch on a compound Test protects every child. Section, team, and student exceptions still determine each learner's effective attempt limit, Until date, and duration. Older settings clients that omit the switch retain its saved value; duplication removes the assignment policy as usual.

## Access rules

When enabled, students lose question/answer access once the final permitted attempt is complete, the effective Until timestamp is reached (exclusive), or summative grade release prevents further attempts. Unlimited and formative attempts remain accessible until their closing date. A started attempt counts toward the limit but stays accessible while it can validly continue. Reopening the same attempt or granting additional attempts can restore access, subject to the current closing date, duration, and grade-release policy. Neither action silently resets time. Authorized course and section staff retain their existing access.

Closed students retain the activity title, submission receipts, deletion reasons, and independently released grade totals. Prompts, answers, previous/deleted answer snapshots, execution histories, solutions, detailed grade reports, feedback/challenge content, activity messages, and exam attachments are unavailable. Releasing grades or enabling Release solution does not override this restriction. The stored academic, grading, and audit records remain intact for staff.

This prevents later retrieval; it cannot revoke material copied, photographed, or saved while legitimately accessible. Public external resources and materials independently shared elsewhere retain their own access policy.

## Enforcement

- `Activity.metadata.allGroupsAssignment.hideAfterAttempts` stores the opt-in setting. No database migration is required.
- Core `activity-content-access.ts` resolves current policy and student exceptions using server time. Only declared final-submission routes can finish an expired started attempt; a completed submission cannot be replayed to retrieve its payload.
- The shared assigned-route guard in `apps/api/src/lib/safe-exam-browser.ts` enforces both SEB and closed-content policy. New content, draft, solution, Test-child, or plugin routes must use this guard. The plugin dispatcher checks declared finalization methods separately and rechecks access after execution. A successful final submission returns only `{ activityContentClosed: true }` when access closes.
- The `content-access` GET endpoint is a metadata-only, enrollment-authorized receipt feed, including only the independently released total for that activity. It never loads the full course gradebook or plugin report. Timing/status and submission-audit endpoints may continue serving safe metadata; audit projections remove retained answer snapshots and plugin references when closed. These exceptions never authorize new answer writes.
- The group overview omits protected authored configuration, descriptions, source-bank copies, and activity-version snapshots. Full content is fetched only through the assigned endpoint. Released-grade feeds remove feedback, challenge targets, deleted-answer metadata, and plugin grading reports when closed. Direct challenge history and media delivery enforce the same rule.
- The learner boundary loads access before mounting an activity, checks every 20 seconds and on focus, and unmounts protected content on closure. Shared API closure signals clear it immediately after the final submission. Plugin notification handlers treat that signal as host-handled closure, while ordinary errors remain visible. The visible course Grades tab refreshes independently to remove detailed reports after live policy changes; the content tree does not poll detailed reports.

## Expired work

Normal final submission remains available for an expired active attempt and completes through the owning plugin/Test runtime. A closed page can POST its metadata-only `content-access` endpoint to preserve server-saved expired work if the answering renderer is no longer mounted. Recovery waits 30 seconds to let normal submission finish, rechecks current deadlines, and uses the existing standalone/Test timeout fallback. Test recovery honors active submission claims and serializes with autosaves. It retains saved answers as submitted-ungraded work for later teacher grading; it never invents a grade. For a Test without a duration limit, this path can use the effective Until timestamp. No scheduled job is added.

## Verification

Core tests cover default-off behavior, last-attempt boundaries, active/reopened attempts, exact closing time, unlimited/formative policy, released grades, student exceptions, receipt projection, finalization versus replay, and staff/enrollment authorization. Browser regressions in `activity-content-access.spec.ts` exercise real setting persistence, final-submission receipts, direct API denial, private exam images, released-grade summaries, additional attempts and reopening, timed/untimed compound Tests, and the installed activity-plugin read routes. Existing solution, timing, and clock-tampering regressions must remain valid with the switch off.
