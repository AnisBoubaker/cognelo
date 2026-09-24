CREATE TABLE "BankTest" (
    "id" TEXT NOT NULL,
    "bankActivityId" TEXT NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankTest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BankTestItem" (
    "id" TEXT NOT NULL,
    "bankTestId" TEXT NOT NULL,
    "bankActivityId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "pointsPossible" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankTestItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BankTestVersion" (
    "id" TEXT NOT NULL,
    "bankTestId" TEXT NOT NULL,
    "activityVersionId" TEXT NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankTestVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BankTestVersionItem" (
    "id" TEXT NOT NULL,
    "bankTestVersionId" TEXT NOT NULL,
    "sourceBankTestItemId" TEXT NOT NULL,
    "activityVersionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "pointsPossible" DOUBLE PRECISION NOT NULL,
    "isRequired" BOOLEAN NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankTestVersionItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BankTest_bankActivityId_key" ON "BankTest"("bankActivityId");
CREATE UNIQUE INDEX "BankTestItem_bankActivityId_key" ON "BankTestItem"("bankActivityId");
CREATE INDEX "BankTestItem_bankTestId_position_idx" ON "BankTestItem"("bankTestId", "position");
CREATE UNIQUE INDEX "BankTestVersion_activityVersionId_key" ON "BankTestVersion"("activityVersionId");
CREATE INDEX "BankTestVersion_bankTestId_createdAt_idx" ON "BankTestVersion"("bankTestId", "createdAt");
CREATE UNIQUE INDEX "BankTestVersionItem_bankTestVersionId_sourceBankTestItemId_key" ON "BankTestVersionItem"("bankTestVersionId", "sourceBankTestItemId");
CREATE INDEX "BankTestVersionItem_bankTestVersionId_position_idx" ON "BankTestVersionItem"("bankTestVersionId", "position");
CREATE INDEX "BankTestVersionItem_activityVersionId_idx" ON "BankTestVersionItem"("activityVersionId");

ALTER TABLE "BankTest" ADD CONSTRAINT "BankTest_bankActivityId_fkey" FOREIGN KEY ("bankActivityId") REFERENCES "BankActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankTestItem" ADD CONSTRAINT "BankTestItem_bankTestId_fkey" FOREIGN KEY ("bankTestId") REFERENCES "BankTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankTestItem" ADD CONSTRAINT "BankTestItem_bankActivityId_fkey" FOREIGN KEY ("bankActivityId") REFERENCES "BankActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankTestVersion" ADD CONSTRAINT "BankTestVersion_bankTestId_fkey" FOREIGN KEY ("bankTestId") REFERENCES "BankTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankTestVersion" ADD CONSTRAINT "BankTestVersion_activityVersionId_fkey" FOREIGN KEY ("activityVersionId") REFERENCES "ActivityVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankTestVersionItem" ADD CONSTRAINT "BankTestVersionItem_bankTestVersionId_fkey" FOREIGN KEY ("bankTestVersionId") REFERENCES "BankTestVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankTestVersionItem" ADD CONSTRAINT "BankTestVersionItem_activityVersionId_fkey" FOREIGN KEY ("activityVersionId") REFERENCES "ActivityVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
