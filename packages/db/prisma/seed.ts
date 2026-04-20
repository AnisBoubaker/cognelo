import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { listActivityDefinitions, listActivityPlugins } from "@cognelo/activity-sdk";

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

  const admin = await upsertUser("admin@cognelo.local", "Ada Admin", ["admin"]);
  const teacher = await upsertUser("teacher@cognelo.local", "Terry Teacher", ["teacher"]);
  const student = await upsertUser("student@cognelo.local", "Sam Student", ["student"]);

  const activityTypesByKey = new Map<string, Awaited<ReturnType<typeof prisma.activityType.upsert>>>();
  const pluginKeyByActivityKey = new Map<string, string>();
  for (const plugin of listActivityPlugins()) {
    for (const definition of plugin.activities) {
      pluginKeyByActivityKey.set(definition.key, plugin.key);
      const activityType = await prisma.activityType.upsert({
        where: { key: definition.key },
        update: {
          name: definition.name,
          description: definition.description,
          metadata: { researchReady: true, plugin: plugin.key },
          isEnabled: true
        },
        create: {
          key: definition.key,
          name: definition.name,
          description: definition.description,
          metadata: { researchReady: true, plugin: plugin.key }
        }
      });
      activityTypesByKey.set(definition.key, activityType);
    }
  }

  const placeholderType = activityTypesByKey.get("placeholder");
  const parsonsType = activityTypesByKey.get("parsons-problem");
  const mcqType = activityTypesByKey.get("mcq");
  if (!placeholderType || !parsonsType || !mcqType) {
    throw new Error(`Missing seeded activity types from plugin registry: ${listActivityDefinitions().map((definition) => definition.key).join(", ")}`);
  }

  const course = await prisma.course.upsert({
    where: { id: "seed-course-programming-101" },
    update: {
      title: "Programming 101",
      description: "A sample course for the Cognelo ITS foundation.",
      status: "published"
    },
    create: {
      id: "seed-course-programming-101",
      title: "Programming 101",
      description: "A sample course for the Cognelo ITS foundation.",
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
      metadata: { researchTags: ["onboarding"], instrumented: false, plugin: pluginKeyByActivityKey.get("placeholder") },
      createdById: teacher.id
    }
  });

  await prisma.activity.upsert({
    where: { id: "seed-activity-parsons" },
    update: {
      title: "Loop over a list",
      description: "Put the code in order so it prints each name on its own line.",
      lifecycle: "published",
      config: {
        prompt: "Rebuild the Python program so it loops over the list and prints each name.",
        solution: [
          "names = ['Ada', 'Linus', 'Grace']",
          "",
          "for name in names:",
          "    print(name)"
        ].join("\n"),
        language: "python",
        stripIndentation: true,
        groups: [],
        precedenceRules: []
      },
      metadata: { researchTags: ["parsons", "loops"], instrumented: false, plugin: pluginKeyByActivityKey.get("parsons-problem") }
    },
    create: {
      id: "seed-activity-parsons",
      courseId: course.id,
      activityTypeId: parsonsType.id,
      title: "Loop over a list",
      description: "Put the code in order so it prints each name on its own line.",
      lifecycle: "published",
      config: {
        prompt: "Rebuild the Python program so it loops over the list and prints each name.",
        solution: [
          "names = ['Ada', 'Linus', 'Grace']",
          "",
          "for name in names:",
          "    print(name)"
        ].join("\n"),
        language: "python",
        stripIndentation: true,
        groups: [],
        precedenceRules: []
      },
      metadata: { researchTags: ["parsons", "loops"], instrumented: false, plugin: pluginKeyByActivityKey.get("parsons-problem") },
      createdById: teacher.id
    }
  });

  await prisma.activity.upsert({
    where: { id: "seed-activity-mcq" },
    update: {
      title: "Basic Python multiple choice questions",
      description: "Answer the questions by choosing the correct output or concept.",
      lifecycle: "published",
      config: {
        defaultCodeLanguage: "python",
        source: [
          "This short multiple choice questions activity checks Python basics.",
          "",
          "## Output prediction",
          "What does this program print?",
          "",
          "```python",
          "value = 2 * 3",
          "print(value)",
          "```",
          "",
          "- [ ] 5",
          "- [x] 6",
          "- [ ] 23",
          "",
          "## Choose the collection types",
          "Which of these are Python collection types?",
          "",
          "- [x] `list`",
          "- [x] `dict`",
          "- [ ] `switch`"
        ].join("\n")
      },
      metadata: { researchTags: ["mcq", "python-basics"], instrumented: false, plugin: pluginKeyByActivityKey.get("mcq") }
    },
    create: {
      id: "seed-activity-mcq",
      courseId: course.id,
      activityTypeId: mcqType.id,
      title: "Basic Python multiple choice questions",
      description: "Answer the questions by choosing the correct output or concept.",
      lifecycle: "published",
      config: {
        defaultCodeLanguage: "python",
        source: [
          "This short multiple choice questions activity checks Python basics.",
          "",
          "## Output prediction",
          "What does this program print?",
          "",
          "```python",
          "value = 2 * 3",
          "print(value)",
          "```",
          "",
          "- [ ] 5",
          "- [x] 6",
          "- [ ] 23",
          "",
          "## Choose the collection types",
          "Which of these are Python collection types?",
          "",
          "- [x] `list`",
          "- [x] `dict`",
          "- [ ] `switch`"
        ].join("\n")
      },
      metadata: { researchTags: ["mcq", "python-basics"], instrumented: false, plugin: pluginKeyByActivityKey.get("mcq") },
      createdById: teacher.id
    }
  });

  const group = await prisma.courseGroup.upsert({
    where: { id: "seed-group-programming-101-section-a" },
    update: {
      title: "Section A",
      description: "Monday lab group with its own launch notes and activity schedule.",
      status: "published",
      availableFrom: new Date("2026-04-20T13:00:00.000Z"),
      availableUntil: new Date("2026-05-30T03:59:00.000Z")
    },
    create: {
      id: "seed-group-programming-101-section-a",
      courseId: course.id,
      title: "Section A",
      description: "Monday lab group with its own launch notes and activity schedule.",
      status: "published",
      availableFrom: new Date("2026-04-20T13:00:00.000Z"),
      availableUntil: new Date("2026-05-30T03:59:00.000Z"),
      createdById: teacher.id
    }
  });

  await prisma.courseGroupMaterial.upsert({
    where: { id: "seed-group-material-checklist" },
    update: {
      title: "Section A checklist",
      kind: "markdown",
      body: "## Section A checklist\n\n- Bring your laptop\n- Open the starter repository\n- Start with the assigned activities below",
      metadata: { audience: "section-a" }
    },
    create: {
      id: "seed-group-material-checklist",
      groupId: group.id,
      title: "Section A checklist",
      kind: "markdown",
      body: "## Section A checklist\n\n- Bring your laptop\n- Open the starter repository\n- Start with the assigned activities below",
      metadata: { audience: "section-a" },
      createdById: teacher.id
    }
  });

  await prisma.courseGroupActivity.upsert({
    where: {
      groupId_activityId: {
        groupId: group.id,
        activityId: "seed-activity-parsons"
      }
    },
    update: {
      availableFrom: new Date("2026-04-20T13:00:00.000Z"),
      availableUntil: new Date("2026-05-01T03:59:00.000Z"),
      position: 0
    },
    create: {
      groupId: group.id,
      activityId: "seed-activity-parsons",
      availableFrom: new Date("2026-04-20T13:00:00.000Z"),
      availableUntil: new Date("2026-05-01T03:59:00.000Z"),
      position: 0
    }
  });

  await prisma.courseGroupActivity.upsert({
    where: {
      groupId_activityId: {
        groupId: group.id,
        activityId: "seed-activity-mcq"
      }
    },
    update: {
      availableFrom: new Date("2026-04-22T13:00:00.000Z"),
      availableUntil: new Date("2026-05-08T03:59:00.000Z"),
      position: 1
    },
    create: {
      groupId: group.id,
      activityId: "seed-activity-mcq",
      availableFrom: new Date("2026-04-22T13:00:00.000Z"),
      availableUntil: new Date("2026-05-08T03:59:00.000Z"),
      position: 1
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
