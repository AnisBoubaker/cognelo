# Student solutions

The optional [activity content closure rule](ACTIVITY_CONTENT_ACCESS.md) takes precedence over solution and grade release. A closed student cannot request or display solutions, including a compound Test's children.

Course content → activity Settings → General includes **Release solution** for MCQ, Parsons, Programming Exercises, Web Design, and compound Tests. It defaults to false for existing and new activities. Programming Homework and unsupported types do not offer the switch or learner tab. This is a course-activity setting shared by every section, like messaging; it is not a section/team/student override. An older settings client that omits the field preserves its existing value. Activity duplication removes assignment policy, so a new copy starts with solutions disabled.

For formative and formative-with-AI assignments, enabling the switch makes the **Solution** tab available without requiring an attempt or submission. The tab first encourages independent work and offers **Show solution**. Opening the tab does not request the solution; the explicit button loads it. Switching tabs keeps the answering renderer mounted so drafts, Test state, timers, and autosaves survive. Returning to the solution tab requires another explicit reveal.

Summative assignments require both **Release solution** and the section gradebook item's **released grades**. Submitting, running out of attempts, or reaching Until does not release a solution. Disabling either switch removes the tab/content on the ordinary 20-second or focus refresh and blocks subsequent reveal requests immediately. Already-read content cannot be recalled from a learner. The Grades feed now returns only final released rows, including repeatable assignments; provisional results must not bypass release.

## Formats and feedback

- MCQ: the authored questions and choices, with checked choices identifying correct answers. The ordinary learner answer review no longer highlights missed correct choices. Formative checks still report scores and correctness of selected answers; summative answer feedback remains grade-release-gated. Teacher grading review retains the full key.
- Parsons: the teacher's ordered, indented reference program. Ordinary formative checks retain order/indentation feedback.
- Programming Exercises: only the private reference source and programming language. Hidden tests, templates, rubric instructions, validation summaries, and model artifacts are excluded.
- Web Design: the reference HTML/CSS/JavaScript files, identified by path. Tests and private validation/screenshot metadata are excluded. An expected-result image explicitly included in the prompt remains visible independently of solution release.

The solution uses the current saved course activity/reference, not a snapshot of a student's submission. Solutions are separate from grade reports and from optional teacher/AI feedback; manually authored instructional text can itself contain an answer. MCQ and Parsons retain their existing generic authored-config model; this feature controls their dedicated solution display, rather than migrating their public execution configuration to private storage.

## Compound Tests

One switch on the parent Test controls every supported exercise. The parent section grade release is the only release gate. The Solution tab lists current, non-removed children in authored order; each child uses its owning plugin's solution provider. It does not enable standalone child URLs or reveal hidden grading tests. Missing reference solutions are omitted, and an entirely empty result displays a localized message. Programming Homework remains unsupported as a solution provider.

## Boundaries

`ActivityDefinition.supportsSolution` opts a type into settings. `ServerActivityPlugin.studentSolution` declares type keys and a `getSolution` handler returning only `ActivitySolutionContent` Markdown/code blocks. Core never queries plugin tables. The four plugins project their own authored/reference content; the shared web panel renders sanitized Markdown and the existing non-translatable code component.

`GET /api/courses/:courseId/groups/:groupId/activities/assigned/:activityId/solution` returns availability only. `POST` rechecks actual student enrollment, ordinary assignment visibility/access, SEB, plugin availability, the current setting, and summative grade release before resolving content. Unsupported types, missing handlers, missing gradebook items, unreleased grades, and disabled settings fail closed. API responses use `no-store`. No attempt or grade is created by revealing a solution.

The switch is stored in `Activity.metadata.allGroupsAssignment.releaseSolution`; no database migration is needed. It shares the settings save/cancel and active-student confirmation workflow. New private reference retrieval is confined to the authorized reveal request, while ordinary coding/Web Design configuration and grading reports continue to exclude reference source.

## Verification

- `activity-solutions.test.ts`: default-off, both formative modes, the summative two-switch gate, revocation, missing enrollment/gradebook, unsupported types, and parent-Test scope.
- `gradebook.test.ts`: repeatable summative activities cannot expose provisional grades or feedback.
- `tests/e2e/activity-solutions.spec.ts`: real settings persistence, learner tabs, explicit reveal, preserved answers, live revoke/re-hide, legacy omission, four plugin formats, and direct child-access denial.
