This file is for MCQ plugin memory only.

- MCQ is intentionally text-first: the main authoring surface is a code-like editor, not a click-heavy form builder.
- The source format is a Markdown-inspired grammar with `##` question headings and task-list style choice markers.
- Choices may contain Markdown blocks, including fenced code blocks for code alternatives. Code-only choices can use a bare `- [ ]` or `- [x]` marker followed by a fenced code block.
- MCQ config supports `randomizeChoices`; rendering shuffles displayed choices while preserving choice IDs for scoring.
- The MCQ authoring form registers with the shared unsaved-change guard so navigating away can save, discard, or continue editing. Future MCQ authoring options/settings must keep using `useUnsavedChangesGuard` rather than adding plugin-local navigation prompts.
- The plugin currently infers single-choice versus multiple-choice from the number of correct answers in each question.
- The first version stores only authored MCQ content in the generic activity config; student submissions are not yet persisted.
- Since there is no private plugin-owned authoring data yet, bank-to-course copying relies only on the platform's generic config copy.
- The MCQ authoring view is available from activity bank activity editing pages as well as course activity management pages.
- AI-assisted MCQ source generation is available only when the teacher has selected an enabled question-authoring AI agent in `/settings/ai-agents`.
- AI-assisted generation asks for confirmation before replacing a non-empty MCQ source field.
- MCQ generation runs through a plugin server route so API keys stay server-side. The prompt includes syntax rules, current locale, subject context, the teacher description, and `defaultCodeLanguage`.
- Generated MCQ source is parsed before it is returned. The route retries with validation issues up to three total model calls, then returns an error with the last issues/source.
