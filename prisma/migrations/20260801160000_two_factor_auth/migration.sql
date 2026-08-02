-- TOTP two-factor authentication.
--
-- Additive only: every column is nullable and the new table starts empty, so
-- existing accounts are unaffected and 2FA stays off until a user enrols.

-- AlterTable: User
ALTER TABLE "User" ADD COLUMN "twoFactorSecret" TEXT;
ALTER TABLE "User" ADD COLUMN "twoFactorEnabledAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "twoFactorLastStep" INTEGER;

-- CreateTable
CREATE TABLE "TwoFactorRecoveryCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TwoFactorRecoveryCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TwoFactorRecoveryCode_codeHash_key" ON "TwoFactorRecoveryCode"("codeHash");
CREATE INDEX "TwoFactorRecoveryCode_userId_idx" ON "TwoFactorRecoveryCode"("userId");

-- AddForeignKey
ALTER TABLE "TwoFactorRecoveryCode" ADD CONSTRAINT "TwoFactorRecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
