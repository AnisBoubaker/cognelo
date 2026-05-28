import { describe, expect, it } from "vitest";
import { codingHomeworkChallengePromptVersion, homeworkGraderPlugin, prototypePipelineSteps } from "./index";
import { homeworkGraderServerPlugin } from "./server";

describe("homework grader plugin manifest", () => {
  it("is registered as an incomplete no-op plugin safely", () => {
    expect(homeworkGraderPlugin.key).toBe("homework-grader");
    expect(homeworkGraderPlugin.activities[0]?.key).toBe("homework-grader");
    expect(homeworkGraderServerPlugin.routes).toEqual([]);
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
