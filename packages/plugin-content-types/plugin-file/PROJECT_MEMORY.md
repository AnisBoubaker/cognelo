# File Content Plugin Memory

- Plugin key: `file-content`.
- Content type key: `file`.
- Uploaded bytes are stored under `storage/course-content-files/:courseId`.
- Safe file metadata lives in `CourseContentResource.metadata`: `originalName`, `storedName`, `mimeType`, `size`, and `setupStatus`.
- Course and group content rows derive uploaded-file icons from the stored MIME type through the platform's centralized Tabler icon layer; missing or generic binary MIME types use the neutral file icon.
- The server plugin implements `getEmbeddingDocuments` and owns file-specific extraction. It currently supports text/source-like files and a basic local PDF text extractor, returning diagnostics instead of throwing for unsupported file types.
- The server plugin implements `indexEmbeddingDocuments` and `searchEmbeddingDocuments`. The current dev index is stored in resource metadata under `embeddingIndex`; future pgvector/plugin-owned table storage should stay behind those handlers.
- No plugin-owned table is used yet; future extraction/indexing state should add plugin-owned persistence.
- The server `duplicate` handler copies safe metadata and shares the immutable `storedName` file reference, but removes `embeddingIndex`. A future mutable/object-storage backend must replace this with explicit reference counting or physical copy semantics.
