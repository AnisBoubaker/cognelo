CREATE TABLE "ActivityBankFolder" (
    "id" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "parentId" TEXT,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityBankFolder_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "BankActivity" ADD COLUMN "folderId" TEXT;

CREATE INDEX "ActivityBankFolder_bankId_parentId_position_idx" ON "ActivityBankFolder"("bankId", "parentId", "position");
CREATE INDEX "ActivityBankFolder_parentId_idx" ON "ActivityBankFolder"("parentId");
CREATE INDEX "BankActivity_bankId_folderId_position_idx" ON "BankActivity"("bankId", "folderId", "position");
CREATE INDEX "BankActivity_folderId_idx" ON "BankActivity"("folderId");

DROP INDEX "BankActivity_bankId_position_idx";

ALTER TABLE "ActivityBankFolder" ADD CONSTRAINT "ActivityBankFolder_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "ActivityBank"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityBankFolder" ADD CONSTRAINT "ActivityBankFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ActivityBankFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankActivity" ADD CONSTRAINT "BankActivity_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "ActivityBankFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
