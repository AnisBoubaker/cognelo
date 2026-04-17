import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function upsertRole(key: string, name: string, description: string) {
  return prisma.role.upsert({
    where: { key },
    update: { name, description },
    create: { key, name, description }
  });
}

async function upsertUser(email: string, name: string, roleKeys: string[]) {
  const passwordHash = await bcrypt.hash("Password123!", 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, isActive: true },
    create: { email, name, passwordHash }
  });

  for (const key of roleKeys) {
    const role = await prisma.role.findUniqueOrThrow({ where: { key } });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id }
    });
  }

  return user;
}

async function main() {
  await upsertRole("admin", "Admin", "Full platform administration access.");
  await upsertRole("teacher", "Teacher", "Can create and manage courses and activities.");
  await upsertRole("student", "Student", "Can participate in enrolled courses.");

  const admin = await upsertUser("admin@cognara.local", "Ada Admin", ["admin"]);
  const teacher = await upsertUser("teacher@cognara.local", "Terry Teacher", ["teacher"]);
  const student = await upsertUser("student@cognara.local", "Sam Student", ["student"]);

  const placeholderType = await prisma.activityType.upsert({
    where: { key: "placeholder" },
    update: {
      name: "Placeholder activity",
      description: "A generic activity shell for course planning.",
      isEnabled: true
    },
    create: {
      key: "placeholder",
      name: "Placeholder activity",
      description: "A generic activity shell for course planning."
    }
  });

  await prisma.activityType.upsert({
    where: { key: "homework-grader" },
    update: {
      name: "Homework grader",
      description: "Future programming assignment submission and grading workflow.",
      metadata: { researchReady: true },
      isEnabled: true
    },
    create: {
      key: "homework-grader",
      name: "Homework grader",
      description: "Future programming assignment submission and grading workflow.",
      metadata: { researchReady: true }
    }
  });

  const course = await prisma.course.upsert({
    where: { id: "seed-course-programming-101" },
    update: {
      title: "Programming 101",
      description: "A sample course for the Cognara ITS foundation.",
      status: "published"
    },
    create: {
      id: "seed-course-programming-101",
      title: "Programming 101",
      description: "A sample course for the Cognara ITS foundation.",
      status: "published",
      createdById: teacher.id
    }
  });

  for (const membership of [
    { userId: teacher.id, role: "owner" as const },
    { userId: student.id, role: "student" as const },
    { userId: admin.id, role: "teacher" as const }
  ]) {
    await prisma.courseMembership.upsert({
      where: {
        courseId_userId_role: {
          courseId: course.id,
          userId: membership.userId,
          role: membership.role
        }
      },
      update: {},
      create: {
        courseId: course.id,
        userId: membership.userId,
        role: membership.role
      }
    });
  }

  await prisma.courseMaterial.upsert({
    where: { id: "seed-material-welcome" },
    update: {
      title: "Welcome",
      kind: "markdown",
      body: "## Welcome\n\nStart here before attempting the first activity.",
      metadata: { module: "orientation" }
    },
    create: {
      id: "seed-material-welcome",
      courseId: course.id,
      title: "Welcome",
      kind: "markdown",
      body: "## Welcome\n\nStart here before attempting the first activity.",
      metadata: { module: "orientation" },
      createdById: teacher.id
    }
  });

  await prisma.activity.upsert({
    where: { id: "seed-activity-placeholder" },
    update: {
      title: "First programming reflection",
      lifecycle: "published",
      metadata: { researchTags: ["onboarding"], instrumented: false }
    },
    create: {
      id: "seed-activity-placeholder",
      courseId: course.id,
      activityTypeId: placeholderType.id,
      title: "First programming reflection",
      description: "A placeholder activity attached to the sample course.",
      lifecycle: "published",
      config: {},
      metadata: { researchTags: ["onboarding"], instrumented: false },
      createdById: teacher.id
    }
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
