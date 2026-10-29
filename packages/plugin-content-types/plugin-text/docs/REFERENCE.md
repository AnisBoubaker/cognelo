# Text materials

## Authoring and settings

Choosing Text in the Material picker creates a shell in the selected folder, preserving the selected visibility, and navigates to `/courses/:courseId/materials/:resourceId/edit`. The course row title and Edit action reopen that page. The teacher edits a required title (maximum 180 characters) and Markdown body (maximum 20,000 characters) with the shared visual/Markdown editor. Image uploads, alt text and sizing, tables, formulas, source editing, fullscreen, and resizing come from that editor.

The editor uses the shared save/cancel bar, unsaved-navigation guard, and success notifications. Save persists title, body, display preferences, visibility, and media references transactionally; the content-tree title snapshot follows the resource title. The right-aligned **Back to course** control returns to the course tree, reusing the activity modules’ `activity-editor-context` layout and shared `groupPage.backToCourse` translation. Display and visibility controls are also available in the existing course-content Settings dialog; editing the text itself stays on the dedicated page. The settings-only form forwards only `displayMode` and `openInNewTab`, with visibility saved separately by the host. It must not copy stored Markdown, format, or derived metadata into the update payload. Imported/seeded notes can exceed the authoring body limit; presentation changes preserve that existing text without revalidating or truncating it. Concurrent content edits remain intact because the server merges the presentation patch into its current resource metadata.

## Student display

| Metadata | Default | Behavior |
| --- | --- | --- |
| `body` | empty string | Authored Markdown, rendered with the shared sanitized renderer. |
| `format` | `markdown` | Stored format. |
| `displayMode` | `inline` | `inline`: directly below the title in the course tree. `page`: title opens the reader page. `modal`: title opens a native accessible dialog. |
| `openInNewTab` | `false` | Only page mode uses this flag; enabled adds `_blank` with `noopener noreferrer`. |

Older materials without presentation metadata display inline. Page readers use `/courses/:courseId/materials/:resourceId?groupId=:groupId`, with the same right-aligned **Back to course** control as activity pages. Teacher previews preserve the student-view return path through `preview=1`. The modal is exactly 80% of viewport width, scrolls within 85dvh, supports Escape/backdrop/Close, traps and restores keyboard focus, and uses the shared body-scroll lock.

Course-wide reader API requests require course management. Section reader requests verify membership, publication/availability, content visibility (including folder ancestry and section overrides), and plugin activation. A direct URL therefore does not bypass visibility. Student mutation requests remain forbidden.

The shared renderer permits only a fixed set of attribute-free raw HTML formatting tags. Raw styles, forms, IDs/classes, and attributed HTML are shown as text, preventing course material from changing the surrounding interface. Ordinary Markdown links/images/tables and untrusted, size/expansion-bounded KaTeX remain supported. Stored text is preserved; migrate any old attributed HTML to ordinary Markdown when editing it.

## Media and duplication

The definition declares `markdownFields: ["body"]`. Core reconciles the resulting `MediaAssetReference.contentResourceId` references in the save transaction, activates staged uploads, and preserves references on duplication without copying image bytes. Student image delivery requires an accessible section where that resource is visible and its plugin is active. Deleting an original does not remove a duplicate's image references. Final-reference cleanup uses the shared media retention policy.

Apply the core migration `202610200002_content_resource_media` through `npm run db:migrate:all` and restart running servers after regenerating Prisma clients. No plugin table migration is needed. See [media lifecycle](../../../../docs/MEDIA_ASSETS.md).

Duplication copies Markdown and display preferences, excluding `embeddingIndex`. Embedding extraction/index/search continues behind plugin handlers and uses only the body, independently of display mode.

## Verification

- Plugin tests cover legacy defaults, page targets, schema bounds, partial settings updates, and independent duplication.
- Core media tests cover reference ownership and section/resource visibility during image delivery.
- `tests/e2e/text-content.spec.ts` covers dedicated editing, actual image uploads and retention, tables/formulas, inline/page/modal display, new-tab behavior, focus/scroll restoration, section visibility, student permissions, and duplicate image retention, plus presentation updates on long imported notes without resending text or overwriting concurrent content edits.
- Existing content-resource E2E coverage also checks inherited folder visibility, duplication, file and GitHub materials, and saved ordering.

## Shared action controls

Teacher, learner, and settings actions follow the platform [button and icon contract](../../../../docs/ACTION_BUTTONS.md). Use explicit semantic `ActionIcon` names with localized labels; dimensions and interaction colors are shared CSS, while tabs, disclosure rows, and specialized editor controls retain their own layout.

## Dialog presentation

The host modal reader uses a sticky heading with an icon-only close cross and localized accessible name. Its body remains scrollable within the existing 80vw panel. The shared full-screen editor uses a top cross to exit without losing its mounted draft. See [dialog headers](../../../../docs/DIALOGS.md).
