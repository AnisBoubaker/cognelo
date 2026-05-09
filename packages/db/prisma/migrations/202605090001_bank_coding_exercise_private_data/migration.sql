CREATE TABLE "PluginBankCodingExerciseHiddenTest" (
  "id" TEXT NOT NULL,
  "bankActivityId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "stdin" TEXT NOT NULL DEFAULT '',
  "expectedOutput" TEXT NOT NULL DEFAULT '',
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "weight" INTEGER NOT NULL DEFAULT 1,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PluginBankCodingExerciseHiddenTest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PluginBankCodingExerciseReferenceSolution" (
  "id" TEXT NOT NULL,
  "bankActivityId" TEXT NOT NULL,
  "sourceCode" TEXT NOT NULL,
  "privateConfig" JSONB NOT NULL DEFAULT '{}',
  "validationSummary" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PluginBankCodingExerciseReferenceSolution_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PluginBankCodingExerciseHiddenTest_bankActivityId_order_idx" ON "PluginBankCodingExerciseHiddenTest"("bankActivityId", "orderIndex");
CREATE INDEX "PluginBankCodingExerciseHiddenTest_bankActivityId_isEnabled_idx" ON "PluginBankCodingExerciseHiddenTest"("bankActivityId", "isEnabled");
CREATE UNIQUE INDEX "PluginBankCodingExerciseReferenceSolution_bankActivityId_key" ON "PluginBankCodingExerciseReferenceSolution"("bankActivityId");

ALTER TABLE "PluginBankCodingExerciseHiddenTest" ADD CONSTRAINT "PluginBankCodingExerciseHiddenTest_bankActivityId_fkey" FOREIGN KEY ("bankActivityId") REFERENCES "BankActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PluginBankCodingExerciseReferenceSolution" ADD CONSTRAINT "PluginBankCodingExerciseReferenceSolution_bankActivityId_fkey" FOREIGN KEY ("bankActivityId") REFERENCES "BankActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
