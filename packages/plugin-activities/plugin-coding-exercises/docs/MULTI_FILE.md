# Programming Exercise files

File workspaces extend the existing `coding-exercise` activity type for both code and blanks. Existing activities without `config.files` retain the single-source execution path and their original data.

## Authoring and learner behavior

The authoring file tabs control the starter code, private reference and private scaffold together. The first file is the entry point, initially named for the language (`main.c`, `main.cpp`, `main.py`, `Main.java`, and equivalent names for other supported runtimes). The right-hand plus opens an inline filename field. Each tab contains a pen to rename in place and, for auxiliary files, a cross to remove the file with confirmation. File IDs remain stable through renaming. Imports/includes remain authored code and must match any renamed file.

Learners edit the teacher-defined files; they cannot add, remove or rename them. File tabs appear only with multiple files and remain in the same workspace in full screen. Switching tabs changes no answer and consumes no run. Monaco registers real filename URIs and unvisited files in the current model group, so TypeScript imports resolve without opening every tab. The practice allowance is shared by the question/attempt across every file and test. File names, IDs and scaffolds are reconstructed from authoritative configuration at execution.

Each file keeps its own editable region and public scaffold projection. Blanks have unique IDs across the project, consecutive labels and the same dimensions and horizontal resize controls as single-file blanks. Blank grading tests the entire project, then isolates values across all files under the existing equal-credit policy and shared teacher-review conflict rule.

Manual reference authoring, test generation and rubric generation use the whole workspace. Automatic solution generation remains single-file; automatic variations do not regenerate file workspaces. Duplicating an exercise retains its independently owned file configuration and references.

## Contracts and persistence

`config.files` contains 1–20 entries `{id,name,starterCode,blankTemplate?,studentTemplateSource}`. `privateConfig.fileSources` maps stable IDs to `{referenceSolution,templateSource,templateVisibleLineNumbers}`. Private blank reference values remain in the existing global map. No private reference/scaffold enters the student config.

Requests and response drafts carry `files` with each file's ID, authoritative name and student source, plus saved public template information. The root `sourceCode` is a labelled inspection snapshot for existing shared contracts; it is never executed as a concatenated project. Names and file membership are validated again on the server. The submitted `sourceFiles` JSON column stores the original structured response independently of capped diagnostic summaries. Preview executes without academic writes.

Apply plugin migration `202611230020_multi_file_sources` through `npm run db:migrate:all`. It adds nullable JSON to the existing plugin execution table; old rows remain untouched. Public templates/drafts and private file data participate in existing generic config and plugin lifecycle copies. Reopening, Test state, exports, inspection, review and released reports retain the structured files. Initial private evaluation snapshots preserve original layouts for current-test regrading; incompatible references defer rather than guess. If a legacy activity is converted to a file workspace after submissions exist, regrading recovers its original private single-file context from retained authoring revisions and first checks that original reference against current tests. Missing/incompatible historical context requires manual review and retains the old grade; no file history is invented or backfilled.

Filenames are bounded flat names, unique ignoring case, with no traversal or shell metacharacters. Build/run wrapper names and output paths are reserved. Source drafts are bounded to 60,000 characters per file and 200,000 across the workspace; assembled archives, including scaffolds, are limited to 4 MiB. Archives contain only generated flat entries, never uploaded archives or symlinks.

## Runner requirement

Judge0's native [multi-file program contract](https://github.com/judge0/judge0/blob/master/docs/api/submissions/submissions.md#single-file-programs-and-multi-file-programs) uses a server-built archive with `compile`/`run` wrappers. Cognelo derives wrappers from the selected runtime's trusted configuration, preserves configured C/C++ libraries and compiles separate translation units. Python modules remain separate files; syntax checks use isolated interpreter startup and `compile` without executing the student's program. Java/Rust/Go entry points and module rules retain their runtime-specific behavior.

The maintained image includes `/usr/bin/unzip`; language configuration idempotently enables the built-in project language (89), which stays out of the programming-language picker. Runner configuration enables `ENABLE_ADDITIONAL_FILES=true` only for Cognelo-built archives. Caller compiler options, command-line options, network access, resource restrictions and API/privileged-worker separation remain unchanged. Existing single-file requests send no archive.

Deployments must rebuild the maintained Judge0 image, apply language configuration, update the archive flag and restart the sandbox services, in addition to the normal database migration. These are runner changes; no production operation is performed by local development tests. Required production upgrade/rehearsal rules still apply.

## Verification and delivery checkpoints

- [x] Add bounded file contracts, stable identities and original-response persistence.
- [x] Build projects inside the existing isolated Judge0 worker; verify separate C units and Python imports locally.
- [x] Add author/learner tabs, inline names and per-file editor state, including full screen.
- [x] Reuse the existing blank policy across files and preserve source in shared submission/review paths.
- [x] Complete nested Test, regrade, review and legacy regression verification.
- [x] Review documentation and deployment commands against the final implementation.

Tests live in `coding-files.test.ts`, `project-runner.test.ts`, `tests/e2e/coding-multiple-files.spec.ts` and `tests/e2e/coding-files-coverage.spec.ts`, alongside the existing code/blanks/regression suites. The latter checks shared run allowances across files and public/personalized tests, rejected file revisions, reopening and stateless teacher preview. `coding-blanks-coverage.spec.ts` checks unanswered compound-Test grading without executing or exposing the private completion.

Docker Desktop’s per-process fallback limits virtual address space, unlike production cgroup accounting. Managed/interpreted runtimes can fail startup under an existing profile even when their project wrappers are correct; compare the single-file control and validate required languages in the isolated deployment profile. Preserve resource isolation rather than weakening limits to make a project pass.
