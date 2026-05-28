# File Content Plugin Memory

- Plugin key: `file-content`.
- Content type key: `file`.
- Uploaded bytes are stored under `storage/course-content-files/:courseId`.
- Safe file metadata lives in `CourseContentResource.metadata`: `originalName`, `storedName`, `mimeType`, `size`, and `setupStatus`.
- No plugin-owned table is used yet; future extraction/indexing state should add plugin-owned persistence.
