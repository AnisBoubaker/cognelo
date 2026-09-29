import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enqueue: vi.fn(),
  getJob: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn()
}));

vi.mock("@/lib/activity-variations", () => ({
  enqueueActivityVariation: mocks.enqueue,
  getActivityVariationJob: mocks.getJob
}));
vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { GET, POST } = await import("./route");

describe("bank activity variation route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "teacher-1", roles: ["teacher"] });
    mocks.readJson.mockResolvedValue({ title: "Loops (variation)", instructions: "Use arrays", locale: "en" });
    mocks.enqueue.mockResolvedValue({ id: "job-1", status: "queued" });
    mocks.getJob.mockResolvedValue({ id: "job-1", status: "running", progress: { completed: 1, total: 3 } });
  });

  it("starts a background variation job", async () => {
    const response = await POST(new Request("http://test.local", { method: "POST", body: "{}" }) as never, {
      params: Promise.resolve({ activityBankId: "bank-1", bankActivityId: "activity-1" })
    });

    expect(response.status).toBe(202);
    expect(mocks.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ id: "teacher-1" }),
      "bank-1",
      "activity-1",
      { title: "Loops (variation)", instructions: "Use arrays", locale: "en" }
    );
  });

  it("returns owned job progress", async () => {
    const request = new Request("http://test.local?jobId=job-1") as never;
    Object.defineProperty(request, "nextUrl", { value: new URL("http://test.local?jobId=job-1") });
    const response = await GET(request, {
      params: Promise.resolve({ activityBankId: "bank-1", bankActivityId: "activity-1" })
    });

    expect(response.status).toBe(200);
    expect(mocks.getJob).toHaveBeenCalledWith(expect.objectContaining({ id: "teacher-1" }), "bank-1", "activity-1", "job-1");
  });
});
