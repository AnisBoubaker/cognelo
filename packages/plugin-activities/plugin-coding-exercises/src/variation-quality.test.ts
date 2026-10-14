import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@cognelo/core", async () => ({
  ...await vi.importActual<typeof import("@cognelo/core")>("@cognelo/core"),
  generateQuestionAuthoringText: mocks.generate
}));
const { reviewCodingExerciseVariation } = await import("./variation-quality");

const accepted = {
  sourceReasoning: "Counts triples with b=a+1 and c=b+1, using independent die rolls.",
  candidateReasoning: "Runs a bounded sequence of rolls stopping at the first six, tracking the number of rolls and final value.",
  numericalVerification: "Source: 4/216*100 = 1.85%. Candidate: (1-(5/6)^3)*100 = 42.13%.",
  adaptationScope: "substantive",
  substantivelyDifferent: true, preservesLearningObjectives: true, consistent: true,
  reasoningChange: "The source examines fixed triples; the candidate manages repeated rolls, a stopping condition, and a roll limit.",
  issues: []
};
const input = {
  user: { id: "teacher-1", email: "teacher@example.test", name: null, firstName: null, lastName: null, roles: ["teacher" as const] },
  language: "c", locale: "fr" as const, subject: { title: "Programming", description: "Loops and conditions" },
  knowledge: { mode: "selected" as const, concepts: [], selectedConcepts: [] }, instructions: "Utiliser nb_aleatoire.",
  source: {
    description: "Estimer une probabilité.",
    prompt: "Simuler trois dés consécutifs dans l’ordre croissant : environ 1.85%.",
    referenceSolution: "if (b == a + 1 && c == b + 1) successes++;",
    rubric: { criteria: [{ title: "Simulation", description: "Boucle, condition et fréquence." }] }
  },
  candidate: {
    prompt: "Lancer un dé jusqu’au premier six, au maximum trois fois. Estimer la probabilité de succès : environ 42.13%.",
    referenceSolution: "int rolls = 0, value; do { value = nb_aleatoire(1,6); rolls++; } while (value != 6 && rolls < 3); if (value == 6) successes++;",
    templateSource: "{{ STUDENT_CODE }}"
  }
};

describe("coding variation semantic review", () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it("reviews the complete problems, solutions, preserved rubric, and constraints", async () => {
    mocks.generate.mockResolvedValue(JSON.stringify(accepted));
    await expect(reviewCodingExerciseVariation(input)).resolves.toEqual([]);
    const request = mocks.generate.mock.calls[0][1];
    expect(request.userPrompt).toContain(JSON.stringify(input.source));
    expect(request.userPrompt).toContain(JSON.stringify(input.candidate));
    expect(request.userPrompt).toContain(input.instructions);
    expect(request.systemPrompt).toContain("renamed variables/functions");
    expect(request.systemPrompt).toContain("mandatory helper/API constraints");
    expect(request.systemPrompt).toContain("independently count favourable and total outcomes");
  });

  it("rejects renamed code even though its text differs", async () => {
    mocks.generate.mockResolvedValue(JSON.stringify({
      ...accepted, substantivelyDifferent: false,
      reasoningChange: "Only identifiers and the story changed; the same consecutive-value predicate remains."
    }));
    const issues = await reviewCodingExerciseVariation({ ...input, candidate: {
      ...input.candidate,
      prompt: "Trois mesures consécutives dans l’ordre croissant : environ 1.85%.",
      referenceSolution: "if (second == first + 1 && third == second + 1) count++;"
    } });
    expect(issues).toEqual([expect.stringContaining("Only identifiers and the story changed")]);
  });

  it("rejects the reported strictly-increasing dice example with its copied probability", async () => {
    mocks.generate.mockResolvedValue(JSON.stringify({
      ...accepted, consistent: false, issues: ["a < b < c has 20/216 outcomes (9.26%), not 4/216 (1.85%)."]
    }));
    const issues = await reviewCodingExerciseVariation({ ...input, candidate: {
      ...input.candidate, prompt: "Trois mesures strictement croissantes : environ 1.85%.",
      referenceSolution: "if (a < b && b < c) successes++;"
    } });
    expect(issues).toContain("a < b < c has 20/216 outcomes (9.26%), not 4/216 (1.85%).");
  });

  it("rejects a condition-only substitution even when the model marks the problem different and numerically correct", async () => {
    mocks.generate.mockResolvedValue(JSON.stringify({ ...accepted, adaptationScope: "local_substitution" }));
    const issues = await reviewCodingExerciseVariation({ ...input, candidate: {
      ...input.candidate, prompt: "Trois dés identiques : environ 2.78%.", referenceSolution: "if (a == b && b == c) successes++;"
    } });
    expect(issues).toEqual([expect.stringContaining("local condition/formula substitution")]);
  });

  it.each(["prompt", "referenceSolution"] as const)("rejects an identical %s without trusting a model approval", async (field) => {
    const issues = await reviewCodingExerciseVariation({ ...input, candidate: { ...input.candidate, [field]: input.source[field] } });
    expect(issues).toEqual([expect.stringContaining("identical")]);
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("does not allow affirmative flags to suppress reported issues or a failed curriculum check", async () => {
    mocks.generate.mockResolvedValue(JSON.stringify({ ...accepted, preservesLearningObjectives: false, issues: ["Requires an untaught recursive algorithm."] }));
    expect(await reviewCodingExerciseVariation(input)).toEqual([
      "Requires an untaught recursive algorithm.", expect.stringContaining("learning objectives")
    ]);
  });

  it("repairs malformed review JSON with the full context and fails closed if it stays malformed", async () => {
    mocks.generate.mockResolvedValueOnce("Looks fine.").mockResolvedValueOnce("```json\n" + JSON.stringify(accepted) + "\n```");
    await expect(reviewCodingExerciseVariation(input)).resolves.toEqual([]);
    expect(mocks.generate.mock.calls[1][1].userPrompt).toContain(JSON.stringify(input.source));
    expect(mocks.generate.mock.calls[1][1].userPrompt).toContain("previous review was not valid");
    mocks.generate.mockReset().mockResolvedValue('{"substantivelyDifferent":true}');
    await expect(reviewCodingExerciseVariation(input)).rejects.toMatchObject({ code: "CODING_EXERCISE_VARIATION_REVIEW_INVALID" });
    expect(mocks.generate).toHaveBeenCalledTimes(2);
  });

  it("can review a source without a private reference solution", async () => {
    mocks.generate.mockResolvedValue(JSON.stringify(accepted));
    await expect(reviewCodingExerciseVariation({ ...input, source: { ...input.source, referenceSolution: "" } })).resolves.toEqual([]);
    expect(mocks.generate.mock.calls[0][1].systemPrompt).toContain("infer its required reasoning from the source prompt");
  });
});
