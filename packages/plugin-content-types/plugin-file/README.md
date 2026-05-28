# Plugin: File Content

`@cognelo/plugin-file-content` owns uploaded file content resources.

It provides picker metadata, upload/download behavior, safe file metadata, and embedding source hints. The first implementation stores safe file metadata in `CourseContentResource.metadata`; object storage and extraction state can move to plugin-owned tables later.
