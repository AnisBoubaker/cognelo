import { listActivityPlugins } from "@cognelo/activity-sdk";
import { listContentTypePlugins } from "@cognelo/content-type-sdk";
import "@cognelo/plugin-registry/activity";
import "@cognelo/plugin-registry/content";
import { prisma } from "@cognelo/db";

async function main() {
  for (const plugin of [...listActivityPlugins(), ...listContentTypePlugins()]) {
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
