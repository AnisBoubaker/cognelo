import { listContentItems } from "./course-content";
import { assertMaterialStorageUnchanged } from "./material-storage";
import { CourseMaterialInputSchema, CourseMaterialUpdateSchema } from "@cognelo/contracts";
import { Prisma, prisma } from "@cognelo/db";
import type { CurrentUser } from "@cognelo/contracts";
import { assertCanManageCourse, assertCanViewCourse, canManageCourse } from "./authorization";
import { AppError, notFound } from "./errors";

export async function listMaterials(user: CurrentUser, courseId: string) {
  await assertCanViewCourse(user, courseId);
  const materials = await prisma.courseMaterial.findMany({
    where: { courseId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }]
  });
  if (await canManageCourse(user, courseId)) return materials;
  const visible = new Set((await listContentItems(user, courseId, { visibleOnly: true })).map((item) => item.materialId));
  return materials.filter((material) => visible.has(material.id));
}

export async function createMaterial(user: CurrentUser, courseId: string, input: unknown, serverUpload = false) {
  await assertCanManageCourse(user, courseId);
  const data = CourseMaterialInputSchema.parse(input);
  assertMaterialStorageUnchanged(data.metadata, null, serverUpload);
  await assertValidParent(courseId, data.parentId);
  return prisma.courseMaterial.create({
    data: { ...data, metadata: data.metadata as Prisma.InputJsonValue, courseId, createdById: user.id }
  });
}

export async function getMaterialForDownload(user: CurrentUser, courseId: string, materialId: string) {
  await assertCanViewCourse(user, courseId);
  if (!(await canManageCourse(user, courseId)) && !(await listContentItems(user, courseId, { visibleOnly: true })).some((item) => item.materialId === materialId)) throw notFound("Course material");
  const material = await prisma.courseMaterial.findFirst({ where: { id: materialId, courseId, kind: "file" } });
  if (!material) {
    throw notFound("Course material");
  }
  return material;
}

export async function updateMaterial(user: CurrentUser, courseId: string, materialId: string, input: unknown, serverUpload = false) {
  await assertCanManageCourse(user, courseId);
  const data = CourseMaterialUpdateSchema.parse(input);
  const material = await prisma.courseMaterial.findFirst({ where: { id: materialId, courseId } });
  if (!material) {
    throw notFound("Course material");
  }
  assertMaterialStorageUnchanged(data.metadata, material.metadata, serverUpload);
  if (data.parentId === materialId) {
    throw new AppError(400, "INVALID_MATERIAL_PARENT", "A material cannot be moved inside itself.");
  }
  await assertValidParent(courseId, data.parentId);
  return prisma.courseMaterial.update({
    where: { id: materialId },
    data: { ...data, metadata: data.metadata as Prisma.InputJsonValue | undefined }
  });
}

export async function deleteMaterial(user: CurrentUser, courseId: string, materialId: string) {
  await assertCanManageCourse(user, courseId);
  const material = await prisma.courseMaterial.findFirst({ where: { id: materialId, courseId } });
  if (!material) {
    throw notFound("Course material");
  }
  await prisma.courseMaterial.delete({ where: { id: materialId } });
  return { ok: true };
}

async function assertValidParent(courseId: string, parentId: string | null | undefined) {
  if (!parentId) {
    return;
  }

  const parent = await prisma.courseMaterial.findFirst({ where: { id: parentId, courseId, kind: "folder" } });
  if (!parent) {
    throw notFound("Parent folder");
  }
}

/** Authorize URL targets before reading multipart bytes; validate parents before staging. */
export async function assertMaterialUploadTarget(user: CurrentUser, courseId: string, scope: { groupId?: string; materialId?: string; parentId?: string | null } = {}) {
  await assertCanManageCourse(user, courseId);
  if (scope.groupId && !await prisma.courseGroup.findFirst({ where: { id: scope.groupId, courseId }, select: { id: true } })) throw notFound("Course group");
  if (scope.materialId && !await prisma.courseMaterial.findFirst({ where: { id: scope.materialId, courseId }, select: { id: true } })) throw notFound("Course material");
  if (scope.parentId) {
    const parent = scope.groupId
      ? await prisma.courseGroupMaterial.findFirst({ where: { id: scope.parentId, groupId: scope.groupId, kind: "folder" }, select: { id: true } })
      : await prisma.courseMaterial.findFirst({ where: { id: scope.parentId, courseId, kind: "folder" }, select: { id: true } });
    if (!parent) throw notFound("Parent folder");
  }
}
