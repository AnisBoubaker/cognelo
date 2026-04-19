import { CourseMaterialInputSchema, CourseMaterialUpdateSchema } from "@cognelo/contracts";
import { Prisma, prisma } from "@cognelo/db";
import type { CurrentUser } from "@cognelo/contracts";
import { assertCanManageCourse, assertCanViewCourse } from "./authorization";
import { AppError, notFound } from "./errors";

export async function listMaterials(user: CurrentUser, courseId: string) {
  await assertCanViewCourse(user, courseId);
  return prisma.courseMaterial.findMany({
    where: { courseId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }]
  });
}

export async function createMaterial(user: CurrentUser, courseId: string, input: unknown) {
  await assertCanManageCourse(user, courseId);
  const data = CourseMaterialInputSchema.parse(input);
  await assertValidParent(courseId, data.parentId);
  return prisma.courseMaterial.create({
    data: { ...data, metadata: data.metadata as Prisma.InputJsonValue, courseId, createdById: user.id }
  });
}

export async function getMaterialForDownload(user: CurrentUser, courseId: string, materialId: string) {
  await assertCanViewCourse(user, courseId);
  const material = await prisma.courseMaterial.findFirst({ where: { id: materialId, courseId, kind: "file" } });
  if (!material) {
    throw notFound("Course material");
  }
  return material;
}

export async function updateMaterial(user: CurrentUser, courseId: string, materialId: string, input: unknown) {
  await assertCanManageCourse(user, courseId);
  const data = CourseMaterialUpdateSchema.parse(input);
  const material = await prisma.courseMaterial.findFirst({ where: { id: materialId, courseId } });
  if (!material) {
    throw notFound("Course material");
  }
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
