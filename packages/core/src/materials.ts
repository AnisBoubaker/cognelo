import { CourseMaterialInputSchema, CourseMaterialUpdateSchema } from "@cognara/contracts";
import { Prisma, prisma } from "@cognara/db";
import type { CurrentUser } from "@cognara/contracts";
import { assertCanManageCourse, assertCanViewCourse } from "./authorization";
import { notFound } from "./errors";

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
  return prisma.courseMaterial.create({
    data: { ...data, metadata: data.metadata as Prisma.InputJsonValue, courseId, createdById: user.id }
  });
}

export async function updateMaterial(user: CurrentUser, courseId: string, materialId: string, input: unknown) {
  await assertCanManageCourse(user, courseId);
  const data = CourseMaterialUpdateSchema.parse(input);
  const material = await prisma.courseMaterial.findFirst({ where: { id: materialId, courseId } });
  if (!material) {
    throw notFound("Course material");
  }
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
