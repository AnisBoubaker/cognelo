# Plugin: File Content

`@cognelo/plugin-file-content` owns uploaded file content resources.

It provides picker metadata, upload/download behavior, safe file metadata, embedding source hints, extracted embedding documents for supported files, and vector search handlers. The first implementation stores safe file metadata and a deterministic development vector index in `CourseContentResource.metadata`; object storage and production vector state can move to plugin-owned tables later.

The file plugin owns file-specific extraction. It currently exposes source-like/plain text files and basic local PDF text extraction through the shared content type server extraction interface.
