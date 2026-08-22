-- Existing accounts predate email verification and are grandfathered as verified.
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
UPDATE "User" SET "emailVerifiedAt" = CURRENT_TIMESTAMP WHERE "emailVerifiedAt" IS NULL;

CREATE TABLE "EmailVerificationChallenge" (
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailVerificationChallenge_pkey" PRIMARY KEY ("userId")
);

CREATE INDEX "EmailVerificationChallenge_expiresAt_idx" ON "EmailVerificationChallenge"("expiresAt");

ALTER TABLE "EmailVerificationChallenge" ADD CONSTRAINT "EmailVerificationChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
