import bcrypt from "bcryptjs";
import { prisma } from "@cognelo/db";
import { ensureActivityPluginInstallations, ensureContentTypePluginInstallations, ensureCoreActivityTypes } from "@cognelo/core";

const roleDefinitions = [
  ["admin", "Admin", "Full platform administration access."],
  ["course_manager", "Course manager", "Can create subjects and courses."],
  ["teacher", "Teacher", "Can create and manage courses and activities."],
  ["student", "Student", "Can participate in enrolled courses."]
] as const;

async function main() {
  const email = requiredEnvironmentValue("COGNELO_ADMIN_EMAIL").toLowerCase();
  const firstName = requiredEnvironmentValue("COGNELO_ADMIN_FIRST_NAME");
  const lastName = requiredEnvironmentValue("COGNELO_ADMIN_LAST_NAME");
  const password = requiredEnvironmentValue("COGNELO_ADMIN_PASSWORD");
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("COGNELO_ADMIN_EMAIL must be a valid email address.");
  if (password.length < 12 || password.length > 200) {
    throw new Error("COGNELO_ADMIN_PASSWORD must contain between 12 and 200 characters.");
  }

  for (const [key, name, description] of roleDefinitions) {
    await prisma.role.upsert({
      where: { key },
      update: { name, description },
      create: { key, name, description }
    });
  }
  await ensureCoreActivityTypes();
  await ensureActivityPluginInstallations();
  await ensureContentTypePluginInstallations();

  const role = await prisma.role.findUniqueOrThrow({ where: { key: "admin" } });
  const existing = await prisma.user.findUnique({ where: { email } });
  const user = existing ?? await prisma.user.create({
    data: {
      email,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`.trim(),
      passwordHash: await bcrypt.hash(password, 12),
      isActive: true
    }
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id }
  });

  console.log(existing
    ? `Existing account ${email} now has the admin role; its password was not changed.`
    : `Created production administrator ${email}.`);
}

function requiredEnvironmentValue(key: string) {
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`${key} is required.`);
  return value;
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
