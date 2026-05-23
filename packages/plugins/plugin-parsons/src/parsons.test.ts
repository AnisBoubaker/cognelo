import { describe, expect, it } from "vitest";
import {
  buildParsonsBlocks,
  createParsonsGroup,
  createParsonsPrecedenceRule,
  evaluateParsonsSolution,
  normalizePrecedenceRules,
  normalizeParsonsGroups,
  parseParsonsConfig,
  removeParsonsGroupDependencies,
  rebaseParsonsGroupsOnSolutionChange
} from "./parsons";
import {
  buildParsonsAttemptState,
  createInitialParsonsAttemptState,
  getParsonsConfigFingerprint,
  parsonsAttemptUpdateInputSchema
} from "./attempt-types";
import { buildParsonsGradingResult } from "./grading";

describe("Parsons problem helpers", () => {
  it("parses defaults and normalizes groups", () => {
    const config = parseParsonsConfig({
      solution: "a = 1\nb = 2\nprint(a + b)",
      groups: [{ id: "group-1", label: "Setup", startLine: 0, endLine: 1, orderSensitive: false }]
    });

    expect(config.groups).toEqual([
      { id: "group-1", label: "Setup", startLine: 0, endLine: 1, orderSensitive: false }
    ]);
  });

  it("creates only contiguous in-range groups", () => {
    expect(createParsonsGroup([0, 1, 2], 3)).toMatchObject({ startLine: 0, endLine: 2 });
    expect(createParsonsGroup([0, 2], 3)).toBeNull();
    expect(createParsonsGroup([0, 3], 3)).toBeNull();
  });

  it("evaluates correct and incorrect block order", () => {
    const config = parseParsonsConfig({ solution: "first()\nsecond()" });
    const blocks = buildParsonsBlocks("stable", config).sort((left, right) => left.sourceIndex - right.sourceIndex);

    expect(evaluateParsonsSolution(blocks, config)).toMatchObject({ isCorrect: true });
    expect(evaluateParsonsSolution([...blocks].reverse(), config)).toMatchObject({ orderCorrect: false, isCorrect: false });
  });

  it("rebases groups when solution lines are inserted before them", () => {
    const groups = normalizeParsonsGroups([{ id: "group-1", label: "Body", startLine: 1, endLine: 2 }], 3);

    expect(rebaseParsonsGroupsOnSolutionChange("a\nb\nc", "intro\na\nb\nc", groups)).toEqual([
      { id: "group-1", label: "Body", startLine: 2, endLine: 3, orderSensitive: true }
    ]);
  });

  it("rebases groups when solution lines are deleted before or inside them", () => {
    const groups = normalizeParsonsGroups([{ id: "group-1", label: "Body", startLine: 1, endLine: 2 }], 4);

    expect(rebaseParsonsGroupsOnSolutionChange("a\nb\nc\nd", "b\nc\nd", groups)).toEqual([
      { id: "group-1", label: "Body", startLine: 0, endLine: 1, orderSensitive: true }
    ]);
    expect(rebaseParsonsGroupsOnSolutionChange("a\nb\nc\nd", "a\nc\nd", groups)).toEqual([
      { id: "group-1", label: "Body", startLine: 1, endLine: 1, orderSensitive: true }
    ]);
  });

  it("keeps group spans stable when solution lines are reordered without net length changes", () => {
    const groups = normalizeParsonsGroups([{ id: "group-1", label: "Body", startLine: 1, endLine: 2 }], 3);

    expect(rebaseParsonsGroupsOnSolutionChange("a\nb\nc", "a\nc\nb", groups)).toEqual([
      { id: "group-1", label: "Body", startLine: 1, endLine: 2, orderSensitive: true }
    ]);
  });

  it("handles precedence rules and dependency removal", () => {
    const groups = normalizeParsonsGroups(
      [
        { id: "a", label: "A", startLine: 0, endLine: 0 },
        { id: "b", label: "B", startLine: 1, endLine: 1 }
      ],
      2
    );
    const rule = createParsonsPrecedenceRule("a", "b");

    expect(normalizePrecedenceRules([rule], groups)).toEqual([rule]);
    expect(removeParsonsGroupDependencies([rule], "a")).toEqual([]);
  });

  it("creates attempt state, fingerprints configs, and validates update events", () => {
    const config = parseParsonsConfig({ solution: "a()\nb()" });
    const state = createInitialParsonsAttemptState(config);

    expect(state.configFingerprint).toBe(getParsonsConfigFingerprint(config));
    expect(buildParsonsAttemptState(config, state.blocks, "block-1")).toMatchObject({ selectedBlockId: "block-1" });
    expect(getParsonsConfigFingerprint(config)).not.toBe(getParsonsConfigFingerprint({ ...config, solution: "a()\nb()\nc()" }));
    expect(() =>
      parsonsAttemptUpdateInputSchema.parse({
        attemptId: "clx0000000000000000000000",
        event: { type: "move", payload: { from: 0, to: 1 } },
        complete: true
      })
    ).not.toThrow();
  });

  it("builds a core-compatible grading result from a Parsons evaluation", () => {
    expect(
      buildParsonsGradingResult({
        isCorrect: true,
        orderCorrect: true,
        indentationCorrect: true,
        misplacedBlocks: 0,
        incorrectIndents: 0
      })
    ).toMatchObject({
      rawScore: 1,
      rawMaxScore: 1,
      isPass: true,
      analyticsPayload: {
        orderCorrect: true,
        indentationCorrect: true,
        misplacedBlocks: 0,
        incorrectIndents: 0
      },
      metadata: {
        gradingModel: "parsons-correctness-v1",
        studentFeedback: {
          kind: "parsons",
          details: {
            messages: [],
            grading: [
              { type: "order", awardedRaw: 0.7, possibleRaw: 0.7 },
              { type: "indentation", awardedRaw: 0.3, possibleRaw: 0.3 }
            ]
          }
        }
      }
    });

    expect(
      buildParsonsGradingResult({
        isCorrect: false,
        orderCorrect: true,
        indentationCorrect: false,
        misplacedBlocks: 0,
        incorrectIndents: 2
      })
    ).toMatchObject({
      rawScore: 0.7,
      rawMaxScore: 1,
      isPass: false,
      metadata: {
        studentFeedback: {
          details: {
            messages: [{ type: "indentation", count: 2 }],
            grading: expect.arrayContaining([{ type: "indentation", awardedRaw: 0, possibleRaw: 0.3 }])
          }
        }
      }
    });
  });
});
