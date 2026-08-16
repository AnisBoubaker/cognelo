import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";

const duplicateHandler = vi.hoisted(() => vi.fn());
const transaction = vi.hoisted(() => ({
  courseContentItem: { create: vi.fn() }, courseContentResource: { create: vi.fn() }, courseMaterial: { create: vi.fn() }
}));
const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(async (handler: (client: typeof transaction) => unknown) => handler(transaction)),
  courseContentItem: { count: vi.fn(), findFirst: vi.fn() }
}));
vi.mock("@cognelo/db", () => ({ prisma: mockPrisma, Prisma: {} }));
vi.mock("@cognelo/content-type-sdk", () => ({ getContentTypePluginForType: vi.fn() }));
vi.mock("@cognelo/content-type-sdk/server", () => ({ getServerContentTypePlugin: vi.fn(() => ({ handlers: { duplicate: duplicateHandler } })) }));
vi.mock("./plugins", () => ({ assertContentResourcePluginActive: vi.fn(), assertContentTypePluginEnabled: vi.fn() }));

const { duplicateCourseContentItem } = await import("./course-content");
const admin: CurrentUser = { id: "admin-1", email: "admin@example.test", name: null, firstName: null, lastName: null, roles: ["admin"] };

describe("duplicateCourseContentItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (handler: (client: typeof transaction) => unknown) => handler(transaction));
  });

  it("duplicates a plugin resource into the same folder and visibility", async () => {
    const resource = { id: "resource-1", courseId: "course-1", groupId: null, contentTypeKey: "text", pluginKey: "text-content", title: "Notes", metadata: { body: "Hello" } };
    mockPrisma.courseContentItem.findFirst.mockResolvedValue({ id: "content-1", parentId: "folder-1", isVisible: false, metadata: { accent: "blue" }, contentResource: resource, material: null });
    mockPrisma.courseContentItem.count.mockResolvedValue(3);
    duplicateHandler.mockResolvedValue({ title: "Notes (copy)", metadata: { body: "Hello" } });
    transaction.courseContentResource.create.mockResolvedValue({ id: "resource-2" });
    transaction.courseContentItem.create.mockResolvedValue({ id: "content-2" });

    await duplicateCourseContentItem(admin, "course-1", "content-1", { title: "Notes (copy)" });
    expect(duplicateHandler).toHaveBeenCalledWith(expect.objectContaining({ title: "Notes (copy)", resource: expect.objectContaining({ id: "resource-1" }) }));
    expect(transaction.courseContentItem.create).toHaveBeenCalledWith({ data: expect.objectContaining({ parentId: "folder-1", position: 3, isVisible: false, contentResourceId: "resource-2" }) });
  });
});
