# Plugin: File Content

`@cognelo/plugin-file-content` owns uploaded file content resources.

It provides picker metadata, upload/download behavior, safe file metadata, embedding source hints, extracted embedding documents for supported files, and vector search handlers. The first implementation stores safe file metadata and a deterministic development vector index in `CourseContentResource.metadata`; object storage and production vector state can move to plugin-owned tables later.

Course content rows pass the stored `mimeType` to the platform icon layer, which selects semantic Tabler icons for PDFs, office documents, spreadsheets, presentations, images, audio, video, archives, code/text, and unknown files.

The file plugin owns file-specific extraction. It currently exposes source-like/plain text files and basic local PDF text extraction through the shared content type server extraction interface.

Course content duplication copies the safe file metadata while sharing the immutable stored-file reference. The copied resource drops any derived embedding index so it can be rebuilt under the new resource identity.
