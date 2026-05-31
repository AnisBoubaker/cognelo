# File Content Plugin Memory

- Plugin key: `file-content`.
- Content type key: `file`.
- Uploaded bytes are stored under `storage/course-content-files/:courseId`.
- Safe file metadata lives in `CourseContentResource.metadata`: `originalName`, `storedName`, `mimeType`, `size`, and `setupStatus`.
- The server plugin implements `getEmbeddingDocuments` and owns file-specific extraction. It currently supports text/source-like files and a basic local PDF text extractor, returning diagnostics instead of throwing for unsupported file types.
- The server plugin implements `indexEmbeddingDocuments` and `searchEmbeddingDocuments`. The current dev index is stored in resource metadata under `embeddingIndex`; future pgvector/plugin-owned table storage should stay behind those handlers.
- No plugin-owned table is used yet; future extraction/indexing state should add plugin-owned persistence.
