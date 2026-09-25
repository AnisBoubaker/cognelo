import bcrypt from "bcryptjs";
import { createHmac } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { ActivateAccountInputSchema, type CourseGroupParticipantRole, type CurrentUser } from "@cognelo/contracts";
import { prisma } from "@cognelo/db";
import { AppError, unauthorized } from "./errors";

const encoder = new TextEncoder();

export type AuthUser = CurrentUser;

type StudentAccessDb = Pick<typeof prisma, "role" | "userRole" | "courseMembership">;

function jwtSecret(secret: string) {
  return encoder.encode(secret);
}

export async function loginWithPassword(email: string, password: string, secret: string) {
  const normalizedEmail = email.toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { roles: { include: { role: true } } }
  });

  if (!user || !user.isActive) {
    const pendingParticipant = await prisma.courseGroupParticipant.findFirst({
      where: { email: normalizedEmail, userId: null }
    });
    if (pendingParticipant) {
      throw new AppError(
        403,
        "PENDING_ACCOUNT_SETUP",
        "This email has been added to a group. Choose a password to activate the account."
      );
    }
    throw unauthorized();
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw unauthorized();
  }

  return signInUser(user, secret);
}

export async function verifyAuthToken(token: string | undefined, secret: string) {
  return (await verifyAuthSession(token, secret)).user;
}

export async function refreshAuthSession(token: string | undefined, secret: string) {
  const session = await verifyAuthSession(token, secret);
  return {
    user: session.user,
    token: await createAuthToken(session.user, session.authVersion, secret)
  };
}

async function verifyAuthSession(token: string | undefined, secret: string) {
  if (!token) {
    throw unauthorized();
  }

  let payload: Awaited<ReturnType<typeof jwtVerify>>["payload"];
  try {
    ({ payload } = await jwtVerify(token, jwtSecret(secret)));
  } catch (error) {
    logSessionRejection(sessionVerificationFailureReason(error), sessionRejectionUserId(error), secret);
    throw unauthorized();
  }

  const userId = payload.sub;
  if (!userId) {
    logSessionRejection("missing_subject");
    throw unauthorized();
  }

  // Database and infrastructure errors must remain server errors. Treating them
  // as invalid credentials makes a temporary outage sign every active user out.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: { include: { role: true } } }
  });
  if (!user) {
    logSessionRejection("user_missing", userId, secret);
    throw unauthorized();
  }
  if (!user.isActive) {
    logSessionRejection("user_inactive", userId, secret);
    throw unauthorized();
  }
  const tokenAuthVersion = typeof payload.authVersion === "number" ? payload.authVersion : 0;
  if (tokenAuthVersion !== (user.authVersion ?? 0)) {
    logSessionRejection("auth_version_mismatch", userId, secret);
    throw unauthorized();
  }

  return {
    user: toCurrentUser(user),
    authVersion: user.authVersion ?? 0
  };
}

function toCurrentUser(user: {
  id: string;
  email: string;
  name: string | null;
  firstName?: string | null;
  lastName?: string | null;
  roles: { role: { key: string } }[];
  mustChangePassword?: boolean;
  emailVerifiedAt?: Date | null;
}): CurrentUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    firstName: user.firstName ?? firstNameFromName(user.name),
    lastName: user.lastName ?? lastNameFromName(user.name),
    roles: user.roles.map((userRole) => userRole.role.key as CurrentUser["roles"][number]),
    mustChangePassword: Boolean(user.mustChangePassword),
    emailVerified: Boolean(user.emailVerifiedAt)
  };
}

export async function activatePendingAccount(input: unknown, secret: string) {
  const data = ActivateAccountInputSchema.parse(input);
  const normalizedEmail = data.email.toLowerCase();
  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existingUser) {
    throw new AppError(409, "ACCOUNT_ALREADY_EXISTS", "An account already exists for this email. Sign in with your password instead.");
  }

  const pendingParticipants = await prisma.courseGroupParticipant.findMany({
    where: { email: normalizedEmail, userId: null },
    include: { group: { select: { courseId: true } } }
  });

  if (!pendingParticipants.length) {
    throw new AppError(403, "ACCOUNT_ACTIVATION_NOT_ALLOWED", "This email is not eligible for first-time account activation.");
  }

  const firstParticipant = pendingParticipants[0];
  const passwordHash = await bcrypt.hash(data.password, 12);

  const user = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        email: normalizedEmail,
        name: buildName(firstParticipant.firstName, firstParticipant.lastName),
        firstName: firstParticipant.firstName,
        lastName: firstParticipant.lastName,
        passwordHash,
        isActive: true
      },
      include: { roles: { include: { role: true } } }
    });

    await ensureStudentRole(createdUser.id, tx);

    const courseRoles = new Map<string, CourseGroupParticipantRole>();
    for (const participant of pendingParticipants) {
      const current = courseRoles.get(participant.group.courseId);
      courseRoles.set(participant.group.courseId, highestParticipantRole(current, participant.role));
    }
    for (const [courseId, role] of courseRoles) {
      await ensureMembershipForParticipantRole(createdUser.id, courseId, role, tx);
    }

    await tx.courseGroupParticipant.updateMany({
      where: { email: normalizedEmail, userId: null },
      data: { userId: createdUser.id }
    });

    return tx.user.findUniqueOrThrow({
      where: { id: createdUser.id },
      include: { roles: { include: { role: true } } }
    });
  });

  return signInUser(user, secret);
}

async function signInUser(
  user: {
    id: string;
    email: string;
    name: string | null;
    roles: { role: { key: string } }[];
    authVersion?: number;
    mustChangePassword?: boolean;
    emailVerifiedAt?: Date | null;
  },
  secret: string
) {
  const currentUser = toCurrentUser(user);
  const token = await createAuthToken(currentUser, user.authVersion ?? 0, secret);

  return { user: currentUser, token };
}

async function createAuthToken(user: CurrentUser, authVersion: number, secret: string) {
  return new SignJWT({
    roles: user.roles,
    email: user.email,
    name: user.name,
    authVersion
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(jwtSecret(secret));
}

type SessionRejectionReason =
  | "token_expired"
  | "token_invalid"
  | "missing_subject"
  | "user_missing"
  | "user_inactive"
  | "auth_version_mismatch";

function sessionVerificationFailureReason(error: unknown): SessionRejectionReason {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ERR_JWT_EXPIRED"
    ? "token_expired"
    : "token_invalid";
}

function sessionRejectionUserId(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ERR_JWT_EXPIRED" &&
    "payload" in error &&
    typeof error.payload === "object" &&
    error.payload !== null &&
    "sub" in error.payload &&
    typeof error.payload.sub === "string"
  ) {
    return error.payload.sub;
  }
  return undefined;
}

function logSessionRejection(reason: SessionRejectionReason, userId?: string, secret?: string) {
  const sessionReference = userId && secret
    ? createHmac("sha256", secret).update(`auth-session:${userId}`).digest("hex").slice(0, 16)
    : undefined;
  console.warn(JSON.stringify({ event: "auth_session_rejected", reason, ...(sessionReference ? { sessionReference } : {}) }));
}

async function ensureStudentRole(userId: string, tx: StudentAccessDb = prisma) {
  const role = await tx.role.findUnique({ where: { key: "student" } });
  if (!role) {
    throw new AppError(500, "ROLE_NOT_FOUND", "The student role is not configured.");
  }

  await tx.userRole.upsert({
    where: { userId_roleId: { userId, roleId: role.id } },
    update: {},
    create: { userId, roleId: role.id }
  });
}

async function ensureStudentMembership(userId: string, courseId: string, tx: StudentAccessDb = prisma) {
  await tx.courseMembership.upsert({
    where: {
      courseId_userId_role: {
        courseId,
        userId,
        role: "student"
      }
    },
    update: {},
    create: {
      courseId,
      userId,
      role: "student"
    }
  });
}

async function ensureMembershipForParticipantRole(
  userId: string,
  courseId: string,
  role: CourseGroupParticipantRole,
  tx: StudentAccessDb = prisma
) {
  if (role === "student") {
    await ensureStudentMembership(userId, courseId, tx);
    return;
  }

  await tx.courseMembership.upsert({
    where: {
      courseId_userId_role: {
        courseId,
        userId,
        role
      }
    },
    update: {},
    create: {
      courseId,
      userId,
      role
    }
  });
}

function highestParticipantRole(
  current: CourseGroupParticipantRole | undefined,
  next: CourseGroupParticipantRole
): CourseGroupParticipantRole {
  const rank: Record<CourseGroupParticipantRole, number> = {
    teacher: 3,
    ta: 2,
    student: 1
  };

  if (!current || rank[next] > rank[current]) {
    return next;
  }
  return current;
}

function buildName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim();
}

function firstNameFromName(name: string | null) {
  const trimmed = name?.trim() ?? "";
  if (!trimmed) {
    return null;
  }
  return trimmed.split(/\s+/)[0] ?? null;
}

function lastNameFromName(name: string | null) {
  const trimmed = name?.trim() ?? "";
  if (!trimmed.includes(" ")) {
    return null;
  }
  return trimmed.split(/\s+/).slice(1).join(" ");
}
