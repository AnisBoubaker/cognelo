# Web Design Coding Exercises Memory

Read [docs/DECISIONS.md](docs/DECISIONS.md) only for the area being changed.

- Keep this plugin separate from Programming Exercises: browser preview and Playwright grading have different trust and runtime boundaries from Judge0.
- Student starter files are public config; solution files, tests, screenshots, and grading artifacts are private plugin data.
- The learner browser may run only its own bundle in a sandboxed iframe. Graded execution goes through Cognelo to the external Playwright runner. Browser modal APIs are allowed only inside that learner-authored preview; Cognelo teacher UI uses the platform shared dialog provider.
- The endpoint and optional authentication token are admin-managed core runner settings, not plugin environment variables. Resolve them through core so later round-robin pooling remains a platform concern.
- Saving enabled tests is reference-validation dependent and atomic; failed validation leaves prior tests unchanged.
- Expected-result prompt tokens expose only generated PNG artifacts, never solution source.
- Standalone drafts use `ActivityResponseDraft`; embedded Test drafts use `TestItemAttempt`.
- The definition declares `studentView: { mode: "interactive", execution: "plugin" }`. Teacher Student view stores files in the browser and invokes Playwright without creating plugin submission/test-result rows, core attempts, grades, or analytics.
- Every standalone submission creates a core attempt tagged with its assessment mode. The shared gradebook review page may inspect all submitted file bundles, but applies a core manual-grade override only to summative work; automatic regrading remains hidden until this plugin implements a current-answer grading handler.
- Released final grades are challengeable through core only when the effective summative assignment setting permits it; challenge review must reuse that same file-aware gradebook surface and audited override path.
- Teacher review routes consume core course capabilities: explicit course teachers/admins work course-wide, while section teachers/TAs are restricted to their assigned groups. Test mutation, authoring, and grade release remain course-management operations.
- Every private bank-owned table must participate in copy, sync, duplication, and deletion hooks, including when a reusable bank Test owns the activity as a hidden child.
- Bank variation starts from that independent copy, preserves exact concept, skill, and misconception selections, then regenerates prompt, starter/reference code, and every Playwright test while preserving file paths and test grading structure. Saving must still validate enabled tests and regenerate any requested expected-result screenshot through the runner.
- The runner remains free of Cognelo application/database secrets and requires production hardening, isolation, and smoke coverage for screenshot cropping. An optional runner-specific request token may be stored encrypted by the application registry.
