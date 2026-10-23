# Activity messaging

Messaging belongs to core and works for standalone activities and compound Tests without plugin changes. **Course content → activity Settings → General** offers two switches, both off by default:

- **Enable activity messaging** enables broadcasts and the learner's envelope.
- **Allow students to message teachers** additionally permits student-initiated private conversations and teacher replies.

These activity-wide switches apply to every section, not to section/team/student exceptions. They persist as `Activity.metadata.allGroupsAssignment.messagingEnabled` and `twoWayMessagingEnabled`. Assignment-settings GET exposes both booleans; POST preserves an omitted switch for older callers. The switches themselves require no database migration.

## Chat and delivery

The teacher's **Message students** dialog has left-side Broadcast and student tabs. A private tab appears only after that student sends a message; opening the activity or receiving a broadcast does not establish a private chat. Staff cannot initiate a private conversation. Students see broadcasts and their own private messages/replies together, with distinct broadcast labels and chat bubbles. The student write endpoint accepts only message text: it derives enrollment, conversation, and sender on the server and has no recipient selector.

Explicit broadcasts reach every student enrollment in the assigned, authorized sections, including offline students. Delivery is recorded once per enrollment, against its latest current/logical attempt, and does not renew presence or create academic attempts. Broadcast history includes delivery/read counts. The optional notice accompanying a live settings or authoring change still targets only students currently answering: its existing transaction and recipient behavior are preserved. See [Live activity authoring](LIVE_ACTIVITY_AUTHORING.md).

Messages remain stored in attempt-scoped `ActivityConversation` records. The activity chat combines an enrollment's records across attempts, labels messages with their attempt, and pages backward in batches of 100. Broadcast history is also paginated. Staff review can filter history to the submission being inspected, including logical conversations whose `attemptId` was not yet linked. Per-user read cursors are monotonic and bounded by the latest displayed message; reading a specific attempt does not mark other attempts read.

## Deleting sent messages

Teachers can delete their own previously sent broadcasts or private replies using the trash action on the message. The original body, sender, sent timestamp, ID, and read receipts remain intact. Both teacher and learner views render the body with a strikethrough and a **Deleted** label; the action disappears afterward. A broadcast deletion atomically marks the broadcast and every delivered copy, including offline recipients. Selecting its copy from a private thread deletes the entire original broadcast.

Deletion requires current teacher messaging permission and authorship. Students and TAs cannot delete messages, and teachers cannot delete student messages or another teacher's messages. A section teacher must still have permission for every originally targeted section when deleting a broadcast. Deleting one's retained messages is allowed even if messaging or two-way communication has since been disabled. Grading review permits this author action while keeping replies unavailable. Repeated deletion is idempotent and preserves the first deletion timestamp.

`deletedAt` on `ActivityMessageBroadcast` and `ActivityConversationMessage` records deletion without removing content. Apply core migration `202610230001_activity_message_deletion` with:

```bash
npm run db:migrate:all
```

No environment variables change. Indexed deletion timestamps/counts participate in the existing lightweight revision markers, so deleting an older message triggers refresh even when the newest sent message is unchanged. No polling interval or background request is added. History responses include scoped ID/timestamp deletion markers to update already-loaded older pages; they do not repeat those messages' bodies. Client merging preserves a successful deletion if an older request finishes afterward.

## Live controls and presence

The existing learner content-access poll runs every 20 seconds, including while messaging is disabled. It carries only a small messaging revision, unread count, conversation identity, and sending permission; it never returns message bodies. There is no separate messenger timer. Closed chats fetch no history; opening a chat, sending, loading earlier messages, or receiving a changed revision while open retrieves history. Enabling midway exposes the envelope without reloading or replacing answers; disabling closes the dialog and hides the envelope while retaining records. The separate two-way switch updates the composer live. History tabs use read-only retrieval and never renew answering presence. Student sending requires an active, unexpired timed/Test attempt or a permitted next untimed attempt; submitted/expired work remains readable when consultation is allowed.

The open activity report polls a small messaging revision every ten seconds and on focus, using its existing cadence. Open dialogs fetch their contents only when that revision changes; they have no independent timer. Grading review loads its selected discussion on demand without polling. Hidden tabs skip periodic messaging checks, and unmounting the activity page cancels its timer. **Message students** requires messaging enabled and teacher messaging permission. Disabling messaging closes that dialog. Saved discussions remain accessible from **Review and grade → Activity messages** in individual and batch grading, even with messaging subsequently disabled. Review follows the selected submission when one is available; it does not allow replies, but authors can delete their own sent messages.

Presence remains independent of messaging. Recently present, unfinished attempts (45-second window) drive the **Students are answering** warning for live settings changes, even when messaging is off. Timed activities and Tests require a started attempt to renew presence; untimed activities use the next logical attempt. A broadcast created for an offline student uses a closed, inactive delivery record. Review/history requests do not renew presence.

## Authorization and retained access

Course teachers and administrators may broadcast/reply across assigned sections; section teachers are limited to their own sections. Authorized grading staff, including section teaching assistants, can read discussions during review, but TAs cannot broadcast or reply. Every participant, activity, course, optional attempt, and history cursor is checked against this scope.

Learners can retrieve and mark only their own enrolled history. Ordinary availability/SEB changes may leave existing notices readable without renewing presence. The opt-in [activity content closure rule](ACTIVITY_CONTENT_ACCESS.md) takes precedence on all history/read/write paths: if post-submission consultation is closed, messages are also closed because they may quote exam content. Staff retain access. Writes check current messaging/two-way switches again inside the transaction.

## Verification

- `tests/e2e/activity-message-deletion.spec.ts`: teacher/learner strikethrough, retained text, broadcast copies, author-only authorization, idempotency, old history pages, and heartbeat invalidation.
- Core and route unit tests cover deletion ownership/scope, retained client history, switches, ownership, section scope, student-initiated replies, offline delivery, current-attempt presence, history cursors, and content closure.
- `tests/e2e/activity-chat.spec.ts`: chat UI, offline delivery, student isolation, live two-way toggles, post-submission review, content closure, retained staff access, pagination, and read receipts.
- `tests/e2e/activity-messaging.spec.ts`: broadcast delivery, read state, countdown/envelope placement, and history retained across attempts.
- `tests/e2e/activity-messaging-settings.spec.ts`: timed/untimed enablement, preserved answers/history, settings cancellation, and older API callers.
- `tests/e2e/live-test-settings.spec.ts`: enabling messaging while applying a live compound-Test exception.
