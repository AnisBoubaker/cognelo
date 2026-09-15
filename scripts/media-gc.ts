import { prisma } from "@cognelo/db";
import { collectMediaGarbage } from "@cognelo/core";

async function main() {
  const deleteFiles = process.argv.includes("--delete");
  const graceArgument = process.argv.find((argument) => argument.startsWith("--grace-days="));
  const graceDays = graceArgument ? Number(graceArgument.slice("--grace-days=".length)) : undefined;
  if (graceDays !== undefined && (!Number.isInteger(graceDays) || graceDays < 1)) {
    throw new Error("--grace-days must be a positive integer.");
  }
  const result = await collectMediaGarbage({ dryRun: !deleteFiles, graceDays });
  console.log(JSON.stringify(result, null, 2));
  if (!deleteFiles) {
    console.log("Dry run only. Pass --delete after reviewing the candidate count.");
  }
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
