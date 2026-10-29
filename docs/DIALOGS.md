# Dialog headers and dismissal

Dismissible dialogs use the shared `DialogHeader` and `DialogCloseButton` from `@cognelo/activity-ui`. The close control is a cross with a localized accessible name and tooltip, without a visible Close label. It is a non-submit button and calls the dialog's existing cancellation, acknowledgement, or guarded close handler.

The header stays at the top of the dialog's scroll area. Ordinary dialogs use a sticky heading; settings and chat keep their heading outside an independently scrolling body. Dialog padding is described by `--dialog-padding` so the sticky surface remains flush with the panel on desktop and mobile. Keep long messages, forms, and results in the scrolling content, rather than in the sticky heading.

## Review and grade

The review workspace has one accessible dialog containing both its action bar and scrolling panel. Previous student, student position, Next student, Activity messages, and the close cross share one compact row above the content. The bar can use the available width instead of stacking Activity messages below navigation. At narrow widths, the action labels yield to icons; localized accessible names and tooltips remain.

Plugin manual-review panels accept optional `embedded` presentation. Inside the host workspace, they omit a second dialog role and duplicate close control. Standalone panels keep their own sticky header and close cross. The host continues to own unsaved-feedback confirmation and student navigation. Test review has one Save all action; drafts persist between questions, while changing students/submissions or closing still requires the existing unsaved-change confirmation. Navigation and dismissal are disabled during the save. Embedded Class overview content remains ordinary page content, without a sticky dialog heading.

## Dismissal semantics

- Keep explicit Cancel, Save, Confirm, Submit, and other decision actions in their existing forms/footers. Moving dismissal does not imply submitting or discarding a draft without its existing guard.
- Shared confirmations expose a localized Close cross distinct from the explicit Cancel action. Informational alerts whose only action is dismissal use the header cross alone. `DialogProvider` supplies the close label independently of custom confirmation labels.
- Preserve disabled dismissal while a save/upload/import requires it. Running `ProgressDialog` instances have no close control; their terminal success/error state may expose the cross when dismissal is supported.
- Unsaved-navigation dialogs close by continuing editing. Submission receipts close through their existing acknowledgement handler. Safe Exam Browser launch dialogs retain their existing cancellation destination.
- Full-screen rich-text and coding editors use the same cross at the top to exit full screen, keeping their editor state mounted. Their accessible label still describes exiting full screen.
- Existing Escape behavior, initial focus, focus restoration, shared scroll locks, and native-dialog behavior remain owned by their existing dialog implementations. New headers do not add global event listeners or move DOM nodes.

## App-wide coverage

The rollout covers these dialog families, including their plugin-owned variants:

| Family | Owning surfaces |
| --- | --- |
| Confirmation, prompt, alert, progress | `packages/activity-ui` shared dialogs |
| Rich text | Equation, table, image, and full-screen editor |
| Authoring | Knowledge generation/replacement, activity picker, Test publication, coding generation |
| Banks and course content | Create/edit/delete, filters, duplicate/move/variation, version comparison, synchronization, resource settings |
| Course management | Activity settings, section/participant editing, CSV import, group deletion, assignment dialogs |
| Assessment | Grade/answer exports, shared Review and grade, standalone manual review, Class overview overlays, AI batch grading |
| Learner work | MCQ/Parsons submit confirmation, coding submission receipt/full-screen workspace, Safe Exam Browser launcher |
| Other | Account/user/password dialogs, unsaved navigation, activity chat, modal text materials |

Inline panels, page-level Close actions, and Student view's separate browser-window Close action retain their existing presentation.

## Verification

Shared component tests verify icon-only rendering, accessible names, non-submit semantics, callback forwarding, disabled dismissal, distinct localized Close/Cancel actions, informational-alert dismissal, and blocking-progress behavior. Full typechecking and the existing unit suites cover host/plugin integration. Browser layout and scrolling verification remains a separate check; source/markup tests do not establish rendered viewport geometry.
