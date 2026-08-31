import { describe, expect, it } from "vitest";
import { gradeMcqAnswers, parseMcqSource, renderInlineMarkdown } from "./mcq";
import { mcqPlugin } from "./plugin";
import { mcqServerPlugin } from "./server";
import { deriveMcqStudentAttemptState } from "./client";

describe("MCQ student attempt state", () => {
  it("starts an unlimited new attempt empty after a completed submission", () => {
    expect(deriveMcqStudentAttemptState({
      submission: { lifecycle: "graded", answers: { "question-1": ["choice-1"] } },
      availability: { canStart: true }
    })).toEqual({
      answers: {},
      submitted: false,
      completedSubmission: true
    });
  });

  it("resumes a started attempt with its saved answers", () => {
    expect(deriveMcqStudentAttemptState({
      submission: { lifecycle: "started", answers: { "question-1": ["choice-1"] } },
      availability: { canStart: true }
    })).toEqual({
      answers: { "question-1": ["choice-1"] },
      submitted: false,
      completedSubmission: false
    });
  });

  it("restores an autosaved draft without hiding completed submission history", () => {
    expect(deriveMcqStudentAttemptState({
      submission: { lifecycle: "graded", answers: { "question-1": ["old-choice"] } },
      draft: { answers: { "question-1": ["draft-choice"] } },
      availability: { canStart: true }
    })).toEqual({
      answers: { "question-1": ["draft-choice"] },
      submitted: false,
      completedSubmission: true
    });
  });
});

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

  it("renders a single-hash section and its text between questions instead of appending it to a choice", () => {
    const parsed = parseMcqSource(
      `# Reading comprehension

## Question 1

- [x] First correct answer
- [ ] First incorrect answer

# Part 2

Read the following short passage.

## Question 2
Which statement is supported?

- [x] Second correct answer
- [ ] Second incorrect answer`,
      "none"
    );

    expect(parsed.errors).toEqual([]);
    expect(parsed.introBlocks).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "heading", text: "Reading comprehension" })
    ]));
    expect(parsed.questions[0].choices[1].blocks).toEqual([
      expect.objectContaining({ type: "paragraph", text: "First incorrect answer" })
    ]);
    expect(parsed.questions[1].leadingBlocks).toEqual([
      expect.objectContaining({ type: "heading", text: "Part 2" }),
      expect.objectContaining({ type: "paragraph", text: "Read the following short passage." })
    ]);
  });

  it("renders untitled directions after an interstitial separator before the next question", () => {
    const parsed = parseMcqSource(
      `## Question 1

- [x] First correct answer
- [ ] First incorrect answer

---

Read the following passage before answering.

The passage can contain multiple paragraphs.

## Question 2

- [x] Second correct answer
- [ ] Second incorrect answer`,
      "none"
    );

    expect(parsed.errors).toEqual([]);
    expect(parsed.questions[0].choices[1].blocks).toEqual([
      expect.objectContaining({ type: "paragraph", text: "First incorrect answer" })
    ]);
    expect(parsed.questions[1].leadingBlocks).toEqual([
      expect.objectContaining({ type: "paragraph", text: "Read the following passage before answering." }),
      expect.objectContaining({ type: "paragraph", text: "The passage can contain multiple paragraphs." })
    ]);
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

  it("parses dollar and standard LaTeX math delimiters", () => {
    expect(renderInlineMarkdown("Derive \\(f(x)=x^2\\) or $g(x)=x^3$."))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ type: "math", expression: "f(x)=x^2" }),
        expect.objectContaining({ type: "math", expression: "g(x)=x^3" })
      ]));

    const parsed = parseMcqSource(
      `\\[x^2 + y^2 = z^2\\]

## Derivative
Compute \\(f'(x)\\).

- [x] \\(2x\\)
- [ ] \\(x\\)`,
      "none"
    );

    expect(parsed.introBlocks[0]).toMatchObject({ type: "math", expression: "x^2 + y^2 = z^2", display: true });
    expect(parsed.questions[0].promptBlocks).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "paragraph", text: "Compute \\(f'(x)\\)." })
    ]));
    expect(parsed.questions[0].choices[0].blocks[0]).toMatchObject({ type: "paragraph", text: "\\(2x\\)" });
  });

  it("renders an escaped dollar sign as literal text", () => {
    expect(renderInlineMarkdown("The price is \\$5 and the formula is $x+1$."))
      .toEqual([
        { type: "text", text: "The price is " },
        { type: "text", text: "$" },
        { type: "text", text: "5 and the formula is " },
        { type: "math", expression: "x+1" },
        { type: "text", text: "." }
      ]);
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

  it("accepts up to 80 AI-generated questions", () => {
    expect(configSchema?.parse({ source, aiQuestionCount: 80, randomizeChoices: false })).toMatchObject({
      aiQuestionCount: 80
    });
    expect(() => configSchema?.parse({ source, aiQuestionCount: 81, randomizeChoices: false })).toThrow();
  });

  it("stores an 80-question generated source beyond the former 30,000-character limit", () => {
    const generatedSource = Array.from(
      { length: 80 },
      (_value, index) => `## Question ${index + 1}\n${"Detailed question context. ".repeat(15)}\n\n- [x] Correct\n- [ ] Incorrect`
    ).join("\n\n");

    expect(generatedSource.length).toBeGreaterThan(30_000);
    expect(configSchema?.parse({ source: generatedSource, aiQuestionCount: 80, randomizeChoices: false })).toMatchObject({
      source: generatedSource,
      aiQuestionCount: 80
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
