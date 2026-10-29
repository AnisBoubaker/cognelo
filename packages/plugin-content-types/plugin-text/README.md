# Plugin: Text Content

`@cognelo/plugin-text-content` owns Markdown course materials. Its dedicated authoring page uses the full shared visual/Markdown editor, including image uploads, tables, formulas, and fullscreen editing. Settings control visibility and inline, separate-page, or modal student display. Saving those options never resends or replaces the stored Markdown.

The plugin stores Markdown and presentation preferences in generic resource metadata, declares its media-bearing fields, and provides embedding document/index/search handlers. Duplication retains the body and display settings but drops the derived search index.

See [Text material reference](docs/REFERENCE.md) for routes, defaults, image lifecycle, and validation.

Interface actions use the shared [button style and semantic icons](../../../docs/ACTION_BUTTONS.md), including teacher and learner controls.

Raw attributed HTML is displayed literally; ordinary Markdown, attribute-free formatting, images, and bounded untrusted math remain supported through the shared renderer. See [student display](docs/REFERENCE.md#student-display).

Modal readers and full-screen editors use the shared [persistent close cross](../../../docs/DIALOGS.md).
