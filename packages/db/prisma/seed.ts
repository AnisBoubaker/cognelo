import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import bcrypt from "bcryptjs";
import { Prisma, PrismaClient } from "@prisma/client";
import { listActivityDefinitions, listActivityPlugins } from "@cognelo/activity-sdk";
import { listContentTypePlugins } from "@cognelo/content-type-sdk";
import { prisma as codingExercisesPrisma } from "../../plugin-activities/plugin-coding-exercises/src/db-client";
import { prisma as codingHomeworkGraderPrisma } from "../../plugin-activities/plugin-coding-homework-grader/src/db-client";
import { prisma as webDesignCodingExercisesPrisma } from "../../plugin-activities/plugin-web-design-coding-exercises/src/db-client";

const prisma = new PrismaClient();
const execFileAsync = promisify(execFile);
const CODING_HOMEWORK_ACTIVITY_ID = "seed-activity-coding-homework-grader";
const CODING_HOMEWORK_BANK_ACTIVITY_ID = "seed-bank-activity-coding-homework-grader";
const CODING_HOMEWORK_BANK_PDF_ATTACHMENT_ID = "seed-coding-homework-assignment-pdf-bank";
const CODING_HOMEWORK_COURSE_PDF_ATTACHMENT_ID = "seed-coding-homework-assignment-pdf-course";
const SEED_AI_CONNECTION_ID = "seed-ai-agent-student-support";

type SeedAiAgentProvider = "ollama" | "openai" | "codex" | "claude";

async function ensurePluginLocalTables() {
  for (const plugin of listActivityPlugins()) {
    for (const migration of plugin.db.migrations ?? []) {
      for (const statement of migration.statements) {
        await prisma.$executeRawUnsafe(statement);
      }
    }
  }
  for (const plugin of listContentTypePlugins()) {
    for (const migration of plugin.db.migrations ?? []) {
      for (const statement of migration.statements) {
        await prisma.$executeRawUnsafe(statement);
      }
    }
  }
}

async function upsertRole(key: string, name: string, description: string) {
  return prisma.role.upsert({
    where: { key },
    update: { name, description },
    create: { key, name, description }
  });
}

async function upsertUser(email: string, name: string, roleKeys: string[]) {
  const passwordHash = await bcrypt.hash("Password123!", 12);
  const [firstName = "", ...lastNameParts] = name.trim().split(/\s+/);
  const lastName = lastNameParts.join(" ");
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, firstName, lastName, passwordHash, isActive: true },
    create: { email, name, firstName, lastName, passwordHash }
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

async function upsertCourseContentItem(params: {
  id: string;
  courseId: string;
  groupId?: string | null;
  parentId?: string | null;
  kind: "folder" | "content" | "activity";
  titleSnapshot: string;
  position: number;
  isVisible?: boolean;
  materialId?: string | null;
  contentResourceId?: string | null;
  activityId?: string | null;
  courseGroupActivityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  return prisma.courseContentItem.upsert({
    where: { id: params.id },
    update: {
      courseId: params.courseId,
      groupId: params.groupId ?? null,
      parentId: params.parentId ?? null,
      kind: params.kind,
      titleSnapshot: params.titleSnapshot,
      position: params.position,
      isVisible: params.isVisible ?? true,
      materialId: params.materialId ?? null,
      contentResourceId: params.contentResourceId ?? null,
      activityId: params.activityId ?? null,
      courseGroupActivityId: params.courseGroupActivityId ?? null,
      metadata: (params.metadata ?? {}) as Prisma.InputJsonValue
    },
    create: {
      id: params.id,
      courseId: params.courseId,
      groupId: params.groupId ?? null,
      parentId: params.parentId ?? null,
      kind: params.kind,
      titleSnapshot: params.titleSnapshot,
      position: params.position,
      isVisible: params.isVisible ?? true,
      materialId: params.materialId ?? null,
      contentResourceId: params.contentResourceId ?? null,
      activityId: params.activityId ?? null,
      courseGroupActivityId: params.courseGroupActivityId ?? null,
      metadata: (params.metadata ?? {}) as Prisma.InputJsonValue
    }
  });
}

function normalizeSeedAiAgentProvider(value: string | undefined): SeedAiAgentProvider {
  if (value === "openai" || value === "codex" || value === "claude" || value === "ollama") {
    return value;
  }
  return process.env.OPENAI_API_KEY ? "openai" : "ollama";
}

function defaultSeedAiAgentModel(provider: SeedAiAgentProvider) {
  if (provider === "openai" || provider === "codex") {
    return "gpt-4.1-mini";
  }
  if (provider === "claude") {
    return "claude-3-5-sonnet-latest";
  }
  return "llama3.1";
}

function defaultSeedAiAgentBaseUrl(provider: SeedAiAgentProvider) {
  if (provider === "ollama") {
    return process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  }
  if (provider === "claude") {
    return process.env.ANTHROPIC_BASE_URL ?? null;
  }
  return process.env.OPENAI_BASE_URL ?? null;
}

function seedAiAgentApiKey(provider: SeedAiAgentProvider) {
  if (process.env.SEED_AI_AGENT_API_KEY) {
    return process.env.SEED_AI_AGENT_API_KEY;
  }
  if (provider === "openai" || provider === "codex") {
    return process.env.OPENAI_API_KEY ?? null;
  }
  if (provider === "claude") {
    return process.env.ANTHROPIC_API_KEY ?? null;
  }
  return null;
}

function asJsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function repoRootDir() {
  const cwd = process.cwd();
  return path.basename(cwd) === "db" && path.basename(path.dirname(cwd)) === "packages" ? path.resolve(cwd, "../..") : cwd;
}

function codingHomeworkStorageDir() {
  return path.join(repoRootDir(), "storage/coding-homework-grader");
}

function codingHomeworkSeedPdfPath() {
  return path.join(repoRootDir(), "tmp/INF155-A2023-TP1.pdf");
}

function codingHomeworkSeedProvidedFilesDir() {
  return path.join(repoRootDir(), "tmp/FichiersFournis");
}

async function readOptionalFile(filePath: string) {
  try {
    return await readFile(filePath);
  } catch {
    return null;
  }
}

function decodeSeedText(bytes: Buffer) {
  const utf8 = bytes.toString("utf8");
  return utf8.includes("\uFFFD") ? bytes.toString("latin1") : utf8;
}

async function extractOptionalPdfText(pdfPath: string) {
  try {
    const { stdout } = await execFileAsync("pdftotext", [pdfPath, "-"], { maxBuffer: 5 * 1024 * 1024 });
    return normalizeExtractedPdfText(String(stdout));
  } catch {
    return "";
  }
}

function normalizeExtractedPdfText(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\f/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

async function listProvidedHomeworkFiles() {
  try {
    const dir = codingHomeworkSeedProvidedFilesDir();
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}

async function readProvidedHomeworkFiles(names: string[]) {
  const dir = codingHomeworkSeedProvidedFilesDir();
  const sections = [];
  for (const name of names) {
    const bytes = await readOptionalFile(path.join(dir, name));
    if (!bytes) {
      continue;
    }
    sections.push({
      name,
      text: decodeSeedText(bytes).trimEnd()
    });
  }
  return sections;
}

async function buildCodingHomeworkSeedAssets() {
  const pdfPath = codingHomeworkSeedPdfPath();
  const pdfBytes = await readOptionalFile(pdfPath);
  const pdfText = pdfBytes ? await extractOptionalPdfText(pdfPath) : "";
  const providedFiles = await listProvidedHomeworkFiles();
  const starterSections = await readProvidedHomeworkFiles(["labyrinthe.h", "labyrinthe_io.h", "pile.h", "main.c"]);
  const promptMarkdown = [
    "# INF-155 TP1 - Labyrinthe",
    "",
    "Travail pratique en C: resoudre un labyrinthe rectangulaire imparfait avec un parcours en profondeur, une pile de coordonnees, des modules separes, et les fichiers de depart fournis par l'enseignant.",
    "",
    "La remise attendue est une archive ZIP contenant le projet C complet. Le PDF original est attache a cette activite lorsque `tmp/INF155-A2023-TP1.pdf` est present au moment du seed.",
    "",
    "## Fichiers fournis attendus",
    "",
    ...(providedFiles.length ? providedFiles.map((fileName) => `- \`${fileName}\``) : ["- Les fichiers fournis ne sont pas presents dans `tmp/FichiersFournis` sur cette machine."]),
    "",
    "## Fonctions principales a implementer",
    "",
    "- `lab_afficher_grille`",
    "- `lab_calculer_deplacements_possibles`",
    "- `lab_choisir_deplacement`",
    "- `lab_est_cases_adjacentes`",
    "- `lab_est_une_sortie`",
    "- `lab_resoudre_profondeur`",
    "- `selection_menu`",
    "- `menu_charger_labyrinthe`",
    "",
    pdfText ? "## Enonce extrait du PDF" : "## Enonce",
    "",
    pdfText || "Le fichier `tmp/INF155-A2023-TP1.pdf` n'etait pas present ou `pdftotext` n'a pas pu l'extraire pendant le seed.",
    ""
  ].join("\n");
  const starterFilesMarkdown = [
    "# TP1 Labyrinthe - fichiers fournis",
    "",
    "Ces fichiers sont lus depuis `tmp/FichiersFournis` pendant le seed et servent de documentation de depart avant l'activite.",
    "",
    ...(starterSections.length
      ? starterSections.flatMap((section) => [
          `## ${section.name}`,
          "",
          "```c",
          section.text,
          "```",
          ""
        ])
      : ["Aucun fichier fourni n'a ete trouve au moment du seed.", ""])
  ].join("\n");

  return {
    pdfBytes,
    promptMarkdown,
    providedFiles,
    starterFilesMarkdown
  };
}

async function upsertCodingHomeworkSeedPdfAttachment(input: {
  bytes: Buffer | null;
  id: string;
  ownerId: string;
  ownerKind: "bank_activity" | "course_activity";
}) {
  if (!input.bytes) {
    await codingHomeworkGraderPrisma.pluginCodingHomeworkAttachment.deleteMany({ where: { id: input.id } });
    return null;
  }

  const originalName = "INF155-A2023-TP1.pdf";
  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  const storedName = `seed-${sha256.slice(0, 16)}-${originalName}`;
  await mkdir(codingHomeworkStorageDir(), { recursive: true });
  await copyFile(codingHomeworkSeedPdfPath(), path.join(codingHomeworkStorageDir(), storedName));
  const fileStat = await stat(path.join(codingHomeworkStorageDir(), storedName));

  const attachment = await codingHomeworkGraderPrisma.pluginCodingHomeworkAttachment.upsert({
    where: { id: input.id },
    update: {
      ownerKind: input.ownerKind,
      ownerId: input.ownerId,
      kind: "assignment_pdf",
      originalName,
      storedName,
      mimeType: "application/pdf",
      sizeBytes: BigInt(fileStat.size),
      sha256,
      metadata: { seed: true, sourceAsset: "tmp/INF155-A2023-TP1.pdf" }
    },
    create: {
      id: input.id,
      ownerKind: input.ownerKind,
      ownerId: input.ownerId,
      kind: "assignment_pdf",
      originalName,
      storedName,
      mimeType: "application/pdf",
      sizeBytes: BigInt(fileStat.size),
      sha256,
      metadata: { seed: true, sourceAsset: "tmp/INF155-A2023-TP1.pdf" }
    }
  });

  return attachment.id;
}

async function upsertSeedAiConnection() {
  const provider = normalizeSeedAiAgentProvider(process.env.SEED_AI_AGENT_PROVIDER);
  const model = process.env.SEED_AI_AGENT_MODEL ?? defaultSeedAiAgentModel(provider);
  const baseUrl = process.env.SEED_AI_AGENT_BASE_URL ?? defaultSeedAiAgentBaseUrl(provider);
  const apiKey = seedAiAgentApiKey(provider);

  return prisma.aiAgentConnection.upsert({
    where: { id: SEED_AI_CONNECTION_ID },
    update: {
      provider,
      displayName: "Seed student-support AI",
      model,
      baseUrl,
      apiKey,
      isEnabled: true
    },
    create: {
      id: SEED_AI_CONNECTION_ID,
      ownerId: null,
      provider,
      displayName: "Seed student-support AI",
      model,
      baseUrl,
      apiKey,
      isEnabled: true
    }
  });
}

async function main() {
  await ensurePluginLocalTables();

  await upsertRole("admin", "Admin", "Full platform administration access.");
  await upsertRole("course_manager", "Course manager", "Can create subjects and courses.");
  await upsertRole("teacher", "Teacher", "Can create and manage courses and activities.");
  await upsertRole("student", "Student", "Can participate in enrolled courses.");

  const admin = await upsertUser("admin@cognelo.local", "Ada Admin", ["admin"]);
  const teacher = await upsertUser("teacher@cognelo.local", "Terry Teacher", ["course_manager", "teacher"]);
  const student = await upsertUser("student@cognelo.local", "Sam Student", ["student"]);
  const seedAiConnection = await upsertSeedAiConnection();

  const teacherMetadata = asJsonRecord(teacher.metadata);
  const teacherAiPreferences = asJsonRecord(teacherMetadata.aiPreferences);
  if (!teacherAiPreferences.questionAuthoringAiAgentConnectionId && seedAiConnection.provider !== "ollama") {
    await prisma.user.update({
      where: { id: teacher.id },
      data: {
        metadata: {
          ...teacherMetadata,
          aiPreferences: {
            ...teacherAiPreferences,
            questionAuthoringAiAgentConnectionId: seedAiConnection.id
          }
        } as Prisma.InputJsonValue
      }
    });
  }

  const activityTypesByKey = new Map<string, Awaited<ReturnType<typeof prisma.activityType.upsert>>>();
  const pluginKeyByActivityKey = new Map<string, string>();
  for (const plugin of listActivityPlugins()) {
    await prisma.activityPluginInstallation.upsert({
      where: { key: plugin.key },
      update: {
        packageName: plugin.packageName,
        name: plugin.name,
        version: plugin.version ?? "0.1.0",
        metadata: {
          activityTypeKeys: plugin.activities.map((activity) => activity.key),
          databaseNamespace: plugin.db.namespace,
          databaseTables: plugin.db.tables,
          databaseNotes: plugin.db.notes ?? []
        },
        isActivated: true
      },
      create: {
        key: plugin.key,
        packageName: plugin.packageName,
        name: plugin.name,
        version: plugin.version ?? "0.1.0",
        metadata: {
          activityTypeKeys: plugin.activities.map((activity) => activity.key),
          databaseNamespace: plugin.db.namespace,
          databaseTables: plugin.db.tables,
          databaseNotes: plugin.db.notes ?? []
        },
        isActivated: true,
        isEnabled: true
      }
    });

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

  for (const plugin of listContentTypePlugins()) {
    await prisma.contentTypePluginInstallation.upsert({
      where: { key: plugin.key },
      update: {
        packageName: plugin.packageName,
        name: plugin.name,
        version: plugin.version ?? "0.1.0",
        metadata: {
          contentTypeKeys: plugin.contentTypes.map((contentType) => contentType.key),
          databaseNamespace: plugin.db.namespace,
          databaseTables: plugin.db.tables,
          databaseNotes: plugin.db.notes ?? []
        },
        isActivated: true,
        isEnabled: true
      },
      create: {
        key: plugin.key,
        packageName: plugin.packageName,
        name: plugin.name,
        version: plugin.version ?? "0.1.0",
        metadata: {
          contentTypeKeys: plugin.contentTypes.map((contentType) => contentType.key),
          databaseNamespace: plugin.db.namespace,
          databaseTables: plugin.db.tables,
          databaseNotes: plugin.db.notes ?? []
        },
        isActivated: true,
        isEnabled: true
      }
    });
  }

  const placeholderType = activityTypesByKey.get("placeholder");
  const codingHomeworkType = activityTypesByKey.get("coding-homework-grader");
  const parsonsType = activityTypesByKey.get("parsons-problem");
  const mcqType = activityTypesByKey.get("mcq");
  const codingExerciseType = activityTypesByKey.get("coding-exercise");
  const webDesignExerciseType = activityTypesByKey.get("web-design-coding-exercise");
  const missingSeededActivityTypes = listActivityDefinitions()
    .map((definition) => definition.key)
    .filter((key) => !activityTypesByKey.has(key));
  if (
    !placeholderType ||
    !codingHomeworkType ||
    !parsonsType ||
    !mcqType ||
    !codingExerciseType ||
    !webDesignExerciseType ||
    missingSeededActivityTypes.length > 0
  ) {
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

  const codingHomeworkConfig = {
    gradingMode: "manual",
    maxAttempts: 3
  };
  const codingHomeworkSeedAssets = await buildCodingHomeworkSeedAssets();
  const codingHomeworkPromptMarkdown = codingHomeworkSeedAssets.promptMarkdown;
  const codingHomeworkGenerationInstructions = [
    "Generate oral-defense questions in French unless the learner UI locale says otherwise.",
    "Focus on the student's implementation of depth-first labyrinth solving, stack usage, adjacency checks, exit detection, movement selection, and module boundaries.",
    "Ask questions that reveal whether the student understands backtracking and why their code avoids revisiting cells."
  ].join("\n");
  const codingHomeworkRequirements = {
    allowedExtensions: [".c", ".h", ".txt"],
    ignoredPaths: ["build", "dist", "cmake-build-debug", ".git", ".idea", ".vscode", "__MACOSX"],
    languageKey: "c",
    maxArchiveBytes: 25 * 1024 * 1024,
    maxFileCount: 80,
    requiredFiles: [
      { path: "labyrinthe.h", description: "Header for the labyrinth-solving module." },
      { path: "labyrinthe.c", description: "Implementation of the labyrinth-solving functions." },
      { path: "labyrinthe_io.h", description: "Header for labyrinth input/output functions." },
      { path: "labyrinthe_io.c", description: "Implementation of file loading and menu input/output functions." },
      { path: "pile.h", description: "Provided stack header." },
      { path: "pile.c", description: "Provided stack implementation." },
      { path: "utilitaires.h", description: "Header for utility functions such as random-number generation." },
      { path: "utilitaires.c", description: "Implementation of utility functions." },
      { path: "main.c", description: "Main program wiring the menu, loading, solving, and display flows." },
      { path: "grille1.txt", description: "Provided labyrinth test grid." }
    ],
    requiredFolders: [],
    requiredFunctions: [
      { name: "lab_afficher_grille", filePath: "labyrinthe.c", description: "Display the labyrinth grid and optionally the solution path.", required: true },
      {
        name: "lab_calculer_deplacements_possibles",
        filePath: "labyrinthe.c",
        description: "Compute valid adjacent moves from the current position.",
        required: true
      },
      { name: "lab_choisir_deplacement", filePath: "labyrinthe.c", description: "Select one possible move.", required: true },
      { name: "lab_est_cases_adjacentes", filePath: "labyrinthe.c", description: "Determine whether two cells are adjacent.", required: true },
      { name: "lab_est_une_sortie", filePath: "labyrinthe.c", description: "Determine whether a position is an exit.", required: true },
      { name: "lab_resoudre_profondeur", filePath: "labyrinthe.c", description: "Solve the labyrinth with depth-first search and backtracking.", required: true },
      { name: "charger_labyrinthe", filePath: "labyrinthe_io.c", description: "Load a labyrinth grid from disk.", required: true },
      { name: "selection_menu", filePath: "labyrinthe_io.c", description: "Display the main menu and validate the user's choice.", required: true },
      { name: "menu_charger_labyrinthe", filePath: "labyrinthe_io.c", description: "Prompt the user for the labyrinth file name.", required: true },
      {
        name: "generer_nombre_aleatoire",
        filePath: "utilitaires.c",
        description: "Recommended helper for selecting a random move.",
        required: false
      }
    ]
  };
  const codingHomeworkSeed = await upsertBankActivityWithVersion({
    id: CODING_HOMEWORK_BANK_ACTIVITY_ID,
    bankId: programmingBasicsBank.id,
    activityTypeId: codingHomeworkType.id,
    title: "Coding homework grader: INF-155 TP1 Labyrinthe",
    description: "Submit the C labyrinth solver project as a ZIP, then answer generated challenge questions.",
    lifecycle: "published",
    config: codingHomeworkConfig,
    metadata: {
      researchTags: ["coding-homework-grader", "labyrinth", "depth-first-search", "c"],
      instrumented: true,
      seedAssets: {
        assignmentPdf: Boolean(codingHomeworkSeedAssets.pdfBytes),
        providedFiles: codingHomeworkSeedAssets.providedFiles
      },
      plugin: pluginKeyByActivityKey.get("coding-homework-grader")
    },
    createdById: teacher.id,
    position: 4
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
  const courseMetadata = asJsonRecord(course.metadata);
  const courseAiSettings = asJsonRecord(courseMetadata.aiSettings);
  await prisma.course.update({
    where: { id: course.id },
    data: {
      metadata: {
        ...courseMetadata,
        aiSettings: {
          ...courseAiSettings,
          studentSupportAiAgentConnectionId: seedAiConnection.id
        }
      } as Prisma.InputJsonValue
    }
  });

  const seededCodingActivityIds = [
    CODING_HOMEWORK_ACTIVITY_ID,
    "seed-activity-coding-template"
  ] as const;

  await codingHomeworkGraderPrisma.pluginCodingHomeworkSubmission.deleteMany({
    where: { activityId: CODING_HOMEWORK_ACTIVITY_ID }
  });
  await codingHomeworkGraderPrisma.pluginCodingHomeworkDocumentationSnapshot.deleteMany({
    where: { activityId: CODING_HOMEWORK_ACTIVITY_ID }
  });

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

  await prisma.courseMaterial.deleteMany({
    where: {
      id: {
        in: [
          "seed-material-welcome",
          "seed-material-variables-intro",
          "seed-material-examples-repo",
          "seed-material-loops-slides",
          "seed-material-loops-resource"
        ]
      }
    }
  });
  await prisma.courseContentResource.deleteMany({
    where: {
      id: {
        in: ["seed-content-resource-c-arrays-reference", "seed-content-resource-c-testing-checklist"]
      }
    }
  });

  const welcomeResource = await prisma.courseContentResource.upsert({
    where: { id: "seed-content-resource-welcome" },
    update: {
      courseId: course.id,
      groupId: null,
      contentTypeKey: "text",
      pluginKey: "text-content",
      title: "Welcome",
      metadata: {
        module: "orientation",
        body: "## Welcome\n\nStart here before attempting the first activity.",
        format: "markdown"
      }
    },
    create: {
      id: "seed-content-resource-welcome",
      courseId: course.id,
      groupId: null,
      contentTypeKey: "text",
      pluginKey: "text-content",
      title: "Welcome",
      metadata: {
        module: "orientation",
        body: "## Welcome\n\nStart here before attempting the first activity.",
        format: "markdown"
      }
    }
  });

  const examplesRepoResource = await prisma.courseContentResource.upsert({
    where: { id: "seed-content-resource-examples-repo" },
    update: {
      courseId: course.id,
      groupId: null,
      contentTypeKey: "github-repo",
      pluginKey: "github-repo-content",
      title: "Examples shown in class",
      metadata: { module: "week-1", url: "https://github.com/cognelo/examples-programming-101" }
    },
    create: {
      id: "seed-content-resource-examples-repo",
      courseId: course.id,
      groupId: null,
      contentTypeKey: "github-repo",
      pluginKey: "github-repo-content",
      title: "Examples shown in class",
      metadata: { module: "week-1", url: "https://github.com/cognelo/examples-programming-101" }
    }
  });

  const variablesIntroResource = await prisma.courseContentResource.upsert({
    where: { id: "seed-content-resource-variables-intro" },
    update: {
      courseId: course.id,
      groupId: null,
      contentTypeKey: "file",
      pluginKey: "file-content",
      title: "Introduction to variables",
      metadata: {
        module: "week-1",
        originalName: "introduction-to-variables.pdf",
        mimeType: "application/pdf",
        setupStatus: "draft"
      }
    },
    create: {
      id: "seed-content-resource-variables-intro",
      courseId: course.id,
      groupId: null,
      contentTypeKey: "file",
      pluginKey: "file-content",
      title: "Introduction to variables",
      metadata: {
        module: "week-1",
        originalName: "introduction-to-variables.pdf",
        mimeType: "application/pdf",
        setupStatus: "draft"
      }
    }
  });

  const loopsSlidesResource = await prisma.courseContentResource.upsert({
    where: { id: "seed-content-resource-loops-slides" },
    update: {
      courseId: course.id,
      groupId: null,
      contentTypeKey: "file",
      pluginKey: "file-content",
      title: "What are loops?",
      metadata: {
        module: "week-2",
        originalName: "what-are-loops.pptx",
        mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        setupStatus: "draft"
      }
    },
    create: {
      id: "seed-content-resource-loops-slides",
      courseId: course.id,
      groupId: null,
      contentTypeKey: "file",
      pluginKey: "file-content",
      title: "What are loops?",
      metadata: {
        module: "week-2",
        originalName: "what-are-loops.pptx",
        mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        setupStatus: "draft"
      }
    }
  });

  const loopsResource = await prisma.courseContentResource.upsert({
    where: { id: "seed-content-resource-loops-resource" },
    update: {
      courseId: course.id,
      groupId: null,
      contentTypeKey: "text",
      pluginKey: "text-content",
      title: "Codecademy: Learn loops",
      metadata: {
        module: "week-2",
        audience: "extra-practice",
        body: "Extra practice resource: https://www.codecademy.com/resources/docs/python/loops",
        format: "markdown"
      }
    },
    create: {
      id: "seed-content-resource-loops-resource",
      courseId: course.id,
      groupId: null,
      contentTypeKey: "text",
      pluginKey: "text-content",
      title: "Codecademy: Learn loops",
      metadata: {
        module: "week-2",
        audience: "extra-practice",
        body: "Extra practice resource: https://www.codecademy.com/resources/docs/python/loops",
        format: "markdown"
      }
    }
  });

  const tp1AssignmentResource = await prisma.courseContentResource.upsert({
    where: { id: "seed-content-resource-tp1-labyrinth-assignment" },
    update: {
      courseId: course.id,
      groupId: null,
      contentTypeKey: "text",
      pluginKey: "text-content",
      title: "INF-155 TP1 Labyrinthe - enonce",
      metadata: {
        module: "week-3",
        body: codingHomeworkPromptMarkdown,
        format: "markdown"
      }
    },
    create: {
      id: "seed-content-resource-tp1-labyrinth-assignment",
      courseId: course.id,
      groupId: null,
      contentTypeKey: "text",
      pluginKey: "text-content",
      title: "INF-155 TP1 Labyrinthe - enonce",
      metadata: {
        module: "week-3",
        body: codingHomeworkPromptMarkdown,
        format: "markdown"
      }
    }
  });

  const tp1StarterFilesResource = await prisma.courseContentResource.upsert({
    where: { id: "seed-content-resource-tp1-labyrinth-starter-files" },
    update: {
      courseId: course.id,
      groupId: null,
      contentTypeKey: "text",
      pluginKey: "text-content",
      title: "INF-155 TP1 Labyrinthe - fichiers fournis",
      metadata: {
        module: "week-3",
        body: codingHomeworkSeedAssets.starterFilesMarkdown,
        format: "markdown"
      }
    },
    create: {
      id: "seed-content-resource-tp1-labyrinth-starter-files",
      courseId: course.id,
      groupId: null,
      contentTypeKey: "text",
      pluginKey: "text-content",
      title: "INF-155 TP1 Labyrinthe - fichiers fournis",
      metadata: {
        module: "week-3",
        body: codingHomeworkSeedAssets.starterFilesMarkdown,
        format: "markdown"
      }
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

  await prisma.activity.upsert({
    where: { id: CODING_HOMEWORK_ACTIVITY_ID },
    update: {
      title: "Coding homework grader: INF-155 TP1 Labyrinthe",
      description: "Submit the C labyrinth solver project as a ZIP, then answer generated challenge questions.",
      lifecycle: "published",
      config: codingHomeworkConfig,
      bankActivityId: codingHomeworkSeed.bankActivity.id,
      activityVersionId: codingHomeworkSeed.version.id,
      metadata: {
        researchTags: ["coding-homework-grader", "labyrinth", "depth-first-search", "c"],
        instrumented: true,
        seedAssets: {
          assignmentPdf: Boolean(codingHomeworkSeedAssets.pdfBytes),
          providedFiles: codingHomeworkSeedAssets.providedFiles
        },
        plugin: pluginKeyByActivityKey.get("coding-homework-grader")
      }
    },
    create: {
      id: CODING_HOMEWORK_ACTIVITY_ID,
      courseId: course.id,
      activityTypeId: codingHomeworkType.id,
      title: "Coding homework grader: INF-155 TP1 Labyrinthe",
      description: "Submit the C labyrinth solver project as a ZIP, then answer generated challenge questions.",
      lifecycle: "published",
      config: codingHomeworkConfig,
      bankActivityId: codingHomeworkSeed.bankActivity.id,
      activityVersionId: codingHomeworkSeed.version.id,
      metadata: {
        researchTags: ["coding-homework-grader", "labyrinth", "depth-first-search", "c"],
        instrumented: true,
        seedAssets: {
          assignmentPdf: Boolean(codingHomeworkSeedAssets.pdfBytes),
          providedFiles: codingHomeworkSeedAssets.providedFiles
        },
        plugin: pluginKeyByActivityKey.get("coding-homework-grader")
      },
      createdById: teacher.id,
      position: 4
    }
  });

  const codingHomeworkBankPdfAttachmentId = await upsertCodingHomeworkSeedPdfAttachment({
    bytes: codingHomeworkSeedAssets.pdfBytes,
    id: CODING_HOMEWORK_BANK_PDF_ATTACHMENT_ID,
    ownerId: CODING_HOMEWORK_BANK_ACTIVITY_ID,
    ownerKind: "bank_activity"
  });
  const codingHomeworkCoursePdfAttachmentId = await upsertCodingHomeworkSeedPdfAttachment({
    bytes: codingHomeworkSeedAssets.pdfBytes,
    id: CODING_HOMEWORK_COURSE_PDF_ATTACHMENT_ID,
    ownerId: CODING_HOMEWORK_ACTIVITY_ID,
    ownerKind: "course_activity"
  });

  await codingHomeworkGraderPrisma.pluginBankCodingHomeworkAssignment.upsert({
    where: { bankActivityId: CODING_HOMEWORK_BANK_ACTIVITY_ID },
    update: {
      promptMarkdown: codingHomeworkPromptMarkdown,
      promptPdfAttachmentId: codingHomeworkBankPdfAttachmentId,
      languageKey: "c",
      candidateLimit: 5,
      retrievedExampleCount: 3,
      questionCount: 3,
      generationInstructions: codingHomeworkGenerationInstructions,
      settings: { seed: true, sourceAsset: "tmp/INF155-A2023-TP1.pdf" }
    },
    create: {
      bankActivityId: CODING_HOMEWORK_BANK_ACTIVITY_ID,
      promptMarkdown: codingHomeworkPromptMarkdown,
      promptPdfAttachmentId: codingHomeworkBankPdfAttachmentId,
      languageKey: "c",
      candidateLimit: 5,
      retrievedExampleCount: 3,
      questionCount: 3,
      generationInstructions: codingHomeworkGenerationInstructions,
      settings: { seed: true, sourceAsset: "tmp/INF155-A2023-TP1.pdf" }
    }
  });

  await codingHomeworkGraderPrisma.pluginBankCodingHomeworkSubmissionRequirementSet.upsert({
    where: { bankActivityId: CODING_HOMEWORK_BANK_ACTIVITY_ID },
    update: {
      languageKey: "c",
      requirements: codingHomeworkRequirements,
      metadata: { seed: true }
    },
    create: {
      bankActivityId: CODING_HOMEWORK_BANK_ACTIVITY_ID,
      languageKey: "c",
      requirements: codingHomeworkRequirements,
      metadata: { seed: true }
    }
  });

  await codingHomeworkGraderPrisma.pluginCodingHomeworkAssignment.upsert({
    where: { activityId: CODING_HOMEWORK_ACTIVITY_ID },
    update: {
      promptMarkdown: codingHomeworkPromptMarkdown,
      promptPdfAttachmentId: codingHomeworkCoursePdfAttachmentId,
      languageKey: "c",
      candidateLimit: 5,
      retrievedExampleCount: 3,
      questionCount: 3,
      generationInstructions: codingHomeworkGenerationInstructions,
      settings: { seed: true, sourceAsset: "tmp/INF155-A2023-TP1.pdf" }
    },
    create: {
      activityId: CODING_HOMEWORK_ACTIVITY_ID,
      promptMarkdown: codingHomeworkPromptMarkdown,
      promptPdfAttachmentId: codingHomeworkCoursePdfAttachmentId,
      languageKey: "c",
      candidateLimit: 5,
      retrievedExampleCount: 3,
      questionCount: 3,
      generationInstructions: codingHomeworkGenerationInstructions,
      settings: { seed: true, sourceAsset: "tmp/INF155-A2023-TP1.pdf" }
    }
  });

  await codingHomeworkGraderPrisma.pluginCodingHomeworkSubmissionRequirementSet.upsert({
    where: { activityId: CODING_HOMEWORK_ACTIVITY_ID },
    update: {
      languageKey: "c",
      requirements: codingHomeworkRequirements,
      metadata: { seed: true }
    },
    create: {
      activityId: CODING_HOMEWORK_ACTIVITY_ID,
      languageKey: "c",
      requirements: codingHomeworkRequirements,
      metadata: { seed: true }
    }
  });

  await codingExercisesPrisma.pluginCodingExerciseReferenceSolution.upsert({
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
    await codingExercisesPrisma.pluginCodingExerciseHiddenTest.upsert({
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

  await webDesignCodingExercisesPrisma.pluginWebDesignExerciseReferenceBundle.upsert({
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

  await webDesignCodingExercisesPrisma.pluginBankWebDesignExerciseReferenceBundle.upsert({
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
    await webDesignCodingExercisesPrisma.pluginWebDesignExerciseTest.upsert({
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

    await webDesignCodingExercisesPrisma.pluginBankWebDesignExerciseTest.upsert({
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
      availableUntil: new Date("2026-07-31T03:59:00.000Z")
    },
    create: {
      id: "seed-group-programming-101-section-a",
      courseId: course.id,
      title: "Section A",
      description: "Monday lab group with its own launch notes and activity schedule.",
      status: "published",
      availableFrom: new Date("2026-04-20T13:00:00.000Z"),
      availableUntil: new Date("2026-07-31T03:59:00.000Z"),
      createdById: teacher.id
    }
  });

  await prisma.courseGroupParticipant.upsert({
    where: {
      groupId_email: {
        groupId: group.id,
        email: student.email
      }
    },
    update: {
      userId: student.id,
      role: "student",
      firstName: student.firstName ?? "Sam",
      lastName: student.lastName ?? "Student",
      externalId: "S1001"
    },
    create: {
      groupId: group.id,
      userId: student.id,
      role: "student",
      firstName: student.firstName ?? "Sam",
      lastName: student.lastName ?? "Student",
      email: student.email,
      externalId: "S1001"
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

  const codingHomeworkAssignment = await prisma.courseGroupActivity.upsert({
    where: {
      groupId_activityId: {
        groupId: group.id,
        activityId: CODING_HOMEWORK_ACTIVITY_ID
      }
    },
    update: {
      availableFrom: new Date("2026-05-20T13:00:00.000Z"),
      availableUntil: new Date("2026-07-01T03:59:00.000Z"),
      metadata: { assessmentMode: "summative", seed: true },
      position: 4
    },
    create: {
      groupId: group.id,
      activityId: CODING_HOMEWORK_ACTIVITY_ID,
      availableFrom: new Date("2026-05-20T13:00:00.000Z"),
      availableUntil: new Date("2026-07-01T03:59:00.000Z"),
      metadata: { assessmentMode: "summative", seed: true },
      position: 4
    }
  });

  await prisma.gradebookItem.upsert({
    where: { groupActivityId: codingHomeworkAssignment.id },
    update: {
      titleSnapshot: "Coding homework grader: INF-155 TP1 Labyrinthe",
      pointsPossible: 100,
      gradingMode: "points",
      attemptLimitMode: "max_attempts",
      maxAttempts: 3,
      gradeStrategy: "latest",
      metadata: { seed: true, plugin: "coding-homework-grader", assignment: "INF155-A2023-TP1" }
    },
    create: {
      courseId: course.id,
      groupId: group.id,
      groupActivityId: codingHomeworkAssignment.id,
      activityId: CODING_HOMEWORK_ACTIVITY_ID,
      titleSnapshot: "Coding homework grader: INF-155 TP1 Labyrinthe",
      pointsPossible: 100,
      gradingMode: "points",
      attemptLimitMode: "max_attempts",
      maxAttempts: 3,
      gradeStrategy: "latest",
      metadata: { seed: true, plugin: "coding-homework-grader", assignment: "INF155-A2023-TP1" }
    }
  });

  await prisma.courseContentItem.deleteMany({
    where: {
      courseId: course.id,
      id: { startsWith: "seed-content-" }
    }
  });

  const courseOverviewFolder = await upsertCourseContentItem({
    id: "seed-content-course-overview-folder",
    courseId: course.id,
    kind: "folder",
    titleSnapshot: "Course overview",
    position: 0,
    metadata: { seed: true }
  });

  await upsertCourseContentItem({
    id: "seed-content-course-welcome",
    courseId: course.id,
    parentId: courseOverviewFolder.id,
    kind: "content",
    titleSnapshot: welcomeResource.title,
    position: 0,
    contentResourceId: welcomeResource.id,
    metadata: { seed: true }
  });

  const week1Folder = await upsertCourseContentItem({
    id: "seed-content-course-week-1",
    courseId: course.id,
    kind: "folder",
    titleSnapshot: "Week 1: Variables",
    position: 1,
    metadata: { seed: true, week: 1 }
  });

  await upsertCourseContentItem({
    id: "seed-content-section-a-variables-pdf",
    courseId: course.id,
    parentId: week1Folder.id,
    kind: "content",
    titleSnapshot: variablesIntroResource.title,
    position: 0,
    contentResourceId: variablesIntroResource.id,
    metadata: { seed: true }
  });

  await upsertCourseContentItem({
    id: "seed-content-section-a-mcq",
    courseId: course.id,
    parentId: week1Folder.id,
    kind: "activity",
    titleSnapshot: "Check your understanding: Python basics",
    position: 1,
    activityId: "seed-activity-mcq",
    metadata: { seed: true }
  });

  await upsertCourseContentItem({
    id: "seed-content-section-a-examples-repo",
    courseId: course.id,
    parentId: week1Folder.id,
    kind: "content",
    titleSnapshot: examplesRepoResource.title,
    position: 2,
    contentResourceId: examplesRepoResource.id,
    metadata: { seed: true }
  });

  await upsertCourseContentItem({
    id: "seed-content-section-a-coding-template",
    courseId: course.id,
    parentId: week1Folder.id,
    kind: "activity",
    titleSnapshot: "Practice: Use the right variable",
    position: 3,
    activityId: "seed-activity-coding-template",
    metadata: { seed: true }
  });

  const week2Folder = await upsertCourseContentItem({
    id: "seed-content-course-week-2",
    courseId: course.id,
    kind: "folder",
    titleSnapshot: "Week 2: Loops",
    position: 2,
    isVisible: false,
    metadata: { seed: true, week: 2, note: "Hidden to demonstrate folder visibility inheritance." }
  });

  await upsertCourseContentItem({
    id: "seed-content-section-a-loops-slides",
    courseId: course.id,
    parentId: week2Folder.id,
    kind: "content",
    titleSnapshot: loopsSlidesResource.title,
    position: 0,
    contentResourceId: loopsSlidesResource.id,
    metadata: { seed: true }
  });

  await upsertCourseContentItem({
    id: "seed-content-section-a-parsons-loop",
    courseId: course.id,
    parentId: week2Folder.id,
    kind: "activity",
    titleSnapshot: "Parsons: Compute a loop",
    position: 1,
    activityId: "seed-activity-parsons",
    metadata: { seed: true }
  });

  const resourcesFolder = await upsertCourseContentItem({
    id: "seed-content-course-week-2-resources",
    courseId: course.id,
    parentId: week2Folder.id,
    kind: "folder",
    titleSnapshot: "Resources",
    position: 2,
    metadata: { seed: true }
  });

  await upsertCourseContentItem({
    id: "seed-content-section-a-loops-resource",
    courseId: course.id,
    parentId: resourcesFolder.id,
    kind: "content",
    titleSnapshot: loopsResource.title,
    position: 0,
    contentResourceId: loopsResource.id,
    metadata: { seed: true }
  });

  const week3Folder = await upsertCourseContentItem({
    id: "seed-content-course-week-3",
    courseId: course.id,
    kind: "folder",
    titleSnapshot: "Week 3: Labyrinthe et parcours en profondeur",
    position: 3,
    metadata: { seed: true, week: 3 }
  });

  const tp1AssignmentContentItem = await upsertCourseContentItem({
    id: "seed-content-section-a-tp1-labyrinth-assignment",
    courseId: course.id,
    parentId: week3Folder.id,
    kind: "content",
    titleSnapshot: tp1AssignmentResource.title,
    position: 0,
    contentResourceId: tp1AssignmentResource.id,
    metadata: { seed: true }
  });

  const tp1StarterFilesContentItem = await upsertCourseContentItem({
    id: "seed-content-section-a-tp1-labyrinth-starter-files",
    courseId: course.id,
    parentId: week3Folder.id,
    kind: "content",
    titleSnapshot: tp1StarterFilesResource.title,
    position: 1,
    contentResourceId: tp1StarterFilesResource.id,
    metadata: { seed: true }
  });

  const codingHomeworkContentItem = await upsertCourseContentItem({
    id: "seed-content-section-a-coding-homework",
    courseId: course.id,
    groupId: group.id,
    parentId: week3Folder.id,
    kind: "activity",
    titleSnapshot: "Homework: INF-155 TP1 Labyrinthe",
    position: 2,
    activityId: CODING_HOMEWORK_ACTIVITY_ID,
    courseGroupActivityId: codingHomeworkAssignment.id,
    metadata: { seed: true }
  });

  await codingHomeworkGraderPrisma.pluginCodingHomeworkDocumentationSnapshot.upsert({
    where: { id: "seed-coding-homework-doc-snapshot" },
    update: {
      activityId: CODING_HOMEWORK_ACTIVITY_ID,
      courseId: course.id,
      groupId: group.id,
      contentTreeAnchorItemId: codingHomeworkContentItem.id,
      contentTreeFingerprint: "seed-week-3-labyrinth-depth-first-search",
      status: "ready",
      metadata: {
        anchor: {
          id: codingHomeworkContentItem.id,
          depth: 1,
          path: ["Week 3: Labyrinthe et parcours en profondeur"],
          title: codingHomeworkContentItem.titleSnapshot,
          updatedAt: codingHomeworkContentItem.updatedAt.toISOString()
        },
        generatedAt: new Date("2026-05-29T12:00:00.000Z").toISOString(),
        includedResources: [
          {
            contentResourceId: tp1AssignmentResource.id,
            contentTypeKey: tp1AssignmentResource.contentTypeKey,
            depth: 1,
            groupId: tp1AssignmentResource.groupId,
            itemId: tp1AssignmentContentItem.id,
            materialId: null,
            orderIndex: 0,
            path: ["Week 3: Labyrinthe et parcours en profondeur"],
            pluginKey: tp1AssignmentResource.pluginKey,
            resourceFingerprint: "seed-tp1-labyrinth-assignment",
            sourceKind: "content_resource",
            title: tp1AssignmentContentItem.titleSnapshot,
            updatedAt: tp1AssignmentResource.updatedAt.toISOString()
          },
          {
            contentResourceId: tp1StarterFilesResource.id,
            contentTypeKey: tp1StarterFilesResource.contentTypeKey,
            depth: 1,
            groupId: tp1StarterFilesResource.groupId,
            itemId: tp1StarterFilesContentItem.id,
            materialId: null,
            orderIndex: 1,
            path: ["Week 3: Labyrinthe et parcours en profondeur"],
            pluginKey: tp1StarterFilesResource.pluginKey,
            resourceFingerprint: "seed-tp1-labyrinth-starter-files",
            sourceKind: "content_resource",
            title: tp1StarterFilesContentItem.titleSnapshot,
            updatedAt: tp1StarterFilesResource.updatedAt.toISOString()
          }
        ],
        resourceCount: 2,
        seed: true
      }
    },
    create: {
      id: "seed-coding-homework-doc-snapshot",
      activityId: CODING_HOMEWORK_ACTIVITY_ID,
      courseId: course.id,
      groupId: group.id,
      contentTreeAnchorItemId: codingHomeworkContentItem.id,
      contentTreeFingerprint: "seed-week-3-labyrinth-depth-first-search",
      status: "ready",
      metadata: {
        anchor: {
          id: codingHomeworkContentItem.id,
          depth: 1,
          path: ["Week 3: Labyrinthe et parcours en profondeur"],
          title: codingHomeworkContentItem.titleSnapshot,
          updatedAt: codingHomeworkContentItem.updatedAt.toISOString()
        },
        generatedAt: new Date("2026-05-29T12:00:00.000Z").toISOString(),
        includedResources: [
          {
            contentResourceId: tp1AssignmentResource.id,
            contentTypeKey: tp1AssignmentResource.contentTypeKey,
            depth: 1,
            groupId: tp1AssignmentResource.groupId,
            itemId: tp1AssignmentContentItem.id,
            materialId: null,
            orderIndex: 0,
            path: ["Week 3: Labyrinthe et parcours en profondeur"],
            pluginKey: tp1AssignmentResource.pluginKey,
            resourceFingerprint: "seed-tp1-labyrinth-assignment",
            sourceKind: "content_resource",
            title: tp1AssignmentContentItem.titleSnapshot,
            updatedAt: tp1AssignmentResource.updatedAt.toISOString()
          },
          {
            contentResourceId: tp1StarterFilesResource.id,
            contentTypeKey: tp1StarterFilesResource.contentTypeKey,
            depth: 1,
            groupId: tp1StarterFilesResource.groupId,
            itemId: tp1StarterFilesContentItem.id,
            materialId: null,
            orderIndex: 1,
            path: ["Week 3: Labyrinthe et parcours en profondeur"],
            pluginKey: tp1StarterFilesResource.pluginKey,
            resourceFingerprint: "seed-tp1-labyrinth-starter-files",
            sourceKind: "content_resource",
            title: tp1StarterFilesContentItem.titleSnapshot,
            updatedAt: tp1StarterFilesResource.updatedAt.toISOString()
          }
        ],
        resourceCount: 2,
        seed: true
      }
    }
  });

  await upsertCourseContentItem({
    id: "seed-content-section-a-web-design",
    courseId: course.id,
    kind: "activity",
    titleSnapshot: "Capstone practice: Responsive profile card",
    position: 2,
    activityId: "seed-activity-web-design-profile-card",
    metadata: { seed: true, note: "Root-level item to test mixed folder/root layout." }
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
    await codingExercisesPrisma.$disconnect();
    await codingHomeworkGraderPrisma.$disconnect();
    await webDesignCodingExercisesPrisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    await codingExercisesPrisma.$disconnect();
    await codingHomeworkGraderPrisma.$disconnect();
    await webDesignCodingExercisesPrisma.$disconnect();
    process.exit(1);
  });
