import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStoredZip } from "../../../../tests/e2e/fixtures/zip";
const mocks = vi.hoisted(() => ({ submission: vi.fn(), attachment: vi.fn(), requirements: vi.fn(), open: vi.fn(), close: vi.fn() }));
vi.mock("./db-client", () => ({ Prisma: {}, prisma: { pluginCodingHomeworkSubmission: { findFirst: mocks.submission }, pluginCodingHomeworkAttachment: { findFirst: mocks.attachment }, pluginCodingHomeworkSubmissionRequirementSet: { findUnique: mocks.requirements } } }));
vi.mock("@cognelo/core", () => ({ AppError: class extends Error { constructor(public status: number, public code: string, message: string) { super(message); } }, contentIndexRevision: JSON.stringify, openStoredMaterial: mocks.open }));
import { readHomeworkSimulationPreflight } from "./preflight";
import { normalizeCodingHomeworkSubmissionRequirements } from "./validation";
const scope = { activityId: "activity", courseId: "course", user: { id: "teacher", email: "teacher@example.test", name: null, firstName: null, lastName: null, roles: ["teacher" as const] } };
const requirements = normalizeCodingHomeworkSubmissionRequirements({ requiredFiles: [{ path: "main.c" }, { path: "missing.h" }] });
let bytes: Buffer;
function fixture(entries = [{ path: "main.c", contents: "int main(void) { return 0; }" }]) {
  bytes = createStoredZip(entries);
  mocks.submission.mockResolvedValue({ id: "checked", zipAttachmentId: "zip", metadata: { expiresAt: new Date(Date.now() + 60_000).toISOString(), requirementsFingerprint: JSON.stringify(requirements) } });
  mocks.attachment.mockResolvedValue({ storedName: "9bd2d1ac-a575-49bc-8690-f2e36c79a8fe-test.zip", sizeBytes: BigInt(bytes.length), sha256: createHash("sha256").update(bytes).digest("hex") });
  mocks.open.mockResolvedValue({ stat: async () => ({ size: bytes.length }), readFile: async () => bytes, close: mocks.close });
}
beforeEach(() => { vi.resetAllMocks(); mocks.requirements.mockResolvedValue({ requirements }); fixture(); });
describe("simulation checked-ZIP boundary", () => {
  it("scopes reads to the teacher's course preflight and requires explicit academic acknowledgement", async () => {
    await expect(readHomeworkSimulationPreflight(scope, "checked", false)).rejects.toMatchObject({ code: "HOMEWORK_INCOMPLETE_ACKNOWLEDGEMENT_REQUIRED" });
    expect(mocks.submission).toHaveBeenCalledWith({ where: { id: "checked", activityId: "activity", userId: "teacher", groupId: "__course__", kind: "preflight" } });
    const value = await readHomeworkSimulationPreflight(scope, "checked", true);
    expect(value.incomplete).toBe(true); expect(value.sources[0]).toMatchObject({ path: "main.c", content: "int main(void) { return 0; }" });
    expect(mocks.open).toHaveBeenCalledWith(expect.any(String), ["preflight"], "9bd2d1ac-a575-49bc-8690-f2e36c79a8fe-test.zip"); expect(mocks.close).toHaveBeenCalledTimes(2);
  });
  it("rejects a missing/foreign, expired or stale preflight before reading bytes", async () => {
    mocks.submission.mockResolvedValueOnce(null);
    await expect(readHomeworkSimulationPreflight(scope, "foreign", true)).rejects.toMatchObject({ code: "HOMEWORK_PREFLIGHT_REQUIRED" });
    mocks.submission.mockResolvedValueOnce({ metadata: { expiresAt: new Date(0).toISOString() } });
    await expect(readHomeworkSimulationPreflight(scope, "expired", true)).rejects.toMatchObject({ code: "HOMEWORK_PREFLIGHT_REQUIRED" });
    mocks.requirements.mockResolvedValueOnce({ requirements: { requiredFiles: [{ path: "changed.c" }] } });
    await expect(readHomeworkSimulationPreflight(scope, "stale", true)).rejects.toMatchObject({ code: "HOMEWORK_PREFLIGHT_CHANGED" });
    expect(mocks.open).not.toHaveBeenCalled();
  });
  it("rejects unsafe storage references and changed bytes", async () => {
    mocks.attachment.mockResolvedValueOnce({ storedName: "../outside.zip" });
    await expect(readHomeworkSimulationPreflight(scope, "checked", true)).rejects.toMatchObject({ code: "HOMEWORK_PREFLIGHT_REQUIRED" }); expect(mocks.open).not.toHaveBeenCalled();
    bytes = Buffer.from("modified");
    await expect(readHomeworkSimulationPreflight(scope, "checked", true)).rejects.toMatchObject({ code: "HOMEWORK_FILE_CHANGED" }); expect(mocks.close).toHaveBeenCalled();
  });
  it("does not let incomplete-work acknowledgement bypass blocking file rules", async () => {
    fixture([{ path: "main.c", contents: "int main(void) { return 0; }" }, { path: "program.exe", contents: "binary" }]);
    await expect(readHomeworkSimulationPreflight(scope, "checked", true)).rejects.toMatchObject({ code: "HOMEWORK_FILES_INVALID" });
  });
});
