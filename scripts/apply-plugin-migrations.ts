import { listActivityPlugins } from "@cognelo/activity-sdk";
import { prisma } from "@cognelo/db";

async function main() {
  for (const plugin of listActivityPlugins()) {
    for (const migration of plugin.db.migrations ?? []) {
      console.log(`Applying plugin migration ${plugin.key}/${migration.id}`);
      for (const statement of migration.statements) {
        await prisma.$executeRawUnsafe(statement);
      }
    }
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
