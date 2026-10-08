import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import {
  ExecutionRunnerConfigurationInputSchema,
  ExecutionRunnerTypeSchema,
  type CurrentUser,
  type ExecutionRunnerConfigurationInput,
  type ExecutionRunnerType
} from "@cognelo/contracts";
import { prisma } from "@cognelo/db";
import { isAdmin } from "./authorization";
import { AppError, forbidden } from "./errors";

const ENCRYPTION_VERSION = "v1";
const runnerTypes = ExecutionRunnerTypeSchema.options;

type RunnerSettings = {
  enablePerProcessAndThreadLimits: boolean;
};

type RunnerDependencies = {
  fetch?: typeof fetch;
};

export type ResolvedExecutionRunner = {
  id: string;
  runnerType: ExecutionRunnerType;
  baseUrl: string;
  headers: Record<string, string>;
  settings: RunnerSettings;
};

export async function listExecutionRunnerConfigurations(user: CurrentUser) {
  assertAdmin(user);
  const configurations = await prisma.executionRunner.findMany({
    where: { id: { in: runnerTypes.map(primaryRunnerId) } },
    orderBy: [{ runnerType: "asc" }, { position: "asc" }]
  });
  const byType = new Map(configurations.map((configuration) => [configuration.runnerType, configuration]));
  return runnerTypes.map((runnerType) => toPublicConfiguration(runnerType, byType.get(runnerType) ?? null));
}

export async function updateExecutionRunnerConfiguration(
  user: CurrentUser,
  runnerTypeInput: unknown,
  input: unknown,
  encryptionKey: string | undefined
) {
  assertAdmin(user);
  const runnerType = ExecutionRunnerTypeSchema.parse(runnerTypeInput);
  const data = ExecutionRunnerConfigurationInputSchema.parse(input);
  const id = primaryRunnerId(runnerType);
  const existing = await prisma.executionRunner.findUnique({ where: { id } });
  const authHeader = data.authHeader || null;
  const canRetainToken = Boolean(
    authHeader &&
    existing?.authHeader === authHeader &&
    existing.authTokenEncrypted
  );
  if (authHeader && !data.authToken && !canRetainToken) {
    throw new AppError(400, "RUNNER_AUTH_TOKEN_REQUIRED", "An authentication token is required for this header.");
  }

  const persistence = {
    runnerType,
    displayName: data.displayName,
    baseUrl: normalizeBaseUrl(data.baseUrl),
    authHeader,
    authTokenEncrypted: authHeader
      ? data.authToken
        ? encryptSecret(data.authToken, encryptionKey)
        : existing?.authTokenEncrypted ?? null
      : null,
    isEnabled: data.isEnabled,
    position: 0,
    settings: normalizedSettings(runnerType, data),
    updatedById: user.id
  };
  const configuration = await prisma.executionRunner.upsert({
    where: { id },
    create: { id, ...persistence },
    update: persistence
  });
  return toPublicConfiguration(runnerType, configuration);
}

/**
 * Resolves the first enabled runner. Keeping selection behind this boundary
 * lets a future pool add round-robin selection without changing plugins.
 */
export async function resolveExecutionRunner(
  runnerTypeInput: unknown,
  encryptionKey: string | undefined
): Promise<ResolvedExecutionRunner> {
  const runnerType = ExecutionRunnerTypeSchema.parse(runnerTypeInput);
  const configuration = await prisma.executionRunner.findFirst({
    where: { runnerType, isEnabled: true },
    orderBy: [{ position: "asc" }, { id: "asc" }]
  });
  if (!configuration) {
    throw runnerNotConfigured(runnerType);
  }
  return resolvedConfiguration(configuration, runnerType, encryptionKey);
}

function resolvedConfiguration(
  configuration: {
    id: string;
    baseUrl: string;
    authHeader: string | null;
    authTokenEncrypted: string | null;
    settings: unknown;
  },
  runnerType: ExecutionRunnerType,
  encryptionKey: string | undefined
): ResolvedExecutionRunner {
  const headers: Record<string, string> = {};
  if (configuration.authHeader) {
    if (!configuration.authTokenEncrypted) {
      throw invalidStoredConfiguration();
    }
    headers[configuration.authHeader] = decryptSecret(configuration.authTokenEncrypted, encryptionKey);
  }
  return {
    id: configuration.id,
    runnerType,
    baseUrl: configuration.baseUrl,
    headers,
    settings: parseSettings(configuration.settings)
  };
}

export async function testExecutionRunnerConnection(
  user: CurrentUser,
  runnerTypeInput: unknown,
  encryptionKey: string | undefined,
  dependencies: RunnerDependencies = {}
) {
  assertAdmin(user);
  const runnerType = ExecutionRunnerTypeSchema.parse(runnerTypeInput);
  const configuration = await prisma.executionRunner.findUnique({ where: { id: primaryRunnerId(runnerType) } });
  if (!configuration) throw runnerNotConfigured(runnerType);
  const runner = resolvedConfiguration(configuration, runnerType, encryptionKey);
  const fetchImplementation = dependencies.fetch ?? fetch;
  return runner.runnerType === "judge0"
    ? testJudge0Capabilities(runner, fetchImplementation)
    : testHealthCapabilities(runner, fetchImplementation);
}

type CapabilityResult = {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
};

async function testJudge0Capabilities(runner: ResolvedExecutionRunner, fetchImplementation: typeof fetch) {
  const capabilities: CapabilityResult[] = [];
  let languages: Array<{ id: number; name: string }>;
  try {
    const response = await fetchImplementation(`${runner.baseUrl}/languages`, {
      headers: runner.headers,
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const body = await response.json();
    if (!Array.isArray(body)) throw new Error("The languages response is invalid.");
    languages = body.filter((entry): entry is { id: number; name: string } => (
      Boolean(entry) && typeof entry === "object" &&
      typeof (entry as { id?: unknown }).id === "number" &&
      typeof (entry as { name?: unknown }).name === "string"
    ));
    capabilities.push({ key: "connection", label: "Endpoint and authentication", ok: true, detail: "Connection succeeded." });
  } catch (error) {
    capabilities.push({
      key: "connection",
      label: "Endpoint and authentication",
      ok: false,
      detail: error instanceof Error ? error.message : "Unknown connection error."
    });
    capabilities.push({ key: "languages", label: "Language discovery", ok: false, detail: "Could not be checked." });
    capabilities.push({ key: "execute", label: "Synchronous sandbox execution", ok: false, detail: "Could not be checked." });
    return { ok: false, capabilities };
  }

  capabilities.push({
    key: "languages",
    label: "Language discovery",
    ok: languages.length > 0,
    detail: languages.length ? `${languages.length} runtimes available.` : "No runtimes are available."
  });

  const smokeTest = judge0SmokeTest(languages);
  if (!smokeTest) {
    capabilities.push({
      key: "execute",
      label: "Synchronous sandbox execution",
      ok: false,
      detail: "A C, Python, JavaScript, or Bash runtime is required for the execution check."
    });
  } else {
    try {
      const executionResponse = await fetchImplementation(
        `${runner.baseUrl}/submissions?base64_encoded=true&wait=true`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...runner.headers },
          signal: AbortSignal.timeout(10000),
          body: JSON.stringify({
            language_id: smokeTest.languageId,
            source_code: Buffer.from(smokeTest.sourceCode, "utf8").toString("base64"),
            expected_output: Buffer.from("cognelo-runner-check\n", "utf8").toString("base64"),
            enable_per_process_and_thread_time_limit: runner.settings.enablePerProcessAndThreadLimits,
            enable_per_process_and_thread_memory_limit: runner.settings.enablePerProcessAndThreadLimits
          })
        }
      );
      const executionBody = await executionResponse.json().catch(() => ({})) as {
        token?: unknown;
        status?: { id?: unknown; description?: unknown };
      };
      const accepted = executionResponse.ok && executionBody.status?.id === 3;
      capabilities.push({
        key: "execute",
        label: "Synchronous sandbox execution",
        ok: accepted,
        detail: accepted
          ? `Execution succeeded with ${smokeTest.languageName}.`
          : `Execution check failed${executionBody.status?.description ? `: ${String(executionBody.status.description)}` : ` (HTTP ${executionResponse.status})`}.`
      });
    } catch (error) {
      capabilities.push({
        key: "execute",
        label: "Synchronous sandbox execution",
        ok: false,
        detail: error instanceof Error ? error.message : "Unknown execution error."
      });
    }
  }
  return { ok: capabilities.length > 0 && capabilities.every((capability) => capability.ok), capabilities };
}

async function testHealthCapabilities(runner: ResolvedExecutionRunner, fetchImplementation: typeof fetch) {
  const requiredCapabilities = runner.runnerType === "web_design"
    ? ["run", "screenshot"]
    : ["sagemath", "execute"];
  const capabilities: CapabilityResult[] = [];
  try {
    const response = await fetchImplementation(`${runner.baseUrl}/health`, {
      headers: runner.headers,
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json().catch(() => ({})) as { ok?: unknown; capabilities?: unknown };
    capabilities.push({
      key: "connection",
      label: "Endpoint and authentication",
      ok: body.ok === true,
      detail: body.ok === true ? "Health check succeeded." : "The health response did not report success."
    });
    const advertised = Array.isArray(body.capabilities)
      ? body.capabilities.filter((value): value is string => typeof value === "string")
      : [];
    for (const capability of requiredCapabilities) {
      const available = advertised.includes(capability);
      capabilities.push({
        key: capability,
        label: capability === "run" ? "Automated browser tests"
          : capability === "screenshot" ? "Screenshot capture"
            : capability === "sagemath" ? "SageMath runtime"
              : "Code execution",
        ok: available,
        detail: available ? "Advertised by the runner." : "Not advertised by the runner health response."
      });
    }
  } catch (error) {
    capabilities.push({
      key: "connection",
      label: "Endpoint and authentication",
      ok: false,
      detail: error instanceof Error ? error.message : "Unknown connection error."
    });
    for (const capability of requiredCapabilities) {
      capabilities.push({ key: capability, label: capability, ok: false, detail: "Could not be checked." });
    }
  }
  return { ok: capabilities.every((capability) => capability.ok), capabilities };
}

function judge0SmokeTest(languages: Array<{ id: number; name: string }>) {
  const candidates = [
    { pattern: /^C \(/i, sourceCode: "#include <stdio.h>\nint main(void) { puts(\"cognelo-runner-check\"); return 0; }" },
    { pattern: /^Python \(3/i, sourceCode: "print('cognelo-runner-check')" },
    { pattern: /^(JavaScript|Node\.js)/i, sourceCode: "console.log('cognelo-runner-check');" },
    { pattern: /^Bash /i, sourceCode: "printf 'cognelo-runner-check\\n'" }
  ];
  for (const candidate of candidates) {
    const language = languages.find((entry) => candidate.pattern.test(entry.name));
    if (language) return { languageId: language.id, languageName: language.name, sourceCode: candidate.sourceCode };
  }
  return null;
}

function normalizedSettings(runnerType: ExecutionRunnerType, data: ExecutionRunnerConfigurationInput) {
  return runnerType === "judge0"
    ? { enablePerProcessAndThreadLimits: data.settings.enablePerProcessAndThreadLimits }
    : {};
}

function parseSettings(value: unknown): RunnerSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { enablePerProcessAndThreadLimits: true };
  }
  const settings = value as Record<string, unknown>;
  return {
    enablePerProcessAndThreadLimits: typeof settings.enablePerProcessAndThreadLimits === "boolean"
      ? settings.enablePerProcessAndThreadLimits
      : true
  };
}

function toPublicConfiguration(
  runnerType: ExecutionRunnerType,
  configuration: {
    id: string;
    displayName: string;
    baseUrl: string;
    authHeader: string | null;
    authTokenEncrypted: string | null;
    isEnabled: boolean;
    position: number;
    settings: unknown;
    updatedAt: Date;
  } | null
) {
  return configuration
    ? {
        configured: true as const,
        id: configuration.id,
        runnerType,
        displayName: configuration.displayName,
        baseUrl: configuration.baseUrl,
        authHeader: configuration.authHeader ?? "",
        hasAuthToken: Boolean(configuration.authTokenEncrypted),
        isEnabled: configuration.isEnabled,
        position: configuration.position,
        settings: parseSettings(configuration.settings),
        updatedAt: configuration.updatedAt.toISOString()
      }
    : {
        configured: false as const,
        id: null,
        runnerType,
        displayName: runnerLabel(runnerType),
        baseUrl: "",
        authHeader: runnerType === "judge0" ? "X-Auth-Token" : "",
        hasAuthToken: false,
        isEnabled: false,
        position: 0,
        settings: { enablePerProcessAndThreadLimits: true },
        updatedAt: null
      };
}

function primaryRunnerId(runnerType: ExecutionRunnerType) {
  return `execution-runner-${runnerType}-primary`;
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function runnerLabel(runnerType: ExecutionRunnerType) {
  if (runnerType === "judge0") return "Judge0";
  if (runnerType === "web_design") return "Web Design runner";
  return "SageMath runner";
}

function encryptSecret(secret: string, encryptionKey: string | undefined) {
  const key = encryptionKeyBytes(encryptionKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [ENCRYPTION_VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(":");
}

function decryptSecret(value: string, encryptionKey: string | undefined) {
  const key = encryptionKeyBytes(encryptionKey);
  const [version, ivValue, tagValue, ciphertextValue, ...extra] = value.split(":");
  if (version !== ENCRYPTION_VERSION || !ivValue || !tagValue || !ciphertextValue || extra.length) {
    throw invalidStoredConfiguration();
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, "base64url")),
      decipher.final()
    ]).toString("utf8");
  } catch {
    throw invalidStoredConfiguration();
  }
}

function encryptionKeyBytes(encryptionKey: string | undefined) {
  if (!encryptionKey || !/^[A-Fa-f0-9]{64}$/.test(encryptionKey)) {
    throw new AppError(
      500,
      "RUNNER_ENCRYPTION_KEY_MISSING",
      "EMAIL_CREDENTIALS_ENCRYPTION_KEY must be configured before runner credentials can be stored or used."
    );
  }
  return Buffer.from(encryptionKey, "hex");
}

function invalidStoredConfiguration() {
  return new AppError(500, "RUNNER_CREDENTIALS_INVALID", "The saved runner credential cannot be read.");
}

function runnerNotConfigured(runnerType: ExecutionRunnerType) {
  return new AppError(
    503,
    "EXECUTION_RUNNER_NOT_CONFIGURED",
    `${runnerLabel(runnerType)} is not configured. Ask an administrator to configure it in Settings → Runners.`
  );
}

function assertAdmin(user: CurrentUser) {
  if (!isAdmin(user)) throw forbidden();
}
