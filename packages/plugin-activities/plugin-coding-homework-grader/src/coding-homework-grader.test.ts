import { describe, expect, it } from "vitest";
import { codingHomeworkChallengePromptVersion, codingHomeworkGraderPlugin, prototypePipelineSteps } from "./index";
import { codingHomeworkGraderDatabaseModule } from "./db";
import { codingHomeworkGraderServerPlugin } from "./server";

describe("coding homework grader plugin manifest", () => {
  it("is registered under the renamed plugin and activity keys", () => {
    expect(codingHomeworkGraderPlugin.key).toBe("coding-homework-grader");
    expect(codingHomeworkGraderPlugin.activities[0]?.key).toBe("coding-homework-grader");
    expect(codingHomeworkGraderPlugin.activities[0]?.name).toBe("Coding Homework Grader");
    expect(codingHomeworkGraderServerPlugin.routes?.map((route) => route.path)).toEqual([
      "coding-homework-grader/authoring",
      "coding-homework-grader/assignment-pdf",
      "coding-homework-grader/requirements-upload",
      "coding-homework-grader/documentation-preview",
      "coding-homework-grader/documentation-snapshot",
      "coding-homework-grader/documentation-extraction",
      "coding-homework-grader/reference-search",
      "coding-homework-grader/preflight",
      "coding-homework-grader/assignment",
      "coding-homework-grader/submission",
      "coding-homework-grader/processing-job",
      "coding-homework-grader/submission-analysis",
      "coding-homework-grader/challenge-generation",
      "coding-homework-grader/challenge-answers",
      "coding-homework-grader/gradebook-attempts",
      "coding-homework-grader/reprocess"
    ]);
  });

  it("declares plugin-owned persistence tables for activation backup coverage", () => {
    expect(codingHomeworkGraderDatabaseModule.namespace).toBe("plugin_coding_homework_grader");
    expect(codingHomeworkGraderDatabaseModule.tables).toContain("PluginCodingHomeworkAssignment");
    expect(codingHomeworkGraderDatabaseModule.tables).toContain("PluginCodingHomeworkSubmissionRequirementSet");
    expect(codingHomeworkGraderDatabaseModule.tables).toContain("PluginCodingHomeworkChallengeQuestion");
    expect(codingHomeworkGraderDatabaseModule.migrations[0]?.statements.join("\n")).toContain(
      'CREATE TABLE IF NOT EXISTS "PluginCodingHomeworkSubmission"'
    );
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
