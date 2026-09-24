ALTER TABLE "BankTestItem" ADD COLUMN "removedAt" TIMESTAMP(3);

CREATE INDEX "BankTestItem_bankTestId_removedAt_position_idx" ON "BankTestItem"("bankTestId", "removedAt", "position");
