import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), assignment: vi.fn(), preflight: vi.fn(), references: vi.fn(), state: vi.fn(), provided: vi.fn(), language: vi.fn(), connection: vi.fn(), generate: vi.fn() }));
vi.mock("@cognelo/core", () => ({
  AppError: class extends Error { constructor(public status: number, public code: string, message: string) { super(message); } },
  NonRetryableBackgroundJobError: class extends Error {},
  assertCanManageCourse: mocks.authorize, consumeRateLimits: vi.fn(), contentIndexRevision: JSON.stringify,
  getActivityMaterialReferences: mocks.references, getActivityMaterialReferenceState: mocks.state,
  snapshotAiModelSelection: (connection: { id: string; model: string }) => ({ connectionId: connection.id, model: connection.model })
}));
vi.mock("./db-client", () => ({ prisma: { pluginCodingHomeworkAssignment: { findUnique: mocks.assignment } } }));
vi.mock("./file-preparation", () => ({ record: (value: unknown) => value ?? {} }));
vi.mock("./preflight", () => ({ readHomeworkSimulationPreflight: mocks.preflight }));
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
  mocks.preflight.mockResolvedValue({ sources: [{ path: "upload.c", content: "int sum(void) { return 1; }", languageKey: "c" }], fingerprint: "checked-zip", incomplete: false });
  mocks.references.mockResolvedValue({ selected: [], prepared: false }); mocks.state.mockResolvedValue({ prepared: null });
  mocks.provided.mockResolvedValue({ version: "baseline", files: [], functions: [] }); mocks.language.mockResolvedValue("fr");
  mocks.connection.mockResolvedValue({ id: "model", model: "selected-model", apiKey: "PRIVATE_CREDENTIAL" }); mocks.generate.mockResolvedValue(result);
});
describe("private teacher homework simulation", () => {
  it("uses checked ZIP, course language and settings, returning only safe question context", async () => {
    const output = await simulateHomeworkQuestions(scope, { preflightId: "zip" });
    expect(mocks.generate).toHaveBeenCalledWith(expect.objectContaining({ questionLanguage: "fr", sources: [{ path: "upload.c", content: "int sum(void) { return 1; }", languageKey: "c" }], settings: expect.objectContaining({ generationInstructions: "Focus on the return value." }) }));
    expect(output.questions).toEqual([expect.objectContaining({ questionText: "Pourquoi cette condition ?", context: result.generated[0].context })]);
    expect(JSON.stringify(output)).not.toMatch(/PRIVATE_REFERENCE|PRIVATE_CREDENTIAL/);
  });
  it("requires authorization, a checked ZIP and prepared selected references before generation", async () => {
    mocks.authorize.mockRejectedValueOnce(new Error("Forbidden"));
    await expect(simulateHomeworkQuestions(scope, { preflightId: "zip" })).rejects.toThrow("Forbidden"); expect(mocks.preflight).not.toHaveBeenCalled();
    mocks.preflight.mockRejectedValueOnce(Object.assign(new Error("Upload a ZIP"), { code: "HOMEWORK_PREFLIGHT_REQUIRED" }));
    await expect(simulateHomeworkQuestions(scope, { preflightId: "zip" })).rejects.toMatchObject({ code: "HOMEWORK_PREFLIGHT_REQUIRED" });
    mocks.references.mockResolvedValue({ selected: ["resource"], prepared: false });
    await expect(simulateHomeworkQuestions(scope, { preflightId: "zip" })).rejects.toMatchObject({ code: "HOMEWORK_EMBEDDINGS_REQUIRED" });
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("simulates file-only completion without resolving models or references", async () => {
    mocks.assignment.mockResolvedValue({ settings: { questionGenerationEnabled: false } });
    expect(await simulateHomeworkQuestions(scope, { preflightId: "zip" })).toMatchObject({ questionGenerationEnabled: false, questions: [] });
    expect(mocks.generate).not.toHaveBeenCalled(); expect(mocks.connection).not.toHaveBeenCalled(); expect(mocks.references).not.toHaveBeenCalled();
  });
  it("rejects a completed result if the saved source changed during generation", async () => {
    mocks.preflight.mockResolvedValueOnce({ sources: [{ path: "upload.c", content: "int sum(void) { return 0; }", languageKey: "c" }], fingerprint: "older-checked-zip", incomplete: false });
    await expect(simulateHomeworkQuestions(scope, { preflightId: "zip" })).rejects.toMatchObject({ code: "HOMEWORK_SIMULATION_CHANGED" });
  });
  it("prevents overlapping requests and discards cancelled output before permitting a retry", async () => {
    let release!: (value: typeof result) => void;
    mocks.generate.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const controller = new AbortController(), pending = simulateHomeworkQuestions(scope, { preflightId: "zip" }, controller.signal);
    await vi.waitFor(() => expect(mocks.generate).toHaveBeenCalled());
    await expect(simulateHomeworkQuestions(scope, { preflightId: "zip" })).rejects.toMatchObject({ code: "HOMEWORK_SIMULATION_BUSY" });
    const aborted = expect(pending).rejects.toMatchObject({ name: "AbortError" }); controller.abort(); release(result); await aborted;
    await expect(simulateHomeworkQuestions(scope, { preflightId: "zip" })).resolves.toHaveProperty("questions");
  });
});
