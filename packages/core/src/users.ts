import bcrypt from "bcryptjs";
import { UserPasswordChangeSchema, UserProfileUpdateSchema, type CurrentUser } from "@cognelo/contracts";
import { prisma } from "@cognelo/db";
import { AppError, unauthorized } from "./errors";

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
    roles: updatedUser.roles.map((userRole) => userRole.role.key as CurrentUser["roles"][number])
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
    data: { passwordHash }
  });
  return { ok: true as const };
}
