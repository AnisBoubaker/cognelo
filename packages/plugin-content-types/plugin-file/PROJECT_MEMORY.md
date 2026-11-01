# File Content Plugin Memory

- Plugin key: `file-content`.
- Content type key: `file`.
- Uploaded bytes are stored under `storage/course-content-files/:courseId`.
- Safe file metadata lives in `CourseContentResource.metadata`: `originalName`, `storedName`, `mimeType`, `size`, and `setupStatus`.
- Course and group content rows derive uploaded-file icons from the stored MIME type through the platform's centralized Tabler icon layer; missing or generic binary MIME types use the neutral file icon.
- The server plugin implements `getEmbeddingDocuments` and owns file-specific extraction. It currently supports text/source-like files and a basic local PDF text extractor, returning diagnostics instead of throwing for unsupported file types.
- The server plugin implements `indexEmbeddingDocuments` and `searchEmbeddingDocuments`. The legacy dev index remains under `embeddingIndex`; prepared semantic consumers use `indexing.prepare` and private core storage.
- No plugin-owned table is used; source metadata stays on the generic resource and prepared indexes use private core storage.
- The server `duplicate` handler copies safe metadata and shares the immutable `storedName` file reference, but removes `embeddingIndex`. A future mutable/object-storage backend must replace this with explicit reference counting or physical copy semantics.

- Reuse `ActionIcon` from `@cognelo/activity-ui` and the shared [action-button rules](../../../docs/ACTION_BUTTONS.md); keep localized labels and action semantics, without plugin-local SVG/emoji substitutes.

- Use bounded form parsing and the shared no-follow storage opener for downloads and extraction. Never trust a metadata path or restore the backtracking PDF literal regex; malformed and whitespace-heavy input must remain linear.

- Validate multipart title and original filename through the existing shared/plugin schemas before writing bytes. A failed metadata validation must leave neither a staged file nor a changed resource.

- The prepared service extracts text-based PDFs with bounded Poppler execution and indexes reusable semantic vectors through core. Reject unreadable/empty PDFs; OCR is not implemented.


- Own `indexing.policy` and `indexing.prepare`; core supplies authorized embedding storage and search. Never call a sibling plugin. Prepared semantic indexes remain outside public resource metadata. See [service contract](../../../docs/MATERIAL_EMBEDDING_SERVICES.md).
