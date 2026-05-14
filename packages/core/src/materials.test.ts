import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  courseMaterial: {
    create: vi.fn(),
    delete: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn()
  }
}));

vi.mock("@cognelo/db", () => ({
  prisma: mockPrisma,
  Prisma: {}
}));

vi.mock("./authorization", () => ({
  assertCanManageCourse: vi.fn(),
  assertCanViewCourse: vi.fn()
}));

const { createMaterial, deleteMaterial, getMaterialForDownload, listMaterials, updateMaterial } = await import("./materials");

const testUser = {
  id: "user-1",
  email: "teacher@example.test",
  name: null,
  firstName: null,
  lastName: null,
  roles: ["teacher" as const]
};

describe("material services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates course material with the course id and creator", async () => {
    mockPrisma.courseMaterial.create.mockResolvedValue({ id: "material-1" });

    await expect(
      createMaterial(testUser, "course-1", {
        title: "Syllabus",
        kind: "folder",
        metadata: { week: 1 }
      })
    ).resolves.toEqual({ id: "material-1" });

    expect(mockPrisma.courseMaterial.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        courseId: "course-1",
        createdById: "user-1",
        title: "Syllabus",
        kind: "folder",
        metadata: { week: 1 }
      })
    });
  });

  it("lists course materials in tree order", async () => {
    mockPrisma.courseMaterial.findMany.mockResolvedValue([{ id: "folder-1" }, { id: "file-1" }]);

    await expect(listMaterials(testUser, "course-1")).resolves.toEqual([{ id: "folder-1" }, { id: "file-1" }]);
    expect(mockPrisma.courseMaterial.findMany).toHaveBeenCalledWith({
      where: { courseId: "course-1" },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }]
    });
  });

  it("downloads only file materials belonging to the course", async () => {
    mockPrisma.courseMaterial.findFirst.mockResolvedValue({ id: "material-1", kind: "file" });

    await expect(getMaterialForDownload(testUser, "course-1", "material-1")).resolves.toEqual({ id: "material-1", kind: "file" });
    expect(mockPrisma.courseMaterial.findFirst).toHaveBeenCalledWith({
      where: { id: "material-1", courseId: "course-1", kind: "file" }
    });
  });

  it("rejects moving a material inside itself", async () => {
    mockPrisma.courseMaterial.findFirst.mockResolvedValue({ id: "material-1", courseId: "course-1" });

    await expect(updateMaterial(testUser, "course-1", "material-1", { parentId: "material-1" })).rejects.toMatchObject({
      status: 400,
      code: "INVALID_MATERIAL_PARENT"
    });

    expect(mockPrisma.courseMaterial.update).not.toHaveBeenCalled();
  });

  it("requires the parent to be an existing folder in the same course", async () => {
    mockPrisma.courseMaterial.findFirst
      .mockResolvedValueOnce({ id: "material-1", courseId: "course-1" })
      .mockResolvedValueOnce(null);

    await expect(updateMaterial(testUser, "course-1", "material-1", { parentId: "missing-folder" })).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND"
    });
  });

  it("deletes only materials belonging to the course", async () => {
    mockPrisma.courseMaterial.findFirst.mockResolvedValue({ id: "material-1", courseId: "course-1" });

    await expect(deleteMaterial(testUser, "course-1", "material-1")).resolves.toEqual({ ok: true });
    expect(mockPrisma.courseMaterial.delete).toHaveBeenCalledWith({ where: { id: "material-1" } });
  });

  it("updates material title, URL, and metadata after validating its scope", async () => {
    mockPrisma.courseMaterial.findFirst.mockResolvedValue({ id: "material-1", courseId: "course-1" });
    mockPrisma.courseMaterial.update.mockResolvedValue({ id: "material-1", title: "Updated" });

    await updateMaterial(testUser, "course-1", "material-1", {
      title: "Updated",
      kind: "github_repo",
      url: "https://github.com/example/repo",
      metadata: { week: 2 }
    });

    expect(mockPrisma.courseMaterial.update).toHaveBeenCalledWith({
      where: { id: "material-1" },
      data: expect.objectContaining({
        title: "Updated",
        kind: "github_repo",
        url: "https://github.com/example/repo",
        metadata: { week: 2 }
      })
    });
  });
});
