# Plugin: File Content

`@cognelo/plugin-file-content` owns uploaded file content resources.

It provides picker metadata, upload/download behavior, safe file metadata, embedding source hints, extracted embedding documents for supported files, and vector search handlers. Safe file metadata stays in `CourseContentResource.metadata`; legacy deterministic indexes remain there for older consumers. Prepared semantic indexes use core private storage.

Course content rows pass the stored `mimeType` to the platform icon layer, which selects semantic Tabler icons for PDFs, office documents, spreadsheets, presentations, images, audio, video, archives, code/text, and unknown files.

The file plugin owns file-specific extraction. The prepared service handles source/plain text and text-based PDFs through bounded Poppler extraction. Older extraction handlers retain the basic local PDF compatibility path.

Course content duplication copies the safe file metadata while sharing the immutable stored-file reference. The copied resource drops any derived embedding index so it can be rebuilt under the new resource identity.

Interface actions use the shared [button style and semantic icons](../../../docs/ACTION_BUTTONS.md), including teacher and learner controls.

Uploads validate titles (180 characters) and original filenames (255 characters) before staging, use bounded multipart reads and remove staged files after persistence failures. Download and extraction share the server-owned storage containment check. Basic PDF extraction scans literal strings in linear time, including malformed files. See [security boundaries](../../../docs/SECURITY_BOUNDARIES.md).

The [Coding Homework workflow](../../../docs/CODING_HOMEWORK_SUBMISSION_WORKFLOW.md#initial-material-formats) consumes this plugin’s prepared PDF/text service. Scanned PDFs require OCR before upload; unreadable PDFs fail explicitly.

## Prepared embedding service

This material provides plugin-owned preparation/refresh through core. See [material embedding services](../../../docs/MATERIAL_EMBEDDING_SERVICES.md) for source extraction, reuse, freshness and limits. The prior deterministic index handlers remain a legacy compatibility path; Coding Homework uses the prepared semantic service.
