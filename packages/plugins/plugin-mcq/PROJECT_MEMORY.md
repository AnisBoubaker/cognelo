This file is for MCQ plugin memory only.

- MCQ is intentionally text-first: the main authoring surface is a code-like editor, not a click-heavy form builder.
- The source format is a Markdown-inspired grammar with `##` question headings and task-list style choice markers.
- The plugin currently infers single-choice versus multiple-choice from the number of correct answers in each question.
- The first version stores only authored MCQ content in the generic activity config; student submissions are not yet persisted.
