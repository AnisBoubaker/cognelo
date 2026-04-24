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
  const codingExerciseType = activityTypesByKey.get("coding-exercise");
  if (!placeholderType || !parsonsType || !mcqType || !codingExerciseType) {
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

  const seededCodingActivityIds = [
    "seed-activity-coding-function",
    "seed-activity-coding-function-js",
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

  await prisma.activity.upsert({
    where: { id: "seed-activity-coding-function" },
    update: {
      title: "Title-case a name with a hidden helper",
      description: "Write the full Python function definition. The grader provides a hidden helper called `collapse_whitespace(value)`.",
      lifecycle: "published",
      config: {
        prompt: [
          "Write the full Python function definition `def normalize_title_case(name):`.",
          "Your function should return the input converted to title case.",
          "A hidden helper named `collapse_whitespace(value)` is available during execution and grading.",
          "It trims the string and collapses repeated whitespace to a single space."
        ].join("\n\n"),
        language: "python",
        executionMode: "function",
        starterCode: [
          "def normalize_title_case(name):",
          "    normalized = collapse_whitespace(name)",
          "    # Return the normalized name in title case."
        ].join("\n"),
        sampleTests: [
          {
            id: "sample-1",
            input: "",
            output: "Ada Lovelace",
            testCode: 'print(normalize_title_case("   aDa    lOVelace   "))',
            explanation: "The function should normalize spacing and capitalize each word."
          }
        ],
        maxEditorSeconds: 1800
      },
      metadata: { researchTags: ["coding-exercise", "functions", "python"], instrumented: false, plugin: pluginKeyByActivityKey.get("coding-exercise") }
    },
    create: {
      id: "seed-activity-coding-function",
      courseId: course.id,
      activityTypeId: codingExerciseType.id,
      title: "Title-case a name with a hidden helper",
      description: "Write the full Python function definition. The grader provides a hidden helper called `collapse_whitespace(value)`.",
      lifecycle: "published",
      config: {
        prompt: [
          "Write the full Python function definition `def normalize_title_case(name):`.",
          "Your function should return the input converted to title case.",
          "A hidden helper named `collapse_whitespace(value)` is available during execution and grading.",
          "It trims the string and collapses repeated whitespace to a single space."
        ].join("\n\n"),
        language: "python",
        executionMode: "function",
        starterCode: [
          "def normalize_title_case(name):",
          "    normalized = collapse_whitespace(name)",
          "    # Return the normalized name in title case."
        ].join("\n"),
        sampleTests: [
          {
            id: "sample-1",
            input: "",
            output: "Ada Lovelace",
            testCode: 'print(normalize_title_case("   aDa    lOVelace   "))',
            explanation: "The function should normalize spacing and capitalize each word."
          }
        ],
        maxEditorSeconds: 1800
      },
      metadata: { researchTags: ["coding-exercise", "functions", "python"], instrumented: false, plugin: pluginKeyByActivityKey.get("coding-exercise") },
      createdById: teacher.id
    }
  });

  await prisma.pluginCodingExerciseReferenceSolution.upsert({
    where: { activityId: "seed-activity-coding-function" },
    update: {
      sourceCode: [
        "def normalize_title_case(name):",
        "    normalized = collapse_whitespace(name)",
        "    if not normalized:",
        '        return ""',
        "    return \" \".join(part.capitalize() for part in normalized.split(\" \"))"
      ].join("\n"),
      privateConfig: {
        hiddenSupportCode: [
          "def collapse_whitespace(value):",
          "    return \" \".join(str(value).split())"
        ].join("\n"),
        templatePrefix: "",
        templateSuffix: ""
      },
      validationSummary: {}
    },
    create: {
      activityId: "seed-activity-coding-function",
      sourceCode: [
        "def normalize_title_case(name):",
        "    normalized = collapse_whitespace(name)",
        "    if not normalized:",
        '        return ""',
        "    return \" \".join(part.capitalize() for part in normalized.split(\" \"))"
      ].join("\n"),
      privateConfig: {
        hiddenSupportCode: [
          "def collapse_whitespace(value):",
          "    return \" \".join(str(value).split())"
        ].join("\n"),
        templatePrefix: "",
        templateSuffix: ""
      },
      validationSummary: {}
    }
  });

  for (const hiddenTest of [
    {
      id: "seed-hidden-function-1",
      activityId: "seed-activity-coding-function",
      name: "Mixed casing and extra spaces",
      expectedOutput: "Grace Hopper",
      metadata: {
        testCode: 'print(normalize_title_case("   gRACE   hOPPER   "))'
      }
    },
    {
      id: "seed-hidden-function-2",
      activityId: "seed-activity-coding-function",
      name: "Single word stays capitalized",
      expectedOutput: "Alan",
      metadata: {
        testCode: 'print(normalize_title_case("aLAN"))'
      }
    }
  ]) {
    await prisma.pluginCodingExerciseHiddenTest.upsert({
      where: { id: hiddenTest.id },
      update: {
        activityId: hiddenTest.activityId,
        name: hiddenTest.name,
        stdin: "",
        expectedOutput: hiddenTest.expectedOutput,
        orderIndex: hiddenTest.id.endsWith("-1") ? 0 : 1,
        isEnabled: true,
        weight: 1,
        metadata: hiddenTest.metadata
      },
      create: {
        id: hiddenTest.id,
        activityId: hiddenTest.activityId,
        name: hiddenTest.name,
        stdin: "",
        expectedOutput: hiddenTest.expectedOutput,
        orderIndex: hiddenTest.id.endsWith("-1") ? 0 : 1,
        isEnabled: true,
        weight: 1,
        metadata: hiddenTest.metadata
      }
    });
  }

  await prisma.activity.upsert({
    where: { id: "seed-activity-coding-function-js" },
    update: {
      title: "JavaScript title case with a hidden helper",
      description: "Write the full JavaScript function definition. The grader provides a hidden helper called `collapseWhitespace(value)`.",
      lifecycle: "published",
      config: {
        prompt: [
          "Write the full JavaScript function definition `function normalizeTitleCase(name) { ... }`.",
          "Your function should return the input converted to title case.",
          "A hidden helper named `collapseWhitespace(value)` is available during execution and grading.",
          "It trims the string and collapses repeated whitespace to a single space."
        ].join("\n\n"),
        language: "javascript",
        executionMode: "function",
        starterCode: [
          "function normalizeTitleCase(name) {",
          "  const normalized = collapseWhitespace(name);",
          "  // Return the normalized name in title case.",
          "}"
        ].join("\n"),
        sampleTests: [
          {
            id: "sample-1",
            input: "",
            output: "Ada Lovelace",
            testCode: 'console.log(normalizeTitleCase("   aDa    lOVelace   "));',
            explanation: "The function should normalize spacing and capitalize each word."
          }
        ],
        maxEditorSeconds: 1800
      },
      metadata: { researchTags: ["coding-exercise", "functions", "javascript"], instrumented: false, plugin: pluginKeyByActivityKey.get("coding-exercise") }
    },
    create: {
      id: "seed-activity-coding-function-js",
      courseId: course.id,
      activityTypeId: codingExerciseType.id,
      title: "JavaScript title case with a hidden helper",
      description: "Write the full JavaScript function definition. The grader provides a hidden helper called `collapseWhitespace(value)`.",
      lifecycle: "published",
      config: {
        prompt: [
          "Write the full JavaScript function definition `function normalizeTitleCase(name) { ... }`.",
          "Your function should return the input converted to title case.",
          "A hidden helper named `collapseWhitespace(value)` is available during execution and grading.",
          "It trims the string and collapses repeated whitespace to a single space."
        ].join("\n\n"),
        language: "javascript",
        executionMode: "function",
        starterCode: [
          "function normalizeTitleCase(name) {",
          "  const normalized = collapseWhitespace(name);",
          "  // Return the normalized name in title case.",
          "}"
        ].join("\n"),
        sampleTests: [
          {
            id: "sample-1",
            input: "",
            output: "Ada Lovelace",
            testCode: 'console.log(normalizeTitleCase("   aDa    lOVelace   "));',
            explanation: "The function should normalize spacing and capitalize each word."
          }
        ],
        maxEditorSeconds: 1800
      },
      metadata: { researchTags: ["coding-exercise", "functions", "javascript"], instrumented: false, plugin: pluginKeyByActivityKey.get("coding-exercise") },
      createdById: teacher.id
    }
  });

  await prisma.pluginCodingExerciseReferenceSolution.upsert({
    where: { activityId: "seed-activity-coding-function-js" },
    update: {
      sourceCode: [
        "function normalizeTitleCase(name) {",
        "  const normalized = collapseWhitespace(name);",
        "  if (!normalized) {",
        '    return "";',
        "  }",
        "  return normalized",
        '    .split(" ")',
        "    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())",
        '    .join(" ");',
        "}"
      ].join("\n"),
      privateConfig: {
        hiddenSupportCode: [
          "function collapseWhitespace(value) {",
          '  return String(value).trim().replace(/\\s+/g, " ");',
          "}"
        ].join("\n"),
        templatePrefix: "",
        templateSuffix: ""
      },
      validationSummary: {}
    },
    create: {
      activityId: "seed-activity-coding-function-js",
      sourceCode: [
        "function normalizeTitleCase(name) {",
        "  const normalized = collapseWhitespace(name);",
        "  if (!normalized) {",
        '    return "";',
        "  }",
        "  return normalized",
        '    .split(" ")',
        "    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())",
        '    .join(" ");',
        "}"
      ].join("\n"),
      privateConfig: {
        hiddenSupportCode: [
          "function collapseWhitespace(value) {",
          '  return String(value).trim().replace(/\\s+/g, " ");',
          "}"
        ].join("\n"),
        templatePrefix: "",
        templateSuffix: ""
      },
      validationSummary: {}
    }
  });

  for (const hiddenTest of [
    {
      id: "seed-hidden-function-js-1",
      activityId: "seed-activity-coding-function-js",
      name: "Mixed casing and extra spaces",
      expectedOutput: "Grace Hopper",
      metadata: {
        testCode: 'console.log(normalizeTitleCase("   gRACE   hOPPER   "));'
      }
    },
    {
      id: "seed-hidden-function-js-2",
      activityId: "seed-activity-coding-function-js",
      name: "Single word stays capitalized",
      expectedOutput: "Alan",
      metadata: {
        testCode: 'console.log(normalizeTitleCase("aLAN"));'
      }
    }
  ]) {
    await prisma.pluginCodingExerciseHiddenTest.upsert({
      where: { id: hiddenTest.id },
      update: {
        activityId: hiddenTest.activityId,
        name: hiddenTest.name,
        stdin: "",
        expectedOutput: hiddenTest.expectedOutput,
        orderIndex: hiddenTest.id.endsWith("-1") ? 0 : 1,
        isEnabled: true,
        weight: 1,
        metadata: hiddenTest.metadata
      },
      create: {
        id: hiddenTest.id,
        activityId: hiddenTest.activityId,
        name: hiddenTest.name,
        stdin: "",
        expectedOutput: hiddenTest.expectedOutput,
        orderIndex: hiddenTest.id.endsWith("-1") ? 0 : 1,
        isEnabled: true,
        weight: 1,
        metadata: hiddenTest.metadata
      }
    });
  }

  await prisma.activity.upsert({
    where: { id: "seed-activity-coding-template" },
    update: {
      title: "Write the body of main with a hidden C helper",
      description: "Write only the statements that belong inside `main`. A hidden helper `print_boxed(const char* text)` is available.",
      lifecycle: "published",
      config: {
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
            explanation: "The completed hidden template should print the two boxed lines."
          }
        ],
        maxEditorSeconds: 1800
      },
      metadata: { researchTags: ["coding-exercise", "template", "c"], instrumented: false, plugin: pluginKeyByActivityKey.get("coding-exercise") }
    },
    create: {
      id: "seed-activity-coding-template",
      courseId: course.id,
      activityTypeId: codingExerciseType.id,
      title: "Write the body of main with a hidden C helper",
      description: "Write only the statements that belong inside `main`. A hidden helper `print_boxed(const char* text)` is available.",
      lifecycle: "published",
      config: {
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
            explanation: "The completed hidden template should print the two boxed lines."
          }
        ],
        maxEditorSeconds: 1800
      },
      metadata: { researchTags: ["coding-exercise", "template", "c"], instrumented: false, plugin: pluginKeyByActivityKey.get("coding-exercise") },
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
        activityId: "seed-activity-coding-function"
      }
    },
    update: {
      availableFrom: new Date("2026-04-24T13:00:00.000Z"),
      availableUntil: new Date("2026-05-15T03:59:00.000Z"),
      position: 2
    },
    create: {
      groupId: group.id,
      activityId: "seed-activity-coding-function",
      availableFrom: new Date("2026-04-24T13:00:00.000Z"),
      availableUntil: new Date("2026-05-15T03:59:00.000Z"),
      position: 2
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
      position: 3
    },
    create: {
      groupId: group.id,
      activityId: "seed-activity-coding-template",
      availableFrom: new Date("2026-04-24T13:00:00.000Z"),
      availableUntil: new Date("2026-05-22T03:59:00.000Z"),
      position: 3
    }
  });

  await prisma.courseGroupActivity.upsert({
    where: {
      groupId_activityId: {
        groupId: group.id,
        activityId: "seed-activity-coding-function-js"
      }
    },
    update: {
      availableFrom: new Date("2026-04-24T13:00:00.000Z"),
      availableUntil: new Date("2026-05-22T03:59:00.000Z"),
      position: 4
    },
    create: {
      groupId: group.id,
      activityId: "seed-activity-coding-function-js",
      availableFrom: new Date("2026-04-24T13:00:00.000Z"),
      availableUntil: new Date("2026-05-22T03:59:00.000Z"),
      position: 4
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
