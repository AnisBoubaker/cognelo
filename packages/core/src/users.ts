import { UserProfileUpdateSchema, type CurrentUser } from "@cognelo/contracts";
import { prisma } from "@cognelo/db";

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
