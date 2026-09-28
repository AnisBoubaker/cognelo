# Plugin: Parsons

`@cognelo/plugin-parsons` provides the `parsons-problem` activity type. Teachers define a prompt, reference solution, line groups, indentation behavior, and precedence rules. Learners reconstruct the program with keyboard- and pointer-accessible controls.

## Read By Topic

- [Authoring config, persistence, and routes](docs/REFERENCE.md#persistence)
- [Generation and grading behavior](docs/REFERENCE.md#routes)
- [Learner and authoring UX](docs/REFERENCE.md#ux-notes)
- [Detailed decisions](docs/DECISIONS.md)

## Boundaries

- Authored Parsons data is generic activity config, so core owns bank copying, synchronization, and version comparison.
- Reusable bank Tests copy Parsons children into Test-owned bank activities and later into independent course children; learner attempt/event rows are never copied.
- Student state and event history use plugin-owned `PluginParsonsAttempt` and `PluginParsonsAttemptEvent` tables.
- Teacher/admin previews are ephemeral and must not pollute learner research data.
- Formative checks and summative submissions create mode-tagged core attempts linked to the richer plugin attempt. Only summative attempts are graded, suppress correctness until release, and support teacher regrades; formative checks remain read-only teacher evidence.
- The released deterministic or teacher-overridden grade is challengeable through the core workflow and returns to the existing Parsons **Review and grade** surface.

When behavior changes, update this overview, `PROJECT_MEMORY.md` only if an invariant changed, and the relevant detailed section.
