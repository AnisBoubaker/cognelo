import bcrypt from "bcryptjs";
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
  if (!token) {
    throw unauthorized();
  }

  try {
    const { payload } = await jwtVerify(token, jwtSecret(secret));
    const userId = payload.sub;
    if (!userId) {
      throw unauthorized();
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } }
    });
    if (!user || !user.isActive) {
      throw unauthorized();
    }
    return toCurrentUser(user);
  } catch {
    throw unauthorized();
  }
}

function toCurrentUser(user: {
  id: string;
  email: string;
  name: string | null;
  roles: { role: { key: string } }[];
}): CurrentUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roles: user.roles.map((userRole) => userRole.role.key as CurrentUser["roles"][number])
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
  },
  secret: string
) {
  const currentUser = toCurrentUser(user);
  const token = await new SignJWT({
    roles: currentUser.roles,
    email: currentUser.email,
    name: currentUser.name
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(currentUser.id)
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(jwtSecret(secret));

  return { user: currentUser, token };
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
