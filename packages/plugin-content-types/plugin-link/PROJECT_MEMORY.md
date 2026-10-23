# Link Content Plugin Memory

- Plugin key: `link-content`; content type key: `link`.
- Link text is the resource title. Metadata owns `url`, `description`, and `openInNewTab`; the latter defaults to true and must preserve an explicit false.
- Accept only absolute HTTP(S) URLs without embedded credentials. Preserve query strings and fragments. Ordinary opening is a browser action. Only explicit AI summarization fetches the page server-side, with public-IP validation, pinned DNS, validated redirects, size/time limits, and a strict final HTTP 200 gate before AI.
- New picker shells may lack a URL and resolve to no action until configured. The settings form requires a URL; explicitly blank or unsafe URLs are rejected by server updates.
- Row presentation and server open actions use the same validated metadata projection. Descriptions are plain text, rendered by the host as text rather than HTML.
- Internal summaries, maximum-word preferences, and the follow-same-domain flag are private plugin-table data, never public resource metadata or embedding documents. Authenticated course managers load them through the plugin summary route. Create/update/duplicate use the generic `afterPersist` hook inside the host transaction; the foreign key removes private settings on resource deletion.
- Duplicate copies public fields and private settings independently; it never copies derived embedding indexes.
- AI generation is explicit, defaults to 100 words (1–2,000), uses the course Subject’s teaching language regardless of UI/page language, and fills an unsaved editable draft. Enforce the maximum locally with locale-aware word segmentation, without a second model request. Manual edits may exceed the AI limit.
- Following links defaults off. Use the final root hostname, resolve relative/base URLs, remove fragments, deduplicate, and fetch only the root’s direct links. Every child redirect stays on that hostname and passes the existing public-address/HTTP-200 gate. Bound traversal and aggregate text, retain successful pages, and report omissions. See the reference for limits.
- Never weaken the public-address guard for tests. Mock the AI response for UI tests and test the HTTP gate, DNS pinning, redirects, and no-AI-on-failure behavior in server tests.
- The private table has an idempotent content-plugin manifest migration. Existing activated installations must run the combined migration command; fresh activation is not an upgrade migration substitute.
- Host pages dispatch through the presentation/settings registries. Do not introduce concrete link-type branches into course pages or core.

- Reuse `ActionIcon` from `@cognelo/activity-ui` and the shared [action-button rules](../../../docs/ACTION_BUTTONS.md); keep localized labels and action semantics, without plugin-local SVG/emoji substitutes.
