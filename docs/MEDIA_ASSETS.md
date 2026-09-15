# Rich-text media assets

Cognelo stores images inserted through the shared Markdown editor in local, content-addressed storage. The design deliberately derives liveness from database references instead of maintaining a mutable numeric reference counter.

## Logical assets and physical blobs

Each upload creates one logical `MediaAsset`, while `MediaBlob` owns the immutable physical bytes. A SHA-256 digest deduplicates identical files, so copying an activity, publishing a version, or using the same upload in several fields adds references but does not copy the bytes.

The default root is `storage/media`; `MEDIA_STORAGE_ROOT` may override it. A relative override is resolved from the repository root. Blob paths are sharded by digest:

```text
storage/media/
  blobs/sha256/ab/cd/abcdef...<64 hexadecimal characters>
  staging/YYYY-MM-DD/<uuid>.part
  trash/YYYY-MM-DD/<digest>-<uuid>
```

No user-supplied filename becomes a disk path. Uploads are written to a date-sharded staging path and atomically hard-linked into the digest path. PNG, JPEG, GIF, and WebP are accepted after magic-byte inspection; SVG and files larger than 10 MiB are rejected. The original filename is retained only as metadata.

## Lifecycle and references

New uploads are `staged` for 24 hours and are visible only to their creator or an administrator. Saving supported authored content transactionally creates `MediaAssetReference` rows and activates the logical asset. References have real foreign keys and point to exactly one owner:

- `Subject`;
- mutable `BankActivity`;
- immutable `ActivityVersion`;
- course-local `Activity`;
- immutable `TestRevision`; or
- immutable `TestRevisionItem`.

References are field-keyed and currently reconcile Markdown in descriptions plus activity configuration. Copy and synchronization operations create new logical references to the existing asset. Test attempts preserve references from their immutable revision snapshots. Deleting or replacing one occurrence therefore cannot remove bytes that another bank version, course copy, or attempt still needs.

The canonical stored Markdown URL is `/api/media-assets/<asset-id>/content`. Optional display sizing stays inside standard Markdown image syntax by appending a URI fragment: `#cognelo-size=px:320`, `#cognelo-size=original:50:1280`, or `#cognelo-size=container:60`. The original-percentage form stores the intrinsic pixel width as its final number so the renderer can reproduce the requested scale without loading a second copy or depending on container size. URI fragments are never sent to the media API. The shared renderer validates the numeric bounds, converts recognized fragments into width-only sizing, and always derives height automatically to preserve the image's aspect ratio; unknown or malformed fragments receive normal unsized rendering.

The API serves the underlying asset only to an authorized authenticated user. Students must still pass the normal assignment publication and content-visibility checks; teachers and course managers use the corresponding subject, bank, or course permissions. The web development server proxies this API path so the stored URL remains environment-independent.

## Garbage collection

Removing the final reference only records `unreferencedAt`. It does not delete data during an authoring request. Administrators can inspect the same dry-run counts and retention policy at **Settings → Maintenance → Media**, then use the confirmed **Run cleanup** action. The API rechecks the admin role in core for both inspection and cleanup.

The command-line equivalent starts with a dry inspection:

```bash
npm run media:gc
```

After reviewing the counts, apply it with:

```bash
npm run media:gc:delete
```

The destructive pass:

1. marks active database orphans as newly unreferenced;
2. deletes expired staged uploads;
3. deletes active logical assets only after 30 unreferenced days;
4. deletes a blob row only when no logical assets remain;
5. moves its bytes to a date-sharded trash directory; and
6. purges trash older than seven days and crash-left staging directories older than two days.

The grace period starts on the first destructive pass for references removed by cascading owner deletion. This prevents a missed reconciliation callback from turning a cascade into immediate data loss. `--grace-days=N` can increase or decrease the active-asset grace period for a reviewed manual run; it must be a positive integer.

Database and storage backups form one recovery unit. Back up PostgreSQL and the instance's complete persistent `storage` directory, and test restoring both together. Do not back up only `MediaBlob` rows or only `storage/media` bytes.

## Operational invariants

- Do not edit or rename blob files in place. A different byte sequence is a new upload.
- Do not embed raw filesystem paths or environment hostnames in Markdown.
- Do not delete a blob based on a hand-maintained counter; query logical assets and durable references.
- Do not expose `storage/media` as an unauthenticated Apache static directory.
- Run garbage collection under the same instance service account and against the same `.env` and persistent storage root as the API.
- Keep the logical URL and blob abstraction if storage later moves to an object store.
