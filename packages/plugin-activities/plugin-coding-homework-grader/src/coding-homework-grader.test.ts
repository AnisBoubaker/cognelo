import { describe, expect, it } from "vitest";
import { codingHomeworkChallengePromptVersion, codingHomeworkGraderPlugin, prototypePipelineSteps } from "./index";
import { codingHomeworkGraderServerPlugin } from "./server";

describe("coding homework grader plugin manifest", () => {
  it("is registered under the renamed plugin and activity keys", () => {
    expect(codingHomeworkGraderPlugin.key).toBe("coding-homework-grader");
    expect(codingHomeworkGraderPlugin.activities[0]?.key).toBe("coding-homework-grader");
    expect(codingHomeworkGraderPlugin.activities[0]?.name).toBe("Coding Homework Grader");
    expect(codingHomeworkGraderServerPlugin.routes).toEqual([]);
  });

  it("documents the research prototype pipeline without depending on tmp files at runtime", () => {
    expect(codingHomeworkChallengePromptVersion).toBe("coding-homework-grader.challenge-question.v1");
    expect(prototypePipelineSteps.map((step) => step.prototypeScript)).toEqual([
      "0_data_cleanup.py",
      "1_parse_code.py",
      "2_generate_corpus_embeddings.py",
      "3_compute_similarities.py",
      "4_select_candidates.py",
      "5_generate_questions.py"
    ]);
  });
});
