# Plugin: Text Content

`@cognelo/plugin-text-content` owns simple text/Markdown course content.

It provides picker metadata, text settings UI, body validation, embedding source hints, extracted embedding documents, and vector search handlers. The first implementation stores the Markdown body and deterministic development vector index in generic `CourseContentResource.metadata`; production indexing can move behind the same plugin handlers.
