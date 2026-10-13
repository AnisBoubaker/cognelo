# Activity messaging

Messaging is a core, course-activity setting. In **Course content → activity Settings → General**, **Enable activity messaging** controls staff broadcasts and the learner's Messages button, including compound Tests. It is off by default. The switch applies to every section; it is not a section, team, or individual exception.

## Persistence and live changes

`Activity.metadata.allGroupsAssignment.messagingEnabled` stores the boolean. Missing values mean disabled. The course assignment-settings GET exposes `general.messagingEnabled`; the POST accepts the optional boolean and preserves the saved value when older callers omit it. No database migration is needed for this switch.

Eligible learner pages poll their conversation every five seconds even while messaging is disabled. Disabled conversations return `null`, so the envelope is hidden. Enabling during an attempt exposes the existing attempt's conversation on the next poll without reloading the activity or replacing answers. Disabling hides the button and closes an open message dialog. Messages and read cursors are retained; enabling again restores the same thread. Polling pauses in hidden tabs and resumes on the next visible poll.

The activity report polls messaging availability every ten seconds and on window focus. **Message students** appears only with both the enabled switch and existing teacher permissions. Disabling also closes an open broadcast dialog. Broadcast writes recheck the switch on the server, including inside the write transaction; learner history and read receipts are also gated by the current switch.

## Presence and settings warnings

Presence continues while messaging is disabled so the teacher still receives the **Students are answering** confirmation before changing live settings. That confirmation offers an optional notice only when the resulting setting enables messaging and the teacher has permission for every target section. Enabling can include an initial notice in the same transaction; disabling cannot send an inaccessible notice. Section and exception saves use the saved course-activity switch.

## Scope and authorization

Each thread belongs to one assignment, student enrollment, and attempt number. Timed standalone activities and compound Tests require a started core attempt. Untimed activities use the next logical attempt number without creating an academic attempt on page load. New attempts start with an empty thread.

Staff broadcasts target only authorized, current conversations present within the last 45 seconds. Course teachers and administrators can reach all assigned sections; section teachers are restricted to their sections; teaching assistants cannot broadcast. Learners cannot send messages. Starting or renewing presence retains activity-access and Safe Exam Browser checks. When messaging is enabled, existing notices remain readable through enrollment ownership after a live policy change closes activity access, without renewing presence or exposing activity content.

## Verification

- `packages/core/src/activity-messaging.test.ts`: default-off presence, live toggles, stored-message/read gating, attempt isolation, recipient boundaries, and server broadcast checks.
- `packages/core/src/activity-settings-live.test.ts`: warnings while disabled and notice permissions when enabling/disabling.
- `tests/e2e/activity-messaging-settings.spec.ts`: General settings, cancellation, timed/untimed live toggles, preserved answers and history, older API caller compatibility, and teacher/learner controls.
- `tests/e2e/activity-messaging.spec.ts`: delivery, unread/read status, countdown placement, and subsequent-attempt isolation.
- `tests/e2e/live-test-settings.spec.ts`: enabling during a compound Test while applying a live exception.
