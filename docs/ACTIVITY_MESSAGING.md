# Activity messaging

Messaging belongs to core and works for standalone activities and compound Tests without plugin changes. **Course content → activity Settings → General** offers two switches, both off by default:

- **Enable activity messaging** enables broadcasts and the learner's envelope.
- **Allow students to message teachers** additionally permits student-initiated private conversations and teacher replies.

These activity-wide switches apply to every section, not to section/team/student exceptions. They persist as `Activity.metadata.allGroupsAssignment.messagingEnabled` and `twoWayMessagingEnabled`. Assignment-settings GET exposes both booleans; POST preserves an omitted switch for older callers. No database migration is required.

## Chat and delivery

The teacher's **Message students** dialog has left-side Broadcast and student tabs. A private tab appears only after that student sends a message; opening the activity or receiving a broadcast does not establish a private chat. Staff cannot initiate a private conversation. Students see broadcasts and their own private messages/replies together, with distinct broadcast labels and chat bubbles. The student write endpoint accepts only message text: it derives enrollment, conversation, and sender on the server and has no recipient selector.

Explicit broadcasts reach every student enrollment in the assigned, authorized sections, including offline students. Delivery is recorded once per enrollment, against its latest current/logical attempt, and does not renew presence or create academic attempts. Broadcast history includes delivery/read counts. The optional notice accompanying a live settings or authoring change still targets only students currently answering: its existing transaction and recipient behavior are preserved. See [Live activity authoring](LIVE_ACTIVITY_AUTHORING.md).

Messages remain stored in attempt-scoped `ActivityConversation` records. The activity chat combines an enrollment's records across attempts, labels messages with their attempt, and pages backward in batches of 100. Broadcast history is also paginated. Staff review can filter history to the submission being inspected, including logical conversations whose `attemptId` was not yet linked. Per-user read cursors are monotonic and bounded by the latest displayed message; reading a specific attempt does not mark other attempts read.

## Live controls and presence

The existing learner content-access poll runs every 20 seconds, including while messaging is disabled. It carries only a small messaging revision, unread count, conversation identity, and sending permission; it never returns message bodies. There is no separate messenger timer. Closed chats fetch no history; opening a chat, sending, loading earlier messages, or receiving a changed revision while open retrieves history. Enabling midway exposes the envelope without reloading or replacing answers; disabling closes the dialog and hides the envelope while retaining records. The separate two-way switch updates the composer live. History tabs use read-only retrieval and never renew answering presence. Student sending requires an active, unexpired timed/Test attempt or a permitted next untimed attempt; submitted/expired work remains readable when consultation is allowed.

The open activity report polls a small messaging revision every ten seconds and on focus, using its existing cadence. Open dialogs fetch their contents only when that revision changes; they have no independent timer. Grading review loads its selected discussion on demand without polling. Hidden tabs skip periodic messaging checks, and unmounting the activity page cancels its timer. **Message students** requires messaging enabled and teacher messaging permission. Disabling messaging closes that dialog. Saved discussions remain accessible from **Review and grade → Activity messages** in individual and batch grading, even with messaging subsequently disabled. Review is read-only and follows the selected submission when one is available.

Presence remains independent of messaging. Recently present, unfinished attempts (45-second window) drive the **Students are answering** warning for live settings changes, even when messaging is off. Timed activities and Tests require a started attempt to renew presence; untimed activities use the next logical attempt. A broadcast created for an offline student uses a closed, inactive delivery record. Review/history requests do not renew presence.

## Authorization and retained access

Course teachers and administrators may broadcast/reply across assigned sections; section teachers are limited to their own sections. Authorized grading staff, including section teaching assistants, can read discussions during review, but TAs cannot broadcast or reply. Every participant, activity, course, optional attempt, and history cursor is checked against this scope.

Learners can retrieve and mark only their own enrolled history. Ordinary availability/SEB changes may leave existing notices readable without renewing presence. The opt-in [activity content closure rule](ACTIVITY_CONTENT_ACCESS.md) takes precedence on all history/read/write paths: if post-submission consultation is closed, messages are also closed because they may quote exam content. Staff retain access. Writes check current messaging/two-way switches again inside the transaction.

## Verification

- Core and route unit tests cover switches, ownership, section scope, student-initiated replies, offline delivery, current-attempt presence, history cursors, and content closure.
- `tests/e2e/activity-chat.spec.ts`: chat UI, offline delivery, student isolation, live two-way toggles, post-submission review, content closure, retained staff access, pagination, and read receipts.
- `tests/e2e/activity-messaging.spec.ts`: broadcast delivery, read state, countdown/envelope placement, and history retained across attempts.
- `tests/e2e/activity-messaging-settings.spec.ts`: timed/untimed enablement, preserved answers/history, settings cancellation, and older API callers.
- `tests/e2e/live-test-settings.spec.ts`: enabling messaging while applying a live compound-Test exception.
