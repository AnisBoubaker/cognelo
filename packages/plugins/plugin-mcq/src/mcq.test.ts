import { describe, expect, it } from "vitest";
import { gradeMcqAnswers, parseMcqSource, renderInlineMarkdown } from "./mcq";

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
