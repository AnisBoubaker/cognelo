import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import {
  EmailVerificationCodeInputSchema,
  EmailVerificationRequestSchema,
  type CurrentUser,
  type UiLocale
} from "@cognelo/contracts";
import { prisma } from "@cognelo/db";
import { AppError, unauthorized } from "./errors";
import { sendSystemEmailToEligibleRecipient } from "./email-delivery";

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

type VerificationMessage = {
  recipientEmail: string;
  subject: string;
  text: string;
  html: string;
};

type VerificationDependencies = {
  now?: () => Date;
  generateCode?: () => string;
  deliver?: (message: VerificationMessage, encryptionKey: string | undefined) => Promise<unknown>;
};

const verificationMessages: Record<UiLocale, {
  subject: string;
  intro: string;
  expires: string;
  ignore: string;
}> = {
  en: {
    subject: "Verify your Cognelo email address",
    intro: "Your Cognelo verification code is:",
    expires: "This code expires in 10 minutes.",
    ignore: "If you did not try to sign in, you can ignore this message."
  },
  fr: {
    subject: "Vérifiez votre adresse courriel Cognelo",
    intro: "Votre code de vérification Cognelo est :",
    expires: "Ce code expire dans 10 minutes.",
    ignore: "Si vous n’avez pas essayé de vous connecter, vous pouvez ignorer ce message."
  },
  zh: {
    subject: "验证您的 Cognelo 电子邮件地址",
    intro: "您的 Cognelo 验证码是：",
    expires: "此验证码将在 10 分钟后过期。",
    ignore: "如果您没有尝试登录，可以忽略此邮件。"
  },
  ar: {
    subject: "تحقق من عنوان بريدك الإلكتروني في Cognelo",
    intro: "رمز التحقق الخاص بك في Cognelo هو:",
    expires: "تنتهي صلاحية هذا الرمز خلال 10 دقائق.",
    ignore: "إذا لم تحاول تسجيل الدخول، يمكنك تجاهل هذه الرسالة."
  }
};

export async function requestEmailVerification(
  user: CurrentUser,
  input: unknown,
  encryptionKey: string | undefined,
  dependencies: VerificationDependencies = {}
) {
  const { locale } = EmailVerificationRequestSchema.parse(input);
  const now = (dependencies.now ?? (() => new Date()))();
  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true, emailVerifiedAt: true, isActive: true }
  });
  if (!account?.isActive) {
    throw unauthorized();
  }
  if (account.emailVerifiedAt) {
    return { required: false as const, sent: false as const, retryAfterSeconds: 0, expiresInSeconds: 0 };
  }

  const existing = await prisma.emailVerificationChallenge.findUnique({ where: { userId: user.id } });
  const retryAfterMs = existing ? existing.sentAt.getTime() + RESEND_COOLDOWN_MS - now.getTime() : 0;
  if (retryAfterMs > 0) {
    return {
      required: true as const,
      sent: false as const,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      expiresInSeconds: Math.max(0, Math.ceil((existing!.expiresAt.getTime() - now.getTime()) / 1000))
    };
  }

  const key = verificationKey(encryptionKey);
  const code = (dependencies.generateCode ?? generateVerificationCode)();
  if (!/^\d{6}$/.test(code)) {
    throw new AppError(500, "EMAIL_VERIFICATION_CODE_INVALID", "The verification code generator returned an invalid code.");
  }
  const expiresAt = new Date(now.getTime() + CODE_TTL_MS);
  const deliver = dependencies.deliver ?? sendSystemEmailToEligibleRecipient;
  const message = verificationMessages[locale];
  const direction = locale === "ar" ? "rtl" : "ltr";
  await deliver(
    {
      recipientEmail: account.email,
      subject: message.subject,
      text: `${message.intro}\n\n${code}\n\n${message.expires} ${message.ignore}`,
      html: `<div lang="${locale}" dir="${direction}"><p>${message.intro}</p><p style="font-size: 28px; font-weight: 700; letter-spacing: 0.2em">${code}</p><p>${message.expires} ${message.ignore}</p></div>`
    },
    encryptionKey
  );

  await prisma.emailVerificationChallenge.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      codeHash: hashCode(user.id, code, key),
      expiresAt,
      sentAt: now,
      failedAttempts: 0
    },
    update: {
      codeHash: hashCode(user.id, code, key),
      expiresAt,
      sentAt: now,
      failedAttempts: 0
    }
  });

  return {
    required: true as const,
    sent: true as const,
    retryAfterSeconds: RESEND_COOLDOWN_MS / 1000,
    expiresInSeconds: CODE_TTL_MS / 1000
  };
}

export async function verifyEmailAddress(
  user: CurrentUser,
  input: unknown,
  encryptionKey: string | undefined,
  dependencies: Pick<VerificationDependencies, "now"> = {}
) {
  const { code } = EmailVerificationCodeInputSchema.parse(input);
  const now = (dependencies.now ?? (() => new Date()))();
  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { emailVerifiedAt: true, isActive: true }
  });
  if (!account?.isActive) {
    throw unauthorized();
  }
  if (account.emailVerifiedAt) {
    return { verified: true as const };
  }

  const challenge = await prisma.emailVerificationChallenge.findUnique({ where: { userId: user.id } });
  if (!challenge) {
    throw new AppError(400, "EMAIL_VERIFICATION_CODE_MISSING", "Request a verification code before continuing.");
  }
  if (challenge.expiresAt.getTime() <= now.getTime()) {
    await prisma.emailVerificationChallenge.deleteMany({ where: { userId: user.id } });
    throw new AppError(400, "EMAIL_VERIFICATION_CODE_EXPIRED", "The verification code has expired. Request a new code.");
  }
  if (challenge.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    throw new AppError(429, "EMAIL_VERIFICATION_ATTEMPTS_EXCEEDED", "Too many incorrect attempts. Request a new code.");
  }

  const expectedHash = hashCode(user.id, code, verificationKey(encryptionKey));
  if (!safeHashEquals(challenge.codeHash, expectedHash)) {
    const updatedChallenge = await prisma.emailVerificationChallenge.update({
      where: { userId: user.id },
      data: { failedAttempts: { increment: 1 } },
      select: { failedAttempts: true }
    });
    const failedAttempts = updatedChallenge.failedAttempts;
    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      throw new AppError(429, "EMAIL_VERIFICATION_ATTEMPTS_EXCEEDED", "Too many incorrect attempts. Request a new code.");
    }
    throw new AppError(400, "EMAIL_VERIFICATION_CODE_INCORRECT", "The verification code is incorrect.", {
      remainingAttempts: MAX_FAILED_ATTEMPTS - failedAttempts
    });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: now }
    }),
    prisma.emailVerificationChallenge.delete({ where: { userId: user.id } })
  ]);
  return { verified: true as const };
}

function generateVerificationCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function verificationKey(encryptionKey: string | undefined) {
  if (!encryptionKey || !/^[A-Fa-f0-9]{64}$/.test(encryptionKey)) {
    throw new AppError(
      500,
      "EMAIL_ENCRYPTION_KEY_MISSING",
      "EMAIL_CREDENTIALS_ENCRYPTION_KEY must be configured before email verification can be used."
    );
  }
  return Buffer.from(encryptionKey, "hex");
}

function hashCode(userId: string, code: string, key: Buffer) {
  return createHmac("sha256", key).update(`${userId}:${code}`).digest("hex");
}

function safeHashEquals(actual: string, expected: string) {
  if (!/^[A-Fa-f0-9]{64}$/.test(actual)) {
    return false;
  }
  return timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}
