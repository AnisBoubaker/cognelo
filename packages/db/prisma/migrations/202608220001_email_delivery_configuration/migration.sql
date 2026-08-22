-- CreateEnum
CREATE TYPE "EmailDeliveryTransport" AS ENUM ('smtp', 'microsoft_graph');

-- CreateEnum
CREATE TYPE "SmtpSecurityMode" AS ENUM ('starttls', 'tls', 'none');

-- CreateTable
CREATE TABLE "EmailDeliveryConfiguration" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "transport" "EmailDeliveryTransport" NOT NULL,
    "fromName" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpSecurity" "SmtpSecurityMode",
    "smtpUsername" TEXT,
    "smtpPasswordEncrypted" TEXT,
    "graphTenantId" TEXT,
    "graphClientId" TEXT,
    "graphClientSecretEncrypted" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailDeliveryConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailDeliveryConfiguration_updatedById_idx" ON "EmailDeliveryConfiguration"("updatedById");

-- AddForeignKey
ALTER TABLE "EmailDeliveryConfiguration" ADD CONSTRAINT "EmailDeliveryConfiguration_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
