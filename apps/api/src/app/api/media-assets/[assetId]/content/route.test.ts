import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createReadStream: vi.fn(),
  getMediaAssetForDelivery: vi.fn(),
  requireUser: vi.fn()
}));

vi.mock("node:fs", () => ({ createReadStream: mocks.createReadStream }));

vi.mock("@cognelo/core", () => ({
  getMediaAssetForDelivery: mocks.getMediaAssetForDelivery
}));

vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  options: () => new Response(null, { status: 204 }),
  requireUser: mocks.requireUser
}));

const { GET } = await import("./route");

describe("media asset content route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "teacher-1", roles: ["teacher"] });
    mocks.getMediaAssetForDelivery.mockResolvedValue({
      filePath: "/private/media/blob",
      byteSize: 4,
      mimeType: "image/png",
      originalName: "diagram.png"
    });
    mocks.createReadStream.mockReturnValue(Readable.from(Buffer.from("test")));
  });

  it("streams authenticated media without retaining it in the browser cache", async () => {
    const response = await GET({} as never, { params: Promise.resolve({ assetId: "asset-1" }) });

    expect(mocks.getMediaAssetForDelivery).toHaveBeenCalledWith(
      { id: "teacher-1", roles: ["teacher"] },
      "asset-1"
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    await expect(response.text()).resolves.toBe("test");
  });
});
