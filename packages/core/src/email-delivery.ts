import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import {
  EmailDeliveryConfigurationInputSchema,
  EmailTestInputSchema,
  type CurrentUser,
  type EmailDeliveryConfigurationInput
} from "@cognelo/contracts";
import { prisma } from "@cognelo/db";
import nodemailer from "nodemailer";
import { isAdmin } from "./authorization";
import { AppError, forbidden } from "./errors";

const CONFIGURATION_ID = "global";
const ENCRYPTION_VERSION = "v1";

type StoredConfiguration = NonNullable<Awaited<ReturnType<typeof loadConfiguration>>>;
type MailMessage = {
  recipientEmail: string;
  subject: string;
  text: string;
  html: string;
};

type DeliveryDependencies = {
  createTransport?: typeof nodemailer.createTransport;
  fetch?: typeof fetch;
};

export async function getEmailDeliveryConfiguration(user: CurrentUser) {
  assertAdmin(user);
  return toPublicConfiguration(await loadConfiguration());
}

export async function updateEmailDeliveryConfiguration(
  user: CurrentUser,
  input: unknown,
  encryptionKey: string | undefined
) {
  assertAdmin(user);
  const data = EmailDeliveryConfigurationInputSchema.parse(input);
  const existing = await loadConfiguration();
  const persistence = configurationPersistence(data, existing, encryptionKey);

  const configuration = await prisma.emailDeliveryConfiguration.upsert({
    where: { id: CONFIGURATION_ID },
    create: {
      id: CONFIGURATION_ID,
      ...persistence,
      updatedById: user.id
    },
    update: {
      ...persistence,
      updatedById: user.id
    }
  });

  return toPublicConfiguration(configuration);
}

/**
 * Sends the administrator's explicit test message to any syntactically valid
 * address. This is deliberately the only delivery path exempt from Cognelo's
 * known-or-activating recipient rule.
 */
export async function sendEmailDeliveryTest(
  user: CurrentUser,
  input: unknown,
  encryptionKey: string | undefined,
  dependencies: DeliveryDependencies = {}
) {
  assertAdmin(user);
  const { recipientEmail } = EmailTestInputSchema.parse(input);
  await deliverConfiguredMessage(
    {
      recipientEmail: normalizeEmail(recipientEmail),
      subject: "Cognelo email delivery test",
      text: "This is a test message from Cognelo. If you received it, the configured email delivery route is working.",
      html: "<p>This is a test message from <strong>Cognelo</strong>.</p><p>If you received it, the configured email delivery route is working.</p>"
    },
    encryptionKey,
    dependencies
  );
  return { ok: true as const };
}

/**
 * Reusable path for future invitations and notifications. System messages may
 * only target an active Cognelo user or an unclaimed participant record that
 * is in the account-activation flow.
 */
export async function sendSystemEmailToEligibleRecipient(
  message: MailMessage,
  encryptionKey: string | undefined,
  dependencies: DeliveryDependencies = {}
) {
  const recipientEmail = normalizeEmail(EmailTestInputSchema.shape.recipientEmail.parse(message.recipientEmail));
  await assertEligibleSystemRecipient(recipientEmail);
  await deliverConfiguredMessage({ ...message, recipientEmail }, encryptionKey, dependencies);
  return { ok: true as const };
}

export async function assertEligibleSystemRecipient(recipientEmail: string) {
  const normalized = normalizeEmail(EmailTestInputSchema.shape.recipientEmail.parse(recipientEmail));
  const [user, pendingParticipant] = await Promise.all([
    prisma.user.findFirst({
      where: { email: { equals: normalized, mode: "insensitive" }, isActive: true },
      select: { id: true }
    }),
    prisma.courseGroupParticipant.findFirst({
      where: { email: { equals: normalized, mode: "insensitive" }, userId: null },
      select: { id: true }
    })
  ]);
  if (!user && !pendingParticipant) {
    throw new AppError(
      400,
      "EMAIL_RECIPIENT_NOT_ELIGIBLE",
      "System email can only be sent to an active user or a participant who is activating an account."
    );
  }
}

async function deliverConfiguredMessage(
  message: MailMessage,
  encryptionKey: string | undefined,
  dependencies: DeliveryDependencies
) {
  const configuration = await loadConfiguration();
  if (!configuration) {
    throw new AppError(400, "EMAIL_DELIVERY_NOT_CONFIGURED", "Email delivery has not been configured.");
  }

  try {
    if (configuration.transport === "microsoft_graph") {
      await deliverWithMicrosoftGraph(configuration, message, encryptionKey, dependencies.fetch ?? fetch);
    } else {
      const createTransport = dependencies.createTransport ?? nodemailer.createTransport;
      const transport = createTransport(smtpTransportOptions(configuration, encryptionKey));
      await transport.sendMail({
        from: { name: configuration.fromName, address: configuration.fromEmail },
        to: message.recipientEmail,
        subject: message.subject,
        text: message.text,
        html: message.html
      });
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error("Email delivery failed", error);
    throw new AppError(502, "EMAIL_DELIVERY_FAILED", "The email route rejected the message. Check the saved configuration and server logs.");
  }
}

function smtpTransportOptions(configuration: StoredConfiguration, encryptionKey: string | undefined) {
  if (!configuration.smtpHost || !configuration.smtpPort || !configuration.smtpSecurity) {
    throw invalidStoredConfiguration();
  }
  const password = configuration.smtpPasswordEncrypted
    ? decryptSecret(configuration.smtpPasswordEncrypted, encryptionKey)
    : null;
  if ((configuration.smtpUsername && !password) || (!configuration.smtpUsername && password)) {
    throw invalidStoredConfiguration();
  }

  return {
    host: configuration.smtpHost,
    port: configuration.smtpPort,
    secure: configuration.smtpSecurity === "tls",
    requireTLS: configuration.smtpSecurity === "starttls",
    ...(configuration.smtpUsername && password
      ? { auth: { user: configuration.smtpUsername, pass: password } }
      : {})
  };
}

function configurationPersistence(
  data: EmailDeliveryConfigurationInput,
  existing: StoredConfiguration | null,
  encryptionKey: string | undefined
) {
  if (data.transport === "microsoft_graph") {
    const canRetainSecret =
      existing?.transport === "microsoft_graph" &&
      existing.graphTenantId === data.graphTenantId &&
      existing.graphClientId === data.graphClientId &&
      Boolean(existing.graphClientSecretEncrypted);
    if (!data.graphClientSecret && !canRetainSecret) {
      throw new AppError(400, "MICROSOFT_GRAPH_SECRET_REQUIRED", "A Microsoft application client secret is required.");
    }
    return {
      transport: data.transport,
      fromName: data.fromName,
      fromEmail: normalizeEmail(data.fromEmail),
      smtpHost: null,
      smtpPort: null,
      smtpSecurity: null,
      smtpUsername: null,
      smtpPasswordEncrypted: null,
      graphTenantId: data.graphTenantId,
      graphClientId: data.graphClientId,
      graphClientSecretEncrypted: data.graphClientSecret
        ? encryptSecret(data.graphClientSecret, encryptionKey)
        : existing?.graphClientSecretEncrypted ?? null
    };
  }

  const username = data.smtpUsername || null;
  if (!username && data.smtpPassword) {
    throw new AppError(400, "SMTP_AUTH_INVALID", "An SMTP username is required when a password is provided.");
  }
  const canRetainPassword =
    existing?.transport === "smtp" &&
    existing.smtpUsername === username &&
    Boolean(existing.smtpPasswordEncrypted);
  if (username && !data.smtpPassword && !canRetainPassword) {
    throw new AppError(400, "SMTP_PASSWORD_REQUIRED", "An SMTP password is required for this username.");
  }

  return {
    transport: data.transport,
    fromName: data.fromName,
    fromEmail: normalizeEmail(data.fromEmail),
    smtpHost: data.smtpHost,
    smtpPort: data.smtpPort,
    smtpSecurity: data.smtpSecurity,
    smtpUsername: username,
    smtpPasswordEncrypted: username
      ? data.smtpPassword
        ? encryptSecret(data.smtpPassword, encryptionKey)
        : existing?.smtpPasswordEncrypted ?? null
      : null,
    graphTenantId: null,
    graphClientId: null,
    graphClientSecretEncrypted: null
  };
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
    throw new AppError(500, "EMAIL_CREDENTIALS_INVALID", "The stored email credential cannot be read.");
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, "base64url")),
      decipher.final()
    ]).toString("utf8");
  } catch {
    throw new AppError(500, "EMAIL_CREDENTIALS_INVALID", "The stored email credential cannot be decrypted with the server key.");
  }
}

function encryptionKeyBytes(encryptionKey: string | undefined) {
  if (!encryptionKey || !/^[A-Fa-f0-9]{64}$/.test(encryptionKey)) {
    throw new AppError(
      500,
      "EMAIL_ENCRYPTION_KEY_MISSING",
      "EMAIL_CREDENTIALS_ENCRYPTION_KEY must be configured before email credentials can be stored or used."
    );
  }
  return Buffer.from(encryptionKey, "hex");
}

async function loadConfiguration() {
  return prisma.emailDeliveryConfiguration.findUnique({ where: { id: CONFIGURATION_ID } });
}

function toPublicConfiguration(configuration: StoredConfiguration | null) {
  if (!configuration) {
    return {
      configured: false as const,
      transport: "smtp" as const,
      fromName: "Cognelo",
      fromEmail: "",
      smtpHost: "",
      smtpPort: 587,
      smtpSecurity: "starttls" as const,
      smtpUsername: "",
      hasSmtpPassword: false,
      graphTenantId: "",
      graphClientId: "",
      hasGraphClientSecret: false,
      updatedAt: null
    };
  }
  return {
    configured: true as const,
    transport: configuration.transport,
    fromName: configuration.fromName,
    fromEmail: configuration.fromEmail,
    smtpHost: configuration.smtpHost ?? "",
    smtpPort: configuration.smtpPort ?? 587,
    smtpSecurity: configuration.smtpSecurity ?? "starttls",
    smtpUsername: configuration.smtpUsername ?? "",
    hasSmtpPassword: Boolean(configuration.smtpPasswordEncrypted),
    graphTenantId: configuration.graphTenantId ?? "",
    graphClientId: configuration.graphClientId ?? "",
    hasGraphClientSecret: Boolean(configuration.graphClientSecretEncrypted),
    updatedAt: configuration.updatedAt.toISOString()
  };
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function assertAdmin(user: CurrentUser) {
  if (!isAdmin(user)) {
    throw forbidden();
  }
}

function invalidStoredConfiguration() {
  return new AppError(500, "EMAIL_CONFIGURATION_INVALID", "The saved email delivery configuration is incomplete.");
}

async function deliverWithMicrosoftGraph(
  configuration: StoredConfiguration,
  message: MailMessage,
  encryptionKey: string | undefined,
  fetchImplementation: typeof fetch
) {
  if (!configuration.graphTenantId || !configuration.graphClientId || !configuration.graphClientSecretEncrypted) {
    throw invalidStoredConfiguration();
  }
  const clientSecret = decryptSecret(configuration.graphClientSecretEncrypted, encryptionKey);
  const tokenResponse = await fetchImplementation(
    `https://login.microsoftonline.com/${encodeURIComponent(configuration.graphTenantId)}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: configuration.graphClientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials"
      })
    }
  );
  if (!tokenResponse.ok) {
    throw new Error(`Microsoft identity token request failed with status ${tokenResponse.status}.`);
  }
  const tokenBody = (await tokenResponse.json()) as { access_token?: unknown };
  if (typeof tokenBody.access_token !== "string" || !tokenBody.access_token) {
    throw new Error("Microsoft identity token response did not contain an access token.");
  }

  const sendResponse = await fetchImplementation(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(configuration.fromEmail)}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenBody.access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: {
          subject: message.subject,
          body: { contentType: "HTML", content: message.html },
          toRecipients: [{ emailAddress: { address: message.recipientEmail } }]
        },
        saveToSentItems: true
      })
    }
  );
  if (!sendResponse.ok) {
    throw new Error(`Microsoft Graph sendMail failed with status ${sendResponse.status}.`);
  }
}
