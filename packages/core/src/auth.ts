import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { CurrentUser } from "@cognara/contracts";
import { prisma } from "@cognara/db";
import { unauthorized } from "./errors";

const encoder = new TextEncoder();

export type AuthUser = CurrentUser;

function jwtSecret(secret: string) {
  return encoder.encode(secret);
}

export async function loginWithPassword(email: string, password: string, secret: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { roles: { include: { role: true } } }
  });

  if (!user || !user.isActive) {
    throw unauthorized();
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw unauthorized();
  }

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
