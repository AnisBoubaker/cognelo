import bcrypt from "bcryptjs";
import { Prisma, PrismaClient } from "@prisma/client";
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

async function upsertBankActivityWithVersion(params: {
  id: string;
  bankId: string;
  activityTypeId: string;
  title: string;
  description: string;
  lifecycle: "draft" | "published" | "paused" | "archived";
  config: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdById: string;
  position?: number;
}) {
  const bankActivity = await prisma.bankActivity.upsert({
    where: { id: params.id },
    update: {
      activityTypeId: params.activityTypeId,
      title: params.title,
      description: params.description,
      lifecycle: params.lifecycle,
      config: params.config as Prisma.InputJsonValue,
      metadata: params.metadata as Prisma.InputJsonValue,
      position: params.position ?? 0,
      currentVersionId: null
    },
    create: {
      id: params.id,
      bankId: params.bankId,
      activityTypeId: params.activityTypeId,
      title: params.title,
      description: params.description,
      lifecycle: params.lifecycle,
      config: params.config as Prisma.InputJsonValue,
      metadata: params.metadata as Prisma.InputJsonValue,
      position: params.position ?? 0,
      createdById: params.createdById
    }
  });

  const version = await prisma.activityVersion.upsert({
    where: {
      bankActivityId_versionNumber: {
        bankActivityId: bankActivity.id,
        versionNumber: 1
      }
    },
    update: {
      activityTypeId: params.activityTypeId,
      title: params.title,
      description: params.description,
      lifecycle: params.lifecycle,
      config: params.config as Prisma.InputJsonValue,
      metadata: params.metadata as Prisma.InputJsonValue
    },
    create: {
      bankActivityId: bankActivity.id,
      versionNumber: 1,
      activityTypeId: params.activityTypeId,
      title: params.title,
      description: params.description,
      lifecycle: params.lifecycle,
      config: params.config as Prisma.InputJsonValue,
      metadata: params.metadata as Prisma.InputJsonValue,
      createdById: params.createdById
    }
  });

  await prisma.bankActivity.update({
    where: { id: bankActivity.id },
    data: { currentVersionId: version.id }
  });

  return { bankActivity, version };
}

async function main() {
  await upsertRole("admin", "Admin", "Full platform administration access.");
  await upsertRole("course_manager", "Course manager", "Can create subjects and courses.");
  await upsertRole("teacher", "Teacher", "Can create and manage courses and activities.");
  await upsertRole("student", "Student", "Can participate in enrolled courses.");

  const admin = await upsertUser("admin@cognelo.local", "Ada Admin", ["admin"]);
  const teacher = await upsertUser("teacher@cognelo.local", "Terry Teacher", ["course_manager", "teacher"]);
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
  const codingExerciseType = activityTypesByKey.get("coding-exercise");
  const webDesignExerciseType = activityTypesByKey.get("web-design-coding-exercise");
  const missingSeededActivityTypes = listActivityDefinitions()
    .map((definition) => definition.key)
    .filter((key) => !activityTypesByKey.has(key));
  if (!placeholderType || !parsonsType || !mcqType || !codingExerciseType || !webDesignExerciseType || missingSeededActivityTypes.length > 0) {
    throw new Error(`Missing seeded activity types from plugin registry: ${missingSeededActivityTypes.join(", ")}`);
  }

  const subject = await prisma.subject.upsert({
    where: { id: "seed-subject-programming" },
    update: {
      title: "Programming",
      description: "Shared programming curriculum materials and activity banks."
    },
    create: {
      id: "seed-subject-programming",
      title: "Programming",
      description: "Shared programming curriculum materials and activity banks.",
      createdById: teacher.id
    }
  });

  const programmingBasicsBank = await prisma.activityBank.upsert({
    where: { id: "seed-bank-programming-basics" },
    update: {
      title: "Programming basics",
      description: "Reusable introductory programming activities.",
      ownerId: teacher.id
    },
    create: {
      id: "seed-bank-programming-basics",
      subjectId: subject.id,
      title: "Programming basics",
      description: "Reusable introductory programming activities.",
      ownerId: teacher.id
    }
  });

  const placeholderSeed = await upsertBankActivityWithVersion({
    id: "seed-bank-activity-placeholder",
    bankId: programmingBasicsBank.id,
    activityTypeId: placeholderType.id,
    title: "First programming reflection",
    description: "A reusable placeholder activity for course onboarding.",
    lifecycle: "published",
    config: {},
    metadata: { researchTags: ["onboarding"], instrumented: false, plugin: pluginKeyByActivityKey.get("placeholder") },
    createdById: teacher.id,
    position: 0
  });

  const parsonsConfig = {
    prompt: "Rebuild the Python program so it loops over the list and prints each name.",
    solution: ["names = ['Ada', 'Linus', 'Grace']", "", "for name in names:", "    print(name)"].join("\n"),
    language: "python",
    stripIndentation: true,
    groups: [],
    precedenceRules: []
  };
  const parsonsSeed = await upsertBankActivityWithVersion({
    id: "seed-bank-activity-parsons-loop",
    bankId: programmingBasicsBank.id,
    activityTypeId: parsonsType.id,
    title: "Loop over a list",
    description: "Put the code in order so it prints each name on its own line.",
    lifecycle: "published",
    config: parsonsConfig,
    metadata: { researchTags: ["parsons", "loops"], instrumented: false, plugin: pluginKeyByActivityKey.get("parsons-problem") },
    createdById: teacher.id,
    position: 1
  });

  const codingConfig = {
    prompt: [
      "Write the statements that belong inside `main`.",
      "A hidden C helper named `print_boxed(const char* text)` is available.",
      'Call it twice so the program prints boxed lines for `Ready` and `Go!` in that order.'
    ].join("\n\n"),
    language: "c",
    executionMode: "template",
    starterCode: ['print_boxed("...");', 'print_boxed("...");'].join("\n"),
    studentTemplateSource: [
      "#include <stdio.h>",
      "",
      "void print_boxed(const char *text);",
      "// Hidden code",
      "int main(void) {",
      "{{ STUDENT_CODE }}",
      "  return 0;",
      "}"
    ].join("\n"),
    sampleTests: [
      {
        id: "sample-1",
        input: "",
        output: "[[ Ready ]]\n[[ Go! ]]",
        testCode: "",
        title: "Prints the two boxed lines"
      }
    ],
    maxEditorSeconds: 1800
  };
  const codingSeed = await upsertBankActivityWithVersion({
    id: "seed-bank-activity-coding-template",
    bankId: programmingBasicsBank.id,
    activityTypeId: codingExerciseType.id,
    title: "Write the body of main with a hidden C helper",
    description: "Write only the statements that belong inside `main`. A hidden helper `print_boxed(const char* text)` is available.",
    lifecycle: "published",
    config: codingConfig,
    metadata: { researchTags: ["coding-exercise", "template", "c"], instrumented: false, plugin: pluginKeyByActivityKey.get("coding-exercise") },
    createdById: teacher.id,
    position: 2
  });

  const webDesignFiles = [
    {
      id: "index-html",
      path: "index.html",
      language: "html",
      starterCode:
        '<main class="page">\n  <h1>Design a profile card</h1>\n  <article class="card">\n    <h2>Ada Lovelace</h2>\n    <p>Build a polished card with layout, color, and interaction.</p>\n    <button>Follow</button>\n  </article>\n</main>',
      isEditable: true,
      orderIndex: 0
    },
    {
      id: "styles-css",
      path: "styles.css",
      language: "css",
      starterCode:
        "body {\n  margin: 0;\n  font-family: system-ui, sans-serif;\n  background: #f4f7fb;\n  color: #162033;\n}\n\n.page {\n  min-height: 100vh;\n  display: grid;\n  place-items: center;\n  gap: 1rem;\n}\n\n.card {\n  width: min(320px, 90vw);\n  padding: 1.25rem;\n  border: 1px solid #d7deea;\n  border-radius: 8px;\n  background: white;\n}\n\nbutton {\n  border: 0;\n  border-radius: 6px;\n  padding: 0.65rem 1rem;\n  background: #2454d6;\n  color: white;\n}",
      isEditable: true,
      orderIndex: 1
    },
    {
      id: "script-js",
      path: "script.js",
      language: "javascript",
      starterCode:
        'const button = document.querySelector("button");\n\nbutton?.addEventListener("click", () => {\n  button.textContent = button.textContent === "Follow" ? "Following" : "Follow";\n});',
      isEditable: true,
      orderIndex: 2
    }
  ];
  const webDesignConfig = {
    prompt:
      "Create a responsive profile card. Use HTML for structure, CSS for layout and polish, and JavaScript for the button interaction.\n\nExpected result:\n\n{{ EXPECTED_RESULT_CROPPED }}",
    files: webDesignFiles,
    previewEntry: "index.html",
    maxEditorSeconds: 1800
  };
  const webDesignSeed = await upsertBankActivityWithVersion({
    id: "seed-bank-activity-web-design-profile-card",
    bankId: programmingBasicsBank.id,
    activityTypeId: webDesignExerciseType.id,
    title: "Responsive profile card",
    description: "Build a small HTML, CSS, and JavaScript profile card with a Follow button interaction.",
    lifecycle: "published",
    config: webDesignConfig,
    metadata: {
      researchTags: ["web-design", "html", "css", "javascript"],
      instrumented: false,
      plugin: pluginKeyByActivityKey.get("web-design-coding-exercise")
    },
    createdById: teacher.id,
    position: 3
  });

  const course = await prisma.course.upsert({
    where: { id: "seed-course-programming-101" },
    update: {
      subjectId: subject.id,
      title: "Programming 101",
      description: "A sample course for the Cognelo ITS foundation.",
      status: "published"
    },
    create: {
      id: "seed-course-programming-101",
      subjectId: subject.id,
      title: "Programming 101",
      description: "A sample course for the Cognelo ITS foundation.",
      status: "published",
      createdById: teacher.id
    }
  });

  const seededCodingActivityIds = [
    "seed-activity-coding-template"
  ] as const;

  await prisma.activity.deleteMany({
    where: {
      courseId: course.id,
      id: { in: [...seededCodingActivityIds] }
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
      bankActivityId: placeholderSeed.bankActivity.id,
      activityVersionId: placeholderSeed.version.id,
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
      bankActivityId: placeholderSeed.bankActivity.id,
      activityVersionId: placeholderSeed.version.id,
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
      config: parsonsConfig,
      bankActivityId: parsonsSeed.bankActivity.id,
      activityVersionId: parsonsSeed.version.id,
      metadata: { researchTags: ["parsons", "loops"], instrumented: false, plugin: pluginKeyByActivityKey.get("parsons-problem") }
    },
    create: {
      id: "seed-activity-parsons",
      courseId: course.id,
      activityTypeId: parsonsType.id,
      title: "Loop over a list",
      description: "Put the code in order so it prints each name on its own line.",
      lifecycle: "published",
      config: parsonsConfig,
      bankActivityId: parsonsSeed.bankActivity.id,
      activityVersionId: parsonsSeed.version.id,
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

  await prisma.activity.upsert({
    where: { id: "seed-activity-coding-template" },
    update: {
      title: "Write the body of main with a hidden C helper",
      description: "Write only the statements that belong inside `main`. A hidden helper `print_boxed(const char* text)` is available.",
      lifecycle: "published",
      config: codingConfig,
      bankActivityId: codingSeed.bankActivity.id,
      activityVersionId: codingSeed.version.id,
      metadata: { researchTags: ["coding-exercise", "template", "c"], instrumented: false, plugin: pluginKeyByActivityKey.get("coding-exercise") }
    },
    create: {
      id: "seed-activity-coding-template",
      courseId: course.id,
      activityTypeId: codingExerciseType.id,
      title: "Write the body of main with a hidden C helper",
      description: "Write only the statements that belong inside `main`. A hidden helper `print_boxed(const char* text)` is available.",
      lifecycle: "published",
      config: codingConfig,
      bankActivityId: codingSeed.bankActivity.id,
      activityVersionId: codingSeed.version.id,
      metadata: { researchTags: ["coding-exercise", "template", "c"], instrumented: false, plugin: pluginKeyByActivityKey.get("coding-exercise") },
      createdById: teacher.id
    }
  });

  await prisma.activity.upsert({
    where: { id: "seed-activity-web-design-profile-card" },
    update: {
      title: "Responsive profile card",
      description: "Build a small HTML, CSS, and JavaScript profile card with a Follow button interaction.",
      lifecycle: "published",
      config: webDesignConfig,
      bankActivityId: webDesignSeed.bankActivity.id,
      activityVersionId: webDesignSeed.version.id,
      metadata: {
        researchTags: ["web-design", "html", "css", "javascript"],
        instrumented: false,
        plugin: pluginKeyByActivityKey.get("web-design-coding-exercise")
      }
    },
    create: {
      id: "seed-activity-web-design-profile-card",
      courseId: course.id,
      activityTypeId: webDesignExerciseType.id,
      title: "Responsive profile card",
      description: "Build a small HTML, CSS, and JavaScript profile card with a Follow button interaction.",
      lifecycle: "published",
      config: webDesignConfig,
      bankActivityId: webDesignSeed.bankActivity.id,
      activityVersionId: webDesignSeed.version.id,
      metadata: {
        researchTags: ["web-design", "html", "css", "javascript"],
        instrumented: false,
        plugin: pluginKeyByActivityKey.get("web-design-coding-exercise")
      },
      createdById: teacher.id
    }
  });

  await prisma.pluginCodingExerciseReferenceSolution.upsert({
    where: { activityId: "seed-activity-coding-template" },
    update: {
      sourceCode: ['  print_boxed("Ready");', '  print_boxed("Go!");'].join("\n"),
      privateConfig: {
        hiddenSupportCode: "",
        templateSource: [
          "#include <stdio.h>",
          "",
          "void print_boxed(const char *text);",
          "",
          "void print_boxed(const char *text) {",
          '  printf("[[ %s ]]\\n", text);',
          "}",
          "",
          "int main(void) {",
          "  {{ STUDENT_CODE }}",
          "  return 0;",
          "}"
        ].join("\n"),
        templateVisibleLineNumbers: [0, 1, 2, 6, 8, 9],
        templatePrefix: ["#include <stdio.h>", "", "void print_boxed(const char *text);", "", "void print_boxed(const char *text) {", '  printf("[[ %s ]]\\n", text);', "}", "", "int main(void) {"].join("\n"),
        templateSuffix: ["  return 0;", "}"].join("\n")
      },
      validationSummary: {}
    },
    create: {
      activityId: "seed-activity-coding-template",
      sourceCode: ['  print_boxed("Ready");', '  print_boxed("Go!");'].join("\n"),
      privateConfig: {
        hiddenSupportCode: "",
        templateSource: [
          "#include <stdio.h>",
          "",
          "void print_boxed(const char *text);",
          "",
          "void print_boxed(const char *text) {",
          '  printf("[[ %s ]]\\n", text);',
          "}",
          "",
          "int main(void) {",
          "  {{ STUDENT_CODE }}",
          "  return 0;",
          "}"
        ].join("\n"),
        templateVisibleLineNumbers: [0, 1, 2, 6, 8, 9],
        templatePrefix: ["#include <stdio.h>", "", "void print_boxed(const char *text);", "", "void print_boxed(const char *text) {", '  printf("[[ %s ]]\\n", text);', "}", "", "int main(void) {"].join("\n"),
        templateSuffix: ["  return 0;", "}"].join("\n")
      },
      validationSummary: {}
    }
  });

  for (const hiddenTest of [
    {
      id: "seed-hidden-template-1",
      activityId: "seed-activity-coding-template",
      name: "Prints the required boxed lines",
      expectedOutput: "[[ Ready ]]\n[[ Go! ]]",
      orderIndex: 0
    },
    {
      id: "seed-hidden-template-2",
      activityId: "seed-activity-coding-template",
      name: "No extra output",
      expectedOutput: "[[ Ready ]]\n[[ Go! ]]",
      orderIndex: 1
    }
  ]) {
    await prisma.pluginCodingExerciseHiddenTest.upsert({
      where: { id: hiddenTest.id },
      update: {
        activityId: hiddenTest.activityId,
        name: hiddenTest.name,
        stdin: "",
        expectedOutput: hiddenTest.expectedOutput,
        orderIndex: hiddenTest.orderIndex,
        isEnabled: true,
        weight: 1,
        metadata: { testCode: "" }
      },
      create: {
        id: hiddenTest.id,
        activityId: hiddenTest.activityId,
        name: hiddenTest.name,
        stdin: "",
        expectedOutput: hiddenTest.expectedOutput,
        orderIndex: hiddenTest.orderIndex,
        isEnabled: true,
        weight: 1,
        metadata: { testCode: "" }
      }
    });
  }

  await prisma.pluginWebDesignExerciseReferenceBundle.upsert({
    where: { activityId: "seed-activity-web-design-profile-card" },
    update: {
      files: webDesignFiles,
      validationSummary: {}
    },
    create: {
      activityId: "seed-activity-web-design-profile-card",
      files: webDesignFiles,
      validationSummary: {}
    }
  });

  await prisma.pluginBankWebDesignExerciseReferenceBundle.upsert({
    where: { bankActivityId: webDesignSeed.bankActivity.id },
    update: {
      files: webDesignFiles,
      validationSummary: {}
    },
    create: {
      bankActivityId: webDesignSeed.bankActivity.id,
      files: webDesignFiles,
      validationSummary: {}
    }
  });

  for (const test of [
    {
      id: "seed-web-design-test-heading",
      activityId: "seed-activity-web-design-profile-card",
      bankActivityId: webDesignSeed.bankActivity.id,
      name: "Shows the profile card heading",
      kind: "sample" as const,
      testCode: 'await expect(page.getByRole("heading", { name: "Ada Lovelace" })).toBeVisible();',
      orderIndex: 0
    },
    {
      id: "seed-web-design-test-button-toggle",
      activityId: "seed-activity-web-design-profile-card",
      bankActivityId: webDesignSeed.bankActivity.id,
      name: "Toggles the follow button",
      kind: "hidden" as const,
      testCode: [
        'const button = page.getByRole("button", { name: "Follow" });',
        "await button.click();",
        'await expect(button).toHaveText("Following");'
      ].join("\n"),
      orderIndex: 1
    }
  ]) {
    await prisma.pluginWebDesignExerciseTest.upsert({
      where: { id: test.id },
      update: {
        activityId: test.activityId,
        name: test.name,
        kind: test.kind,
        testCode: test.testCode,
        orderIndex: test.orderIndex,
        isEnabled: true,
        weight: 1,
        metadata: {},
        validationSummary: {}
      },
      create: {
        id: test.id,
        activityId: test.activityId,
        name: test.name,
        kind: test.kind,
        testCode: test.testCode,
        orderIndex: test.orderIndex,
        isEnabled: true,
        weight: 1,
        metadata: {},
        validationSummary: {}
      }
    });

    await prisma.pluginBankWebDesignExerciseTest.upsert({
      where: { id: `bank-${test.id}` },
      update: {
        bankActivityId: test.bankActivityId,
        name: test.name,
        kind: test.kind,
        testCode: test.testCode,
        orderIndex: test.orderIndex,
        isEnabled: true,
        weight: 1,
        metadata: {},
        validationSummary: {}
      },
      create: {
        id: `bank-${test.id}`,
        bankActivityId: test.bankActivityId,
        name: test.name,
        kind: test.kind,
        testCode: test.testCode,
        orderIndex: test.orderIndex,
        isEnabled: true,
        weight: 1,
        metadata: {},
        validationSummary: {}
      }
    });
  }

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

  await prisma.courseGroupActivity.upsert({
    where: {
      groupId_activityId: {
        groupId: group.id,
        activityId: "seed-activity-coding-template"
      }
    },
    update: {
      availableFrom: new Date("2026-04-24T13:00:00.000Z"),
      availableUntil: new Date("2026-05-22T03:59:00.000Z"),
      position: 2
    },
    create: {
      groupId: group.id,
      activityId: "seed-activity-coding-template",
      availableFrom: new Date("2026-04-24T13:00:00.000Z"),
      availableUntil: new Date("2026-05-22T03:59:00.000Z"),
      position: 2
    }
  });

  await prisma.courseGroupActivity.upsert({
    where: {
      groupId_activityId: {
        groupId: group.id,
        activityId: "seed-activity-web-design-profile-card"
      }
    },
    update: {
      availableFrom: new Date("2026-04-24T13:00:00.000Z"),
      availableUntil: new Date("2026-05-22T03:59:00.000Z"),
      position: 3
    },
    create: {
      groupId: group.id,
      activityId: "seed-activity-web-design-profile-card",
      availableFrom: new Date("2026-04-24T13:00:00.000Z"),
      availableUntil: new Date("2026-05-22T03:59:00.000Z"),
      position: 3
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
