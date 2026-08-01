-- Lets one token model serve both "confirm the address on this account" and
-- "move this account to a new address". Null means the former.
ALTER TABLE "EmailVerificationToken" ADD COLUMN "newEmail" TEXT;
