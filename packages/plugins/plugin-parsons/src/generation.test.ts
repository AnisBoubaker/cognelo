import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateQuestionAuthoringText: vi.fn()
}));

vi.mock("@cognelo/core", async () => {
  const actual = await vi.importActual<typeof import("@cognelo/core")>("@cognelo/core");
  return {
    ...actual,
    generateQuestionAuthoringText: mocks.generateQuestionAuthoringText
  };
});

const { generateParsonsProblem } = await import("./generation");

const user = {
  id: "teacher-1",
  email: "teacher@example.test",
  name: null,
  firstName: null,
  lastName: null,
  roles: ["teacher" as const]
};
const subject = { title: "Programming", description: "Introductory programming" };

describe("Parsons AI generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses valid JSON and normalizes generated indentation", async () => {
    mocks.generateQuestionAuthoringText.mockResolvedValue(
      JSON.stringify({
        status: "ok",
        prompt: "Arrange the Python lines to print the total for a small order.",
        solution: "prices = [2, 3]\ntotal = 0\nfor price in prices:\n    total += price\nprint(total)"
      })
    );

    await expect(
      generateParsonsProblem({
        user,
        description: "Practice loops with a total",
        language: "python",
        locale: "en",
        subject
      })
    ).resolves.toMatchObject({
      status: "ok",
      attempts: 1,
      solution: "prices = [2, 3]\ntotal = 0\nfor price in prices:\n\ttotal += price\nprint(total)"
    });
  });

  it("retries malformed JSON and missing fields before accepting a correction", async () => {
    mocks.generateQuestionAuthoringText
      .mockResolvedValueOnce("not json")
      .mockResolvedValueOnce(JSON.stringify({ status: "ok", prompt: "Too little." }))
      .mockResolvedValueOnce(
        JSON.stringify({
          status: "warning",
          warningMessage: "J'ai supposé que l'exercice devait porter sur une boucle simple.",
          prompt: "Remettez les lignes en ordre pour calculer une somme.",
          solution: "nombres = [1, 2]\ntotal = 0\nfor nombre in nombres:\n\ttotal += nombre\nprint(total)"
        })
      );

    await expect(
      generateParsonsProblem({
        user,
        description: "Boucles",
        language: "python",
        locale: "fr",
        subject
      })
    ).resolves.toMatchObject({
      status: "warning",
      attempts: 3,
      warningMessage: "J'ai supposé que l'exercice devait porter sur une boucle simple."
    });
    expect(mocks.generateQuestionAuthoringText).toHaveBeenCalledTimes(3);
  });

  it("returns model error payloads without retrying", async () => {
    mocks.generateQuestionAuthoringText.mockResolvedValue(
      JSON.stringify({
        status: "error",
        message: "The request is too contradictory to create a coherent Parsons problem."
      })
    );

    await expect(
      generateParsonsProblem({
        user,
        description: "Make a sorting exercise but no code and no ordering.",
        language: "python",
        locale: "en",
        subject
      })
    ).resolves.toMatchObject({
      status: "error",
      attempts: 1
    });
  });

  it("throws with validation details after repeated invalid payloads", async () => {
    mocks.generateQuestionAuthoringText.mockResolvedValue(
      JSON.stringify({
        status: "warning",
        warningMessage: "Too short",
        prompt: "Also too short",
        solution: "print(1)"
      })
    );

    await expect(
      generateParsonsProblem({
        user,
        description: "A normal enough description",
        language: "python",
        locale: "en",
        subject
      })
    ).rejects.toMatchObject({
      status: 422,
      code: "PARSONS_AI_GENERATION_INVALID"
    });
  });
});
