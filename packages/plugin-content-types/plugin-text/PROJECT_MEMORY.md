# Text Content Plugin Memory

- Plugin key `text-content`; content type key `text`. No plugin-owned table.
- Persist authored Markdown in `metadata.body` with `format: "markdown"`. The dedicated editor reuses shared `RichTextEditor`; student views use sanitized `MarkdownRenderer`.
- The settings-only form forwards only `displayMode` and `openInNewTab` to the host, with visibility handled separately. Never resend stored body/derived metadata: imported notes may exceed authoring limits, and another editor may have saved newer text. The dedicated text editor still owns its full draft.
- Missing `displayMode` means `inline`. `page` and `modal` are alternatives. `openInNewTab` defaults to false and only affects page mode. The modal is 80vw wide.
- Declare `markdownFields: ["body"]`; core transactionally retains uploaded images on resource saves/copies. Never bypass media ownership and section visibility checks.
- Embedding extraction uses only the Markdown body. The deterministic development vector index remains `metadata.embeddingIndex`; duplication removes it for independent rebuilding.
- Editor and reader navigation reuse the activity header action layout and shared “Back to course” translation; do not introduce local wording or alignment.
- Keep host integration generic through renderer, editor, settings, and presentation registry keys. See [reference](docs/REFERENCE.md) and [media lifecycle](../../../docs/MEDIA_ASSETS.md).

- Reuse `ActionIcon` from `@cognelo/activity-ui` and the shared [action-button rules](../../../docs/ACTION_BUTTONS.md); keep localized labels and action semantics, without plugin-local SVG/emoji substitutes.
