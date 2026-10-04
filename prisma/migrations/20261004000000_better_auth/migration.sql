-- Better Auth adoption (phase 11, docs/specs/core-better-auth.md, BAUTH-14).
--
-- Expand-only: nothing already read by the NextAuth-based code is renamed or
-- dropped. Better Auth's Prisma adapter is pointed at the existing
-- "provider"/"provider_account_id" (accounts) and "session_token"/"expires"
-- (sessions) columns through field mapping in lib/auth/auth.ts, not by
-- renaming them here.

-- AlterTable: users
-- "email_confirmed" is the boolean Better Auth's emailVerified maps onto
-- (the existing "email_verified" stays a DateTime for the old code).
-- "two_factor_enabled" starts false for every row by its own default, which
-- is also BAUTH-13's cutover: anyone who had the old "two_factor_enabled_at"
-- set is switched off by this migration without a separate UPDATE.
ALTER TABLE "users" ADD COLUMN "email_confirmed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false;

UPDATE "users" SET "email_confirmed" = true WHERE "email_verified" IS NOT NULL;

-- AlterTable: accounts
-- "password" holds the credential account's bcrypt hash; the two
-- access/refresh-token-expiry columns are what Better Auth's OAuth linking
-- writes. "type" gets a default so a Better Auth insert that omits it still
-- succeeds, matching every existing OAuth row.
ALTER TABLE "accounts" ADD COLUMN "password" TEXT;
ALTER TABLE "accounts" ADD COLUMN "access_token_expires_at" TIMESTAMPTZ(3);
ALTER TABLE "accounts" ADD COLUMN "refresh_token_expires_at" TIMESTAMPTZ(3);
ALTER TABLE "accounts" ALTER COLUMN "type" SET DEFAULT 'oauth';

-- One "credential" account row per user with a password (BAUTH-14 worked
-- example), so Better Auth's own credential sign-in can find it. The
-- NextAuth-named "provider"/"provider_account_id" columns are not renamed —
-- lib/auth/auth.ts maps Better Auth's providerId/accountId onto them.
INSERT INTO "accounts" (
  "id", "user_id", "type", "provider", "provider_account_id", "password",
  "created_at", "updated_at", "version"
)
SELECT uuid_generate_v7(), "id", 'credential', 'credential', "id"::text, "password",
       now(), now(), 1
FROM "users"
WHERE "password" IS NOT NULL;

-- AlterTable: sessions
-- Better Auth's "token"/"expiresAt" map onto the existing
-- "session_token"/"expires" columns (lib/auth/auth.ts field mapping); only
-- "ip_address" and "user_agent" are genuinely new.
ALTER TABLE "sessions" ADD COLUMN "ip_address" TEXT;
ALTER TABLE "sessions" ADD COLUMN "user_agent" TEXT;

-- CreateTable: verifications
-- Better Auth's own single-use token table (email verification/reset flows
-- it does not run here, plus whatever its plugins need). Distinct from our
-- existing PendingRegistration/PasswordResetToken/EmailVerificationToken,
-- which keep running our own flows (BAUTH-7) and are not touched.
CREATE TABLE "verifications" (
    "id" UUID NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "verifications" ADD CONSTRAINT "verifications_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: two_factors
-- Better Auth's twoFactor plugin table. Created now so this migration lands
-- in one piece; the plugin itself, and the old
-- "two_factor_secret"/"two_factor_recovery_codes" cutover, are phase 12
-- (docs/specs/core-better-auth.md, BAUTH-11..13).
CREATE TABLE "two_factors" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "secret" TEXT NOT NULL,
    "backup_codes" TEXT NOT NULL,
    -- The plugin's own TOTP enrolment flag and its built-in failed-attempt
    -- lockout (BAUTH-11): its enable/verify endpoints write these
    -- unconditionally, so they land with the table rather than in a later
    -- migration this one already says it is avoiding.
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "failed_verification_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "two_factors_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "two_factors_user_id_idx" ON "two_factors"("user_id");

ALTER TABLE "two_factors" ADD CONSTRAINT "two_factors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "two_factors" ADD CONSTRAINT "two_factors_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "two_factors" ADD CONSTRAINT "two_factors_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
