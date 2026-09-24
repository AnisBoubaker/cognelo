# Web Design Coding Exercises Memory

Read [docs/DECISIONS.md](docs/DECISIONS.md) only for the area being changed.

- Keep this plugin separate from Programming Exercises: browser preview and Playwright grading have different trust and runtime boundaries from Judge0.
- Student starter files are public config; solution files, tests, screenshots, and grading artifacts are private plugin data.
- The learner browser may run only its own bundle in a sandboxed iframe. Graded execution goes through Cognelo to the external Playwright runner.
- Saving enabled tests is reference-validation dependent and atomic; failed validation leaves prior tests unchanged.
- Expected-result prompt tokens expose only generated PNG artifacts, never solution source.
- Standalone drafts use `ActivityResponseDraft`; embedded Test drafts use `TestItemAttempt`.
- Every private bank-owned table must participate in copy, sync, duplication, and deletion hooks, including when a reusable bank Test owns the activity as a hidden child.
- The runner remains secret-free and requires production hardening, isolation, and smoke coverage for screenshot cropping.
