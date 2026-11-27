# Teacher evaluation flags

Core provides a reusable, staff-only warning sign beside the grade in **Student results**, including when the grade is still `–`. The initial kind is `possible_unauthorized_assistance`. It is a signal for teacher review, not a finding of misconduct, and neither changes grades nor blocks grading or release. It is independent of [required grading reviews](GRADING_REVIEWS.md), whose explicit final-score gates remain unchanged.

## Plugin boundary

An activity opts in through `ServerActivityPlugin.evaluationFlags.activityTypeKeys/getFlags`. Core supplies only its authorized course/section roster and the latest current summative submitted/graded attempt per participant, including ungraded submissions. Started/reopened, deleted, formative and non-submission rows are excluded. Core rechecks section grading permission and reads no plugin tables.

The read-only adapter owns its detection rule and private evidence. Return participant-keyed arrays of `{kind, reasonCode, messages}`, with a stable plugin reason and localized staff text. `EvaluationFlagSchema` allowlists the fields, bounds messages to 2,000 characters and rejects private payloads. Core accepts at most ten flags per row and ignores out-of-roster participants. Do not run AI, code, recovery or academic mutations during flag reads.

Flags are derived from current saved policy and published evidence rather than a new core persistence table. Plugins must exclude staged/cancelled/deleted or foreign evidence and retain immutable assessment artifacts/audits in their existing storage. Teacher edits and settings changes can update the flag on the next authorized read. Do not put flags, private thresholds or suspicion text in student feedback, learner Grades, exports or configuration.

## Core presentation

The web host renders `EvaluationFlags` next to the score, independently of grade completion and even before a numeric grade exists. The amber alert icon uses the shared tooltip mechanics for hover, keyboard focus, Escape, outside dismissal and touch pinning. Its localized label identifies possible unauthorized assistance; the detail provides the plugin reason and explains that the signal requires human review. Other plugins reuse this core display and contract without importing another plugin.

## Programming Homework

Homework contributes an opt-in Grading setting: threshold from 0 to 100%, and either the equally weighted mean of all question rubric scores or any single question below the threshold. Equality does not trigger a flag; unscored answers remain pending, while a submitted blank explicitly assessed as zero counts. The threshold applies before the question component's activity weighting, including when questions contribute zero points. The code rubric does not determine the flag.

**Assess challenge answers with AI** is a separate teacher-triggered, section-scoped action. It evaluates submitted answers, updates their rubric scores and reuses the [durable AI grading run](AI_GRADING_RUNS.md) for progress, cancellation and Keep/Discard publication. Existing code assessments and explicit final-grade overrides are retained. A missing weighted code assessment remains pending. Published answer feedback may be retained without creating a grade, allowing a flag beside `–`. Ordinary full-rubric assessment and manual answer-score edits also feed the same rule. See [Homework grading](../packages/plugin-activities/plugin-coding-homework-grader/docs/GRADING.md).

No migration or environment variable is required. Threshold settings, assessment evidence and run action IDs use existing JSON storage. Unit tests cover neutral core projection, roster/privacy/lifecycle checks, strict threshold behavior and component/override publication. Local browser checks cover Grading Save/reload, class-wide answer assessment, graded/ungraded icons, keyboard/touch details and learner exclusion.
