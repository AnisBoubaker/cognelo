import bcrypt from "bcryptjs";
import {
  AdminUserCreateSchema,
  AdminUserFiltersSchema,
  AdminUserPasswordResetSchema,
  AdminUserUpdateSchema,
  UserPasswordChangeSchema,
  UserProfileUpdateSchema,
  type CurrentUser,
  type RoleKey
} from "@cognelo/contracts";
import { prisma } from "@cognelo/db";
import { isAdmin } from "./authorization";
import { AppError, forbidden, notFound, unauthorized } from "./errors";

const adminUserInclude = { roles: { include: { role: true } } } as const;

export async function listRoles(user: CurrentUser) {
  assertAdmin(user);
  return prisma.role.findMany({ orderBy: { name: "asc" } });
}

export async function listUsers(user: CurrentUser, input: unknown = {}) {
  assertAdmin(user);
  const filters = AdminUserFiltersSchema.parse(input);
  const where = {
    ...(filters.role ? { roles: { some: { role: { key: filters.role } } } } : {}),
    ...(filters.firstName ? { firstName: { contains: filters.firstName, mode: "insensitive" as const } } : {}),
    ...(filters.lastName ? { lastName: { contains: filters.lastName, mode: "insensitive" as const } } : {}),
    ...(filters.email ? { email: { contains: filters.email, mode: "insensitive" as const } } : {})
  };
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: adminUserInclude,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { email: "asc" }],
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize
    }),
    prisma.user.count({ where })
  ]);
  return {
    users: users.map(toAdminUser),
    pagination: { page: filters.page, pageSize: filters.pageSize, total, totalPages: Math.max(1, Math.ceil(total / filters.pageSize)) }
  };
}

export async function createUser(user: CurrentUser, input: unknown) {
  assertAdmin(user);
  const data = AdminUserCreateSchema.parse(input);
  const email = data.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new AppError(409, "USER_EMAIL_EXISTS", "A user with this email already exists.");
  }
  const roles = await resolveRoles(data.roles);
  const passwordHash = await bcrypt.hash(data.password, 12);
  const created = await prisma.user.create({
    data: {
      email,
      firstName: data.firstName,
      lastName: data.lastName,
      name: `${data.firstName} ${data.lastName}`.trim(),
      passwordHash,
      roles: { create: roles.map((role) => ({ roleId: role.id })) }
    },
    include: adminUserInclude
  });
  return toAdminUser(created);
}

export async function updateUser(user: CurrentUser, userId: string, input: unknown) {
  assertAdmin(user);
  const data = AdminUserUpdateSchema.parse(input);
  if (user.id === userId && !data.roles.includes("admin")) {
    throw new AppError(400, "CANNOT_REMOVE_OWN_ADMIN_ROLE", "You cannot remove your own administrator role.");
  }
  const existing = await prisma.user.findUnique({ where: { id: userId }, include: adminUserInclude });
  if (!existing) {
    throw notFound("User");
  }
  const email = data.email.toLowerCase();
  const emailChanged = email !== existing.email;
  const emailOwner = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (emailOwner && emailOwner.id !== userId) {
    throw new AppError(409, "USER_EMAIL_EXISTS", "A user with this email already exists.");
  }
  const roles = await resolveRoles(data.roles);
  if (emailChanged) {
    await prisma.emailVerificationChallenge.deleteMany({ where: { userId } });
  }
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      email,
      ...(emailChanged ? { emailVerifiedAt: null } : {}),
      firstName: data.firstName,
      lastName: data.lastName,
      name: `${data.firstName} ${data.lastName}`.trim(),
      roles: {
        deleteMany: {},
        create: roles.map((role) => ({ roleId: role.id }))
      }
    },
    include: adminUserInclude
  });
  return toAdminUser(updated);
}

export async function resetUserPassword(user: CurrentUser, userId: string, input: unknown) {
  assertAdmin(user);
  if (user.id === userId) {
    throw new AppError(400, "CANNOT_RESET_OWN_PASSWORD", "Change your own password from your profile instead.");
  }
  const data = AdminUserPasswordResetSchema.parse(input);
  const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!existing) {
    throw notFound("User");
  }
  const passwordHash = await bcrypt.hash(data.password, 12);
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      mustChangePassword: true,
      authVersion: { increment: 1 }
    }
  });
  return { ok: true as const };
}

function assertAdmin(user: CurrentUser) {
  if (!isAdmin(user)) throw forbidden();
}

async function resolveRoles(keys: RoleKey[]) {
  const uniqueKeys = [...new Set(keys)];
  const roles = await prisma.role.findMany({ where: { key: { in: uniqueKeys } }, select: { id: true, key: true, name: true } });
  if (roles.length !== uniqueKeys.length) {
    throw new AppError(400, "ROLE_NOT_FOUND", "One or more selected roles are not configured.");
  }
  return roles;
}

function toAdminUser(user: { id: string; email: string; firstName: string | null; lastName: string | null; name: string | null; isActive: boolean; mustChangePassword: boolean; emailVerifiedAt?: Date | null; createdAt: Date; updatedAt: Date; roles: { role: { key: string; name: string } }[] }) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    name: user.name,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    emailVerified: Boolean(user.emailVerifiedAt),
    roles: user.roles.map(({ role }) => ({ key: role.key as RoleKey, name: role.name })),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

export async function getMe(user: CurrentUser) {
  return user;
}

export async function updateMyProfile(user: CurrentUser, input: unknown) {
  const data = UserProfileUpdateSchema.parse(input);
  const firstName = data.firstName.trim();
  const lastName = data.lastName.trim();
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      firstName,
      lastName,
      name: `${firstName} ${lastName}`.trim()
    },
    include: { roles: { include: { role: true } } }
  });

  return {
    id: updatedUser.id,
    email: updatedUser.email,
    name: updatedUser.name,
    firstName: updatedUser.firstName,
    lastName: updatedUser.lastName,
    roles: updatedUser.roles.map((userRole) => userRole.role.key as CurrentUser["roles"][number]),
    mustChangePassword: updatedUser.mustChangePassword,
    emailVerified: Boolean(updatedUser.emailVerifiedAt)
  };
}

export async function changeMyPassword(user: CurrentUser, input: unknown) {
  const data = UserPasswordChangeSchema.parse(input);
  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isActive: true, passwordHash: true }
  });
  if (!account?.isActive) {
    throw unauthorized();
  }
  if (!(await bcrypt.compare(data.currentPassword, account.passwordHash))) {
    throw new AppError(400, "CURRENT_PASSWORD_INCORRECT", "The current password is incorrect.");
  }

  const passwordHash = await bcrypt.hash(data.newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false }
  });
  return { ok: true as const };
}
