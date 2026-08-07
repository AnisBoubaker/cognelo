import { describe, expect, it } from "vitest";
import { gradeMcqAnswers, parseMcqSource, renderInlineMarkdown } from "./mcq";
import { mcqPlugin } from "./plugin";
import { mcqServerPlugin } from "./server";

describe("MCQ source parser", () => {
  it("parses single and multiple answer questions from markdown", () => {
    const parsed = parseMcqSource(
      `Intro paragraph.

## Capital city

Choose the capital.

- [x] Paris
- [ ] Lyon

## Prime numbers

- [x] 2
- [x] 3
- [ ] 4`,
      "javascript"
    );

    expect(parsed.errors).toEqual([]);
    expect(parsed.introBlocks[0]).toMatchObject({ type: "paragraph", text: "Intro paragraph." });
    expect(parsed.questions).toHaveLength(2);
    expect(parsed.questions[0]).toMatchObject({ title: "Capital city", mode: "single" });
    expect(parsed.questions[1]).toMatchObject({ title: "Prime numbers", mode: "multiple" });
  });

  it("reports malformed questions without throwing", () => {
    const parsed = parseMcqSource(
      `## Missing correct answer

- [ ] A
- [ ] B`,
      "python"
    );

    expect(parsed.questions).toHaveLength(1);
    expect(parsed.errors.map((error) => error.message).join("\n")).toContain("must mark at least one correct answer");
  });

  it("normalizes code fence language aliases", () => {
    const parsed = parseMcqSource(
      `## Code

\`\`\`py
print("hello")
\`\`\`

- [x] It prints text
- [ ] It fails`,
      "javascript"
    );

    expect(parsed.questions[0].promptBlocks[0]).toMatchObject({
      type: "code",
      language: "python"
    });
  });

  it("parses inline markdown tokens and escaped answer markers", () => {
    const tokens = renderInlineMarkdown("Use **bold**, *italic*, and `code`.");
    expect(tokens).toEqual(expect.arrayContaining([expect.objectContaining({ type: "strong" })]));
    expect(tokens).toEqual(expect.arrayContaining([expect.objectContaining({ type: "emphasis" })]));
    expect(tokens).toEqual(expect.arrayContaining([expect.objectContaining({ type: "code", text: "code" })]));

    const parsed = parseMcqSource(
      `## Escaped

- \\[x\\] This is text, not a marker
- [x] Correct`,
      "javascript"
    );
    expect(parsed.questions[0].choices).toHaveLength(1);
    expect(parsed.questions[0].choices[0]).toMatchObject({ isCorrect: true });
  });

  it("awards partial credit for incomplete multiple-answer selections", () => {
    const parsed = parseMcqSource(
      `## Choose the collection types
Which of these are Python collection types?

- [x] \`list\`
- [x] \`dict\`
- [ ] \`switch\``,
      "python"
    );

    const result = gradeMcqAnswers(parsed, {
      "question-1": ["question-1-choice-2"]
    });

    expect(result.rawScore).toBe(0.5);
    expect(result.questions[0]).toMatchObject({
      isCorrect: false,
      rawScore: 0.5
    });
  });
});

describe("MCQ activity config", () => {
  const configSchema = mcqPlugin.activities[0]?.configSchema;
  const source = `## Saved settings

- [x] Correct
- [ ] Incorrect`;

  it("persists AI generation settings in validated config", () => {
    expect(configSchema?.parse({
      source,
      aiGenerationInstructions: "Focus on debugging scenarios.",
      aiQuestionCount: 8,
      defaultCodeLanguage: "python",
      randomizeChoices: true
    })).toMatchObject({
      aiGenerationInstructions: "Focus on debugging scenarios.",
      aiQuestionCount: 8,
      defaultCodeLanguage: "python"
    });
  });

  it("adds defaults for AI generation settings in older config", () => {
    expect(configSchema?.parse({ source, randomizeChoices: false })).toMatchObject({
      aiGenerationInstructions: "",
      aiQuestionCount: 5,
      defaultCodeLanguage: "none"
    });
  });
});

describe("MCQ composite Test execution", () => {
  it("advertises composite support and grades through the generic server adapter", async () => {
    expect(mcqPlugin.activities[0]?.grading?.supportsCompositeExecution).toBe(true);
    const result = await mcqServerPlugin.compositeExecution!.submit({
      user: { id: "student-1", email: "student@example.test", name: null, firstName: null, lastName: null, roles: ["student"] },
      courseId: "course-1",
      groupId: "group-1",
      parentAttemptId: "test-attempt-1",
      testItemId: "test-item-1",
      activity: {
        id: "mcq-1",
        title: "MCQ",
        description: "",
        lifecycle: "published",
        config: {
          source: `## Capital\n\n- [x] Paris\n- [ ] Lyon`
        },
        activityType: { key: "mcq", name: "MCQ", description: "" }
      },
      payload: { answers: { "question-1": ["question-1-choice-1"] } }
    });

    expect(result.state).toEqual({ answers: { "question-1": ["question-1-choice-1"] } });
    expect(result.gradingResult).toMatchObject({ rawScore: 1, rawMaxScore: 1 });
  });

  it("treats an unvisited Test item as an unanswered MCQ during whole-Test submission", async () => {
    const result = await mcqServerPlugin.compositeExecution!.submit({
      user: { id: "student-1", email: "student@example.test", name: null, firstName: null, lastName: null, roles: ["student"] },
      courseId: "course-1",
      groupId: "group-1",
      parentAttemptId: "test-attempt-1",
      testItemId: "test-item-1",
      activity: {
        id: "mcq-1",
        title: "MCQ",
        description: "",
        lifecycle: "published",
        config: { source: `## Capital\n\n- [x] Paris\n- [ ] Lyon` },
        activityType: { key: "mcq", name: "MCQ", description: "" }
      },
      payload: {}
    });

    expect(result.state).toEqual({ answers: {} });
    expect(result.gradingResult).toMatchObject({ rawScore: 0, rawMaxScore: 1 });
  });
});
