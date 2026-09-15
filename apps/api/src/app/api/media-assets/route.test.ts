import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  uploadMediaImage: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  AppError: class AppError extends Error {
    constructor(public status: number, public code: string, message: string) {
      super(message);
    }
  },
  uploadMediaImage: mocks.uploadMediaImage
}));

vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  requireUser: mocks.requireUser
}));

const { POST } = await import("./route");

describe("media assets upload route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "teacher-1", roles: ["teacher"] });
    mocks.uploadMediaImage.mockResolvedValue({
      id: "asset-1",
      url: "/api/media-assets/asset-1/content",
      originalName: "diagram.png",
      mimeType: "image/png",
      byteSize: 8
    });
  });

  it("uploads one multipart image as a staged media asset", async () => {
    const file = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "diagram.png", { type: "image/png" });
    const response = await POST({ formData: async () => new Map([["file", file]]) } as never);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      asset: expect.objectContaining({ id: "asset-1", url: "/api/media-assets/asset-1/content" })
    });
    expect(mocks.uploadMediaImage).toHaveBeenCalledWith({ id: "teacher-1", roles: ["teacher"] }, file);
  });
});
