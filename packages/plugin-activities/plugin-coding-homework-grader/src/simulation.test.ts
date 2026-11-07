import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), assignment: vi.fn(), solution: vi.fn(), references: vi.fn(), state: vi.fn(), provided: vi.fn(), language: vi.fn(), connection: vi.fn(), generate: vi.fn() }));
vi.mock("@cognelo/core", () => ({
  AppError: class extends Error { constructor(public status: number, public code: string, message: string) { super(message); } },
  NonRetryableBackgroundJobError: class extends Error {},
  assertCanManageCourse: mocks.authorize, consumeRateLimits: vi.fn(), contentIndexRevision: JSON.stringify,
  getActivityMaterialReferences: mocks.references, getActivityMaterialReferenceState: mocks.state,
  snapshotAiModelSelection: (connection: { id: string; model: string }) => ({ connectionId: connection.id, model: connection.model })
}));
vi.mock("./db-client", () => ({ prisma: { pluginCodingHomeworkAssignment: { findUnique: mocks.assignment }, pluginCodingHomeworkTeacherSolution: { findUnique: mocks.solution } } }));
vi.mock("./file-preparation", () => ({ record: (value: unknown) => value ?? {} }));
vi.mock("./provided-code", () => ({ snapshotProvidedCode: mocks.provided }));
vi.mock("./ai-selection", () => ({ getHomeworkQuestionConnection: mocks.connection }));
vi.mock("./question-generation-policy", () => ({ getHomeworkQuestionLanguage: mocks.language }));
vi.mock("./prepared-question-generation", () => ({ generatePreparedHomeworkQuestions: mocks.generate }));
import { simulateHomeworkQuestions } from "./simulation";
const scope = { user: { id: "teacher", email: "teacher@example.test", name: null, firstName: null, lastName: null, roles: ["teacher" as const] }, courseId: "course", activityId: "activity" };
const result = { generated: [{ text: "Pourquoi cette condition ?", context: { code: "int sum(void) { return 1; }" }, matches: ["PRIVATE_REFERENCE"] }] };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.assignment.mockResolvedValue({ questionCount: 1, generationInstructions: "Focus on the return value.", settings: {} });
  mocks.solution.mockResolvedValue({ files: [{ path: "solution.c", text: "int sum(void) { return 1; }" }] });
  mocks.references.mockResolvedValue({ selected: [], prepared: false }); mocks.state.mockResolvedValue({ prepared: null });
  mocks.provided.mockResolvedValue({ version: "baseline", files: [], functions: [] }); mocks.language.mockResolvedValue("fr");
  mocks.connection.mockResolvedValue({ id: "model", model: "selected-model", apiKey: "PRIVATE_CREDENTIAL" }); mocks.generate.mockResolvedValue(result);
});
describe("private teacher homework simulation", () => {
  it("uses saved solution, course language and settings, returning only safe question context", async () => {
    const output = await simulateHomeworkQuestions(scope, {});
    expect(mocks.generate).toHaveBeenCalledWith(expect.objectContaining({ questionLanguage: "fr", sources: [{ path: "solution.c", content: "int sum(void) { return 1; }", languageKey: "c" }], settings: expect.objectContaining({ generationInstructions: "Focus on the return value." }) }));
    expect(output.questions).toEqual([expect.objectContaining({ questionText: "Pourquoi cette condition ?", context: result.generated[0].context })]);
    expect(JSON.stringify(output)).not.toMatch(/PRIVATE_REFERENCE|PRIVATE_CREDENTIAL/);
  });
  it("requires authorization, a private solution and prepared selected references before generation", async () => {
    mocks.authorize.mockRejectedValueOnce(new Error("Forbidden"));
    await expect(simulateHomeworkQuestions(scope, {})).rejects.toThrow("Forbidden"); expect(mocks.solution).not.toHaveBeenCalled();
    mocks.solution.mockResolvedValueOnce(null);
    await expect(simulateHomeworkQuestions(scope, {})).rejects.toMatchObject({ code: "HOMEWORK_SOLUTION_REQUIRED" });
    mocks.references.mockResolvedValue({ selected: ["resource"], prepared: false });
    await expect(simulateHomeworkQuestions(scope, {})).rejects.toMatchObject({ code: "HOMEWORK_EMBEDDINGS_REQUIRED" });
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("rejects a completed result if the saved source changed during generation", async () => {
    mocks.solution.mockResolvedValueOnce({ files: [{ path: "solution.c", text: "int sum(void) { return 0; }" }] });
    await expect(simulateHomeworkQuestions(scope, {})).rejects.toMatchObject({ code: "HOMEWORK_SIMULATION_CHANGED" });
  });
  it("prevents overlapping requests and discards cancelled output before permitting a retry", async () => {
    let release!: (value: typeof result) => void;
    mocks.generate.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const controller = new AbortController(), pending = simulateHomeworkQuestions(scope, {}, controller.signal);
    await vi.waitFor(() => expect(mocks.generate).toHaveBeenCalled());
    await expect(simulateHomeworkQuestions(scope, {})).rejects.toMatchObject({ code: "HOMEWORK_SIMULATION_BUSY" });
    const aborted = expect(pending).rejects.toMatchObject({ name: "AbortError" }); controller.abort(); release(result); await aborted;
    await expect(simulateHomeworkQuestions(scope, {})).resolves.toHaveProperty("questions");
  });
});
