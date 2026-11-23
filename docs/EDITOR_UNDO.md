# Code editor undo and saved answers

Saved answers establish the editor's initial state. Loading or restoring an answer must not become an undoable insertion of the whole document. User typing, undo, and redo still use Monaco's native edit history and the ordinary answer autosave path.

## Lifetime and isolation

- History is held only in browser memory. No undo operations, snapshots, or editor models are written to the database, local storage, session storage, or IndexedDB.
- While a Test stays open, `MonacoModelScope` owns the models for its current attempt/view. `MonacoModelGroup` separates questions, including Web Design questions whose file IDs are identical. Each file/editor has its own document identity.
- Switching questions or files retains their respective undo/redo stacks and cursor/scroll state. Detaching an editor closes the current native undo group without deleting earlier history or redo entries.
- Leaving the Test, reloading, signing out, closing activity access, changing attempts, or changing between current answering and previous-submission views disposes that scope. Reopening starts with the saved answer and empty history; edits made afterward can be undone normally back to that baseline.
- Editors outside a Test normally own their models locally. Programming Exercises own one scope for their mounted workspace so file changes retain independent Monaco history. `MonacoModelScope inherit` reuses an existing Test scope/group instead of replacing it, and creates a scope only when none exists. Standalone programming submission resets the editor identity before another answer can be entered. Models and view state are not held in a global activity-ID cache.

Programming Exercise project editors register every file under its actual filename in a dedicated model group, including files not yet visited. Their language workers receive those models for relative-import resolution. Registration restores text without autosaving; obsolete filenames are removed from the group.

Each owner uses a fresh random URI namespace. Question and document identifiers are encoded without path aliasing. This also prevents Monaco's internal URI-based model recovery from finding a prior session's undo stack. Scope disposal waits until child editors detach and tolerates React Strict Mode's immediate effect reactivation.

Ungrouped editors omit the optional group path segment so their URI path has no doubled separator. TypeScript normalizes repeated separators before requesting a source snapshot, while Monaco looks up the exact model URI. Keeping those identities identical prevents missing-source-file rejections for JavaScript, including empty files.

## Synchronization and autosave

The shared `MonacoCodeEditor` uses `defaultValue`, not `@monaco-editor/react`'s controlled `value` update path. That wrapper turns later writable-value changes into full-document `executeEdits` operations, which was the source of the whole-answer undo bug.

The shared component explicitly synchronizes genuinely external text with `model.setValue`, establishing a new baseline while suppressing its synthetic change notification. It compares equivalent line endings so ordinary controlled-value echoes and platform EOL normalization never erase typing or redo history. Real model edit events still call the owning plugin's `onChange` and autosave code. Template boundaries remain protected.

Programming and Web Design editors wait for successful draft restoration before mounting an editable model. A failed load leaves the editor unavailable with Retry; it must not activate a blank/starter answer and autosave over existing work. Standalone draft reads join the serialized save queue; Test-item loads also wait for pending saves. Web Design's restored file snapshot is marked as already saved, so hydration alone does not generate an answer write.

Only answer state crosses the existing persistence boundary (`sourceCode`, `files`, or code-blank values plus their public template/source snapshot). Code-blank fields use native text-input undo within their mounted field; their history is not persisted or shared across fields. Student view may also retain its simulated practice-run count in browser-scoped preview state; real learner allowances come from server execution reservations, never from answer drafts. Read-only submission views do not write drafts. Core attempt availability keeps an already-started Test reachable when the learner returns from history, even if that Test is using its last permitted attempt; this does not create or grant an extra attempt.

Code-blank authoring uses one Monaco document per file containing its complete private reference code. Annotation histories are owned by the mounted workspace, survive file switches, and are released on departure. Its annotation snapshots follow native text undo/redo in mounted-session memory only (up to 1,000 model versions). Marking or unmarking changes metadata without editing the source. Authoring saves retain only the ordinary public markers and private reference values, never undo history.

## Verification

`tests/e2e/editor-undo.spec.ts` exercises actual Monaco keyboard undo/redo and persisted answer values: delayed hydration, fresh baseline editing after reload/reopen, question and file separation, duplicate file IDs in different questions, delayed/failed autosaves, failed restoration/retry, prior submissions, later attempts, same-tab account changes, and protected templates. It also checks that writes contain answer state only and that code/history is absent from browser storage.

Unit checks cover model ownership, canonical paths without empty group segments, unique URI namespaces, disposal/Strict Mode reactivation, queued restoration after autosaves, and continuing an active last Test attempt. The Monaco worker browser regression queries diagnostics for actual empty JavaScript solution/starter models across file and authoring-panel switches, then checks navigation without unhandled errors. Existing Monaco-worker, code-template, and submission-history regressions remain applicable.
