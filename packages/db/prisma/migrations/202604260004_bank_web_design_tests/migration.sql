CREATE TABLE "PluginBankWebDesignExerciseReferenceBundle" (
  "id" TEXT NOT NULL,
  "bankActivityId" TEXT NOT NULL,
  "files" JSONB NOT NULL DEFAULT '[]',
  "validationSummary" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PluginBankWebDesignExerciseReferenceBundle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PluginBankWebDesignExerciseTest" (
  "id" TEXT NOT NULL,
  "bankActivityId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" "PluginWebDesignExerciseTestKind" NOT NULL DEFAULT 'hidden',
  "testCode" TEXT NOT NULL,
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "weight" INTEGER NOT NULL DEFAULT 1,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "validationSummary" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PluginBankWebDesignExerciseTest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PluginBankWebDesignExerciseReferenceBundle_bankActivity_key" ON "PluginBankWebDesignExerciseReferenceBundle"("bankActivityId");
CREATE INDEX "PluginBankWebDesignExerciseTest_bankActivityId_kind_order_idx" ON "PluginBankWebDesignExerciseTest"("bankActivityId", "kind", "orderIndex");
CREATE INDEX "PluginBankWebDesignExerciseTest_bankActivityId_isEnabled_idx" ON "PluginBankWebDesignExerciseTest"("bankActivityId", "isEnabled");

ALTER TABLE "PluginBankWebDesignExerciseReferenceBundle" ADD CONSTRAINT "PluginBankWebDesignExerciseReferenceBundle_bankActivityId_fkey" FOREIGN KEY ("bankActivityId") REFERENCES "BankActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PluginBankWebDesignExerciseTest" ADD CONSTRAINT "PluginBankWebDesignExerciseTest_bankActivityId_fkey" FOREIGN KEY ("bankActivityId") REFERENCES "BankActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
