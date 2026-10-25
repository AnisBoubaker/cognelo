import { describe, expect, it } from "vitest";
import { parseParsonsConfig, projectParsonsConfig, resetParsonsBlocks } from "./parsons";
import { createInitialParsonsAttemptState, projectParsonsState } from "./attempt-types";
import { evaluateParsonsAttemptStateForConfig } from "./attempts";

describe("Parsons learner projection", () => {
  const config = parseParsonsConfig({ prompt: "Arrange", solution: "if ready:\n  work()\nfinish()", stripIndentation: true });
  it("omits the solution and all ordering and indentation keys from configs and saved states", () => {
    for (const value of [projectParsonsConfig(config), projectParsonsState(createInitialParsonsAttemptState(config))]) {
      expect(JSON.stringify(value)).not.toMatch(/solution|sourceIndex|physicalLineIndex|expectedIndent|originalText|unitId|precedenceRules/);
      expect(JSON.stringify(value)).not.toContain("  work()");
    }
    const publicConfig = parseParsonsConfig(projectParsonsConfig(config));
    expect(resetParsonsBlocks(publicConfig)).toHaveLength(3);
  });
  it("grades public blocks against server data and rejects omitted or duplicate lines", () => {
    const state = { configFingerprint: "student", blocks: [
      { id: "a", displayText: "if ready:", currentIndent: 0 },
      { id: "b", displayText: "work()", currentIndent: 1 },
      { id: "c", displayText: "finish()", currentIndent: 0 }
    ] };
    expect(evaluateParsonsAttemptStateForConfig(state, config).isCorrect).toBe(true);
    expect(evaluateParsonsAttemptStateForConfig({ ...state, blocks: [...state.blocks].reverse() }, config).isCorrect).toBe(false);
    expect(() => evaluateParsonsAttemptStateForConfig({ ...state, blocks: state.blocks.slice(1) }, config)).toThrow();
    expect(() => evaluateParsonsAttemptStateForConfig({ ...state, blocks: [state.blocks[0], state.blocks[0], state.blocks[2]] }, config)).toThrow();
  });
});

it("refreshes a public config while preserving matching lines and duplicate-line indentation", async () => {
  const { reconcileParsonsResponseState } = await import("./attempt-types");
  const old = projectParsonsConfig({ solution: "first()\nsame()\nsame()", stripIndentation: true });
  const next = projectParsonsConfig({ solution: "first()\nsame()\nsame()\nlast()", stripIndentation: true });
  const state = { configFingerprint: "student", blocks: [
    { id: "a", displayText: "same()", currentIndent: 1 },
    { id: "b", displayText: "first()", currentIndent: 0 },
    { id: "c", displayText: "same()", currentIndent: 2 }
  ] };
  const result = reconcileParsonsResponseState(old, next, state);
  expect((result.blocks as Array<{ currentIndent: number }>).map((block) => block.currentIndent)).toEqual([1, 0, 2, 0]);
});
