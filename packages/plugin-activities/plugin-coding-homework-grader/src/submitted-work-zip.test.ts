import { createHash } from "node:crypto";
import { unzipSync } from "fflate";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ open: vi.fn(), close: vi.fn() }));
vi.mock("@cognelo/core", async original => ({ ...await original<object>(), openStoredMaterial: mocks.open }));
import { submittedWorkZipResponse, type SubmittedZipWork } from "./submitted-work";
const bytes = Buffer.from([0, 255, 13, 10, 195, 169]);
const work = (): SubmittedZipWork => ({ folders: ["src", "empty"], files: [{ path: "src/data.bin", storedName: "submission/files/source", sizeBytes: BigInt(bytes.length), sha256: createHash("sha256").update(bytes).digest("hex") }] });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.open.mockResolvedValue({ stat: async () => ({ size: bytes.length }), close: mocks.close, read: async (buffer: Buffer, offset: number, length: number, position: number) => {
    const chunk = bytes.subarray(position, position + length); buffer.set(chunk, offset); return { bytesRead: chunk.length };
  } });
});
describe("original submitted-file ZIP streaming", () => {
  it("retains binary bytes and empty folders without decoding or executing content", async () => {
    const validate = vi.fn();
    const response = submittedWorkZipResponse(work(), "Étudiant.zip", undefined, validate);
    const files = unzipSync(new Uint8Array(await response.arrayBuffer()));
    expect(Buffer.from(files["src/data.bin"])).toEqual(bytes); expect(files["empty/"]).toBeDefined();
    expect(response.headers.get("Content-Disposition")).toContain("filename*=UTF-8''%C3%89tudiant.zip");
    expect(validate).toHaveBeenCalledTimes(2); expect(mocks.close).toHaveBeenCalledOnce();
  });
  it("fails integrity checks and closes handles rather than returning a valid archive", async () => {
    const input = work(); input.files[0].sha256 = "0".repeat(64);
    await expect(submittedWorkZipResponse(input, "work.zip").arrayBuffer()).rejects.toMatchObject({ code: "HOMEWORK_FILE_CHANGED" });
    expect(mocks.close).toHaveBeenCalledOnce();
  });
  it("rejects unsafe stored paths before opening files", async () => {
    const input = work(); input.files[0].storedName = "../teacher/private";
    await expect(submittedWorkZipResponse(input, "work.zip").arrayBuffer()).rejects.toMatchObject({ code: "HOMEWORK_FILE_INVALID" });
    expect(mocks.open).not.toHaveBeenCalled();
  });
  it("rechecks current ownership before finalizing and honours cancellation", async () => {
    const validate = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("Submission changed"));
    await expect(submittedWorkZipResponse(work(), "work.zip", undefined, validate).arrayBuffer()).rejects.toThrow("Submission changed");
    const controller = new AbortController(); controller.abort(); mocks.open.mockClear();
    await expect(submittedWorkZipResponse(work(), "work.zip", controller.signal).arrayBuffer()).rejects.toMatchObject({ name: "AbortError" });
    expect(mocks.open).not.toHaveBeenCalled();
  });
});
