-- Phase 8 of ADR 0007 (docs/specs/core-data-model.md, ADR 0015): every id
-- becomes a UUIDv7, every table and multi-word column becomes snake_case,
-- every DateTime becomes timestamptz(3), every model gains the six standard
-- columns, AlertPollJob.status becomes a real enum, and Alert gains
-- unsubscribeSubject.
--
-- Strategy: the 17 new, final-shaped tables are created alongside the old
-- ones — with the exact column set and types
-- `prisma migrate diff --from-empty --to-schema=prisma/schema.prisma`
-- generates for the target schema, so the result matches it exactly — every
-- row is copied across with a freshly minted UUIDv7 id (derived from each
-- row's own creation timestamp, so ids keep sorting in creation order) and
-- every foreign key rewritten through a join against a temporary `old_id`
-- staging column on whichever new table is the parent side. The old tables
-- are dropped only at the very end, once every row has a home in a new
-- table — no column is dropped before its data has moved.

-- (a) UUIDv7 support -----------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 48-bit unix-ms timestamp (big-endian), version nibble 7, RFC 4122 variant
-- (10), and the rest cryptographically random — the standard UUIDv7 layout.
-- `ts` controls only the timestamp bits, so passing a row's own creation
-- instant is what makes ids sort the way the rows they replace did; the
-- default (now()) is for tables that never recorded a creation instant
-- (Account, Session, VerificationToken, RateLimit, SourceHealth below).
CREATE FUNCTION uuid_generate_v7(ts timestamptz DEFAULT now())
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  unix_ts_ms bytea;
  buffer bytea;
BEGIN
  unix_ts_ms := substring(int8send(floor(extract(epoch FROM ts) * 1000)::bigint) FROM 3 FOR 6);
  buffer := overlay(gen_random_bytes(16) PLACING unix_ts_ms FROM 1 FOR 6);
  -- Version 7 in the high nibble of byte 6 (0-indexed); its low nibble stays random.
  buffer := set_byte(buffer, 6, (get_byte(buffer, 6) & 15) | 112);
  -- Variant 10 in the top two bits of byte 8 (0-indexed).
  buffer := set_byte(buffer, 8, (get_byte(buffer, 8) & 63) | 128);
  RETURN encode(buffer, 'hex')::uuid;
END;
$$;

-- (h) The AlertPollJob.status enum ---------------------------------------

CREATE TYPE "alert_poll_job_status" AS ENUM ('pending', 'running', 'failed');

-- (b)/(e)/(f)/(g)/(i) The 17 new tables -----------------------------------
-- Exactly the DDL the target schema generates fresh, plus a temporary
-- `old_id` staging column on the three tables other tables' foreign keys
-- are rewritten against (users, alert_criteria, alerts) — dropped once every
-- join that needs it has run.

CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "name" TEXT,
    "image" TEXT,
    "email_verified" TIMESTAMPTZ(3),
    "locale" TEXT,
    "two_factor_secret" TEXT,
    "two_factor_enabled_at" TIMESTAMPTZ(3),
    "two_factor_last_step" INTEGER,
    "password_changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "old_id" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "two_factor_recovery_codes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "two_factor_recovery_codes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "verification_tokens" (
    "id" UUID NOT NULL,
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pending_registrations" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "pending_registrations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_verification_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "new_email" TEXT,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rate_limits" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "favorites" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "listing_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "fuel" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "mileage" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "alert_criteria" (
    "id" UUID NOT NULL,
    "criteria_hash" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,
    "last_polled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "old_id" TEXT,

    CONSTRAINT "alert_criteria_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "alerts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "criteria_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "unsubscribe_token_hash" TEXT NOT NULL,
    "unsubscribe_subject" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "old_id" TEXT,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "alert_seen_listings" (
    "id" UUID NOT NULL,
    "criteria_id" UUID NOT NULL,
    "listing_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "first_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "alert_seen_listings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "alert_matches" (
    "id" UUID NOT NULL,
    "alert_id" UUID NOT NULL,
    "listing_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "fuel" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "mileage" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "notified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "alert_matches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "alert_poll_jobs" (
    "id" UUID NOT NULL,
    "criteria_id" UUID NOT NULL,
    "status" "alert_poll_job_status" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMPTZ(3),
    "last_error" TEXT,
    "enqueued_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "alert_poll_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "source_healths" (
    "id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "last_ok_at" TIMESTAMPTZ(3),
    "consecutive_empty_runs" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "source_healths_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "search_histories" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "query" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "search_histories_pkey" PRIMARY KEY ("id")
);

-- (b)/(c) Copy every row, oldest first, with a freshly minted UUIDv7 and
-- every foreign key rewritten through a join on the parent's `old_id` -------

-- Parents first: users, alert_criteria have no foreign keys of their own.
INSERT INTO "users" (
  "id", "email", "password", "name", "image", "email_verified", "locale",
  "two_factor_secret", "two_factor_enabled_at", "two_factor_last_step",
  "password_changed_at", "created_at", "updated_at",
  "created_by_id", "updated_by_id", "deleted_at", "version", "old_id"
)
SELECT
  uuid_generate_v7(u."createdAt"), u.email, u.password, u.name, u.image, u."emailVerified", u.locale,
  u."twoFactorSecret", u."twoFactorEnabledAt", u."twoFactorLastStep",
  u."passwordChangedAt", u."createdAt", u."createdAt",
  NULL, NULL, NULL, 1, u.id
FROM "User" u;

INSERT INTO "alert_criteria" (
  "id", "criteria_hash", "criteria", "last_polled_at", "created_at", "updated_at",
  "created_by_id", "updated_by_id", "deleted_at", "version", "old_id"
)
SELECT
  uuid_generate_v7(c."createdAt"), c."criteriaHash", c.criteria, c."lastPolledAt", c."createdAt", c."createdAt",
  NULL, NULL, NULL, 1, c.id
FROM "AlertCriteria" c;

-- Children of users ---------------------------------------------------------

INSERT INTO "two_factor_recovery_codes" (
  "id", "user_id", "code_hash", "used_at", "created_at", "updated_at",
  "created_by_id", "updated_by_id", "deleted_at", "version"
)
SELECT
  uuid_generate_v7(t."createdAt"), u.id, t."codeHash", t."usedAt", t."createdAt", t."createdAt",
  NULL, NULL, NULL, 1
FROM "TwoFactorRecoveryCode" t
JOIN "users" u ON u.old_id = t."userId";

-- Account never recorded a creation instant: every row's id and
-- created_at/updated_at are stamped with now() instead (DATA-2's note on
-- rows with no createdAt).
INSERT INTO "accounts" (
  "id", "user_id", "type", "provider", "provider_account_id", "refresh_token",
  "access_token", "expires_at", "token_type", "scope", "id_token", "session_state",
  "created_at", "updated_at", "created_by_id", "updated_by_id", "deleted_at", "version"
)
SELECT
  uuid_generate_v7(now()), u.id, a.type, a.provider, a."providerAccountId", a.refresh_token,
  a.access_token, a.expires_at, a.token_type, a.scope, a.id_token, a.session_state,
  now(), now(), NULL, NULL, NULL, 1
FROM "Account" a
JOIN "users" u ON u.old_id = a."userId";

-- Session never recorded a creation instant either (ADR 0015's note on
-- "Account", same reasoning).
INSERT INTO "sessions" (
  "id", "session_token", "user_id", "expires",
  "created_at", "updated_at", "created_by_id", "updated_by_id", "deleted_at", "version"
)
SELECT
  uuid_generate_v7(now()), s."sessionToken", u.id, s.expires,
  now(), now(), NULL, NULL, NULL, 1
FROM "Session" s
JOIN "users" u ON u.old_id = s."userId";

INSERT INTO "password_reset_tokens" (
  "id", "user_id", "token_hash", "expires_at", "used_at", "created_at", "updated_at",
  "created_by_id", "updated_by_id", "deleted_at", "version"
)
SELECT
  uuid_generate_v7(p."createdAt"), u.id, p."tokenHash", p."expiresAt", p."usedAt", p."createdAt", p."createdAt",
  NULL, NULL, NULL, 1
FROM "PasswordResetToken" p
JOIN "users" u ON u.old_id = p."userId";

INSERT INTO "email_verification_tokens" (
  "id", "user_id", "token_hash", "new_email", "expires_at", "used_at", "created_at", "updated_at",
  "created_by_id", "updated_by_id", "deleted_at", "version"
)
SELECT
  uuid_generate_v7(e."createdAt"), u.id, e."tokenHash", e."newEmail", e."expiresAt", e."usedAt", e."createdAt", e."createdAt",
  NULL, NULL, NULL, 1
FROM "EmailVerificationToken" e
JOIN "users" u ON u.old_id = e."userId";

INSERT INTO "favorites" (
  "id", "user_id", "listing_id", "source", "title", "subtitle", "image", "brand", "model",
  "location", "fuel", "url", "price", "mileage", "year", "lat", "lng",
  "created_at", "updated_at", "created_by_id", "updated_by_id", "deleted_at", "version"
)
SELECT
  uuid_generate_v7(f."createdAt"), u.id, f."listingId", f.source, f.title, f.subtitle, f.image, f.brand, f.model,
  f.location, f.fuel, f.url, f.price, f.mileage, f.year, f.lat, f.lng,
  f."createdAt", f."createdAt", NULL, NULL, NULL, 1
FROM "Favorite" f
JOIN "users" u ON u.old_id = f."userId";

INSERT INTO "search_histories" (
  "id", "user_id", "query", "created_at", "updated_at", "created_by_id", "updated_by_id", "deleted_at", "version"
)
SELECT
  uuid_generate_v7(sh."createdAt"), u.id, sh.query, sh."createdAt", sh."createdAt", NULL, NULL, NULL, 1
FROM "SearchHistory" sh
JOIN "users" u ON u.old_id = sh."userId";

-- Alert: depends on users and alert_criteria, and (d) carries its OLD id
-- (still the cuid at this point, since neither table has been dropped yet)
-- into unsubscribe_subject, so a token already emailed against that id keeps
-- verifying after the id itself changes below.
INSERT INTO "alerts" (
  "id", "user_id", "criteria_id", "label", "active", "unsubscribe_token_hash", "unsubscribe_subject",
  "created_at", "updated_at", "created_by_id", "updated_by_id", "deleted_at", "version", "old_id"
)
SELECT
  uuid_generate_v7(a."createdAt"), u.id, c.id, a.label, a.active, a."unsubscribeTokenHash", a.id,
  a."createdAt", a."createdAt", NULL, NULL, NULL, 1, a.id
FROM "Alert" a
JOIN "users" u ON u.old_id = a."userId"
JOIN "alert_criteria" c ON c.old_id = a."criteriaId";

-- AlertSeenListing never had a `createdAt`, only `firstSeenAt` — used as the
-- creation instant for both the id and the new `created_at` column, since it
-- already records exactly that.
INSERT INTO "alert_seen_listings" (
  "id", "criteria_id", "listing_id", "source", "first_seen_at",
  "created_at", "updated_at", "created_by_id", "updated_by_id", "deleted_at", "version"
)
SELECT
  uuid_generate_v7(s."firstSeenAt"), c.id, s."listingId", s.source, s."firstSeenAt",
  s."firstSeenAt", s."firstSeenAt", NULL, NULL, NULL, 1
FROM "AlertSeenListing" s
JOIN "alert_criteria" c ON c.old_id = s."criteriaId";

-- AlertPollJob never had a `createdAt` either, only `enqueuedAt` — same
-- reasoning as AlertSeenListing above.
INSERT INTO "alert_poll_jobs" (
  "id", "criteria_id", "status", "attempts", "available_at", "locked_at", "last_error", "enqueued_at",
  "created_at", "updated_at", "created_by_id", "updated_by_id", "deleted_at", "version"
)
SELECT
  uuid_generate_v7(j."enqueuedAt"), c.id, j.status::"alert_poll_job_status", j.attempts, j."availableAt", j."lockedAt", j."lastError", j."enqueuedAt",
  j."enqueuedAt", j."enqueuedAt", NULL, NULL, NULL, 1
FROM "AlertPollJob" j
JOIN "alert_criteria" c ON c.old_id = j."criteriaId";

-- AlertMatch: depends on alerts.
INSERT INTO "alert_matches" (
  "id", "alert_id", "listing_id", "source", "title", "subtitle", "image", "brand", "model",
  "location", "fuel", "url", "price", "mileage", "year", "lat", "lng", "notified_at",
  "created_at", "updated_at", "created_by_id", "updated_by_id", "deleted_at", "version"
)
SELECT
  uuid_generate_v7(m."createdAt"), al.id, m."listingId", m.source, m.title, m.subtitle, m.image, m.brand, m.model,
  m.location, m.fuel, m.url, m.price, m.mileage, m.year, m.lat, m.lng, m."notifiedAt",
  m."createdAt", m."createdAt", NULL, NULL, NULL, 1
FROM "AlertMatch" m
JOIN "alerts" al ON al.old_id = m."alertId";

-- Independent tables with no foreign keys of their own ----------------------

-- VerificationToken never had an id or a createdAt (the NextAuth adapter's
-- own magic-link table, unused while sessions are JWTs).
INSERT INTO "verification_tokens" (
  "id", "identifier", "token", "expires",
  "created_at", "updated_at", "created_by_id", "updated_by_id", "deleted_at", "version"
)
SELECT
  uuid_generate_v7(now()), v.identifier, v.token, v.expires,
  now(), now(), NULL, NULL, NULL, 1
FROM "VerificationToken" v;

-- RateLimit never had an id or a createdAt either (keyed by `key`).
INSERT INTO "rate_limits" (
  "id", "key", "count", "expires_at",
  "created_at", "updated_at", "created_by_id", "updated_by_id", "deleted_at", "version"
)
SELECT
  uuid_generate_v7(now()), r.key, r.count, r."expiresAt",
  now(), now(), NULL, NULL, NULL, 1
FROM "RateLimit" r;

INSERT INTO "pending_registrations" (
  "id", "email", "password", "name", "token_hash", "expires_at",
  "created_at", "updated_at", "created_by_id", "updated_by_id", "deleted_at", "version"
)
SELECT
  uuid_generate_v7(p."createdAt"), p.email, p.password, p.name, p."tokenHash", p."expiresAt",
  p."createdAt", p."createdAt", NULL, NULL, NULL, 1
FROM "PendingRegistration" p;

-- SourceHealth never had an id or a createdAt (keyed by `source`); `updatedAt`
-- tracks the last upsert, not a creation instant, so now() is used instead,
-- same as Account and Session above.
INSERT INTO "source_healths" (
  "id", "source", "last_ok_at", "consecutive_empty_runs",
  "created_at", "updated_at", "created_by_id", "updated_by_id", "deleted_at", "version"
)
SELECT
  uuid_generate_v7(now()), s.source, s."lastOkAt", s."consecutiveEmptyRuns",
  now(), now(), NULL, NULL, NULL, 1
FROM "SourceHealth" s;

-- Staging columns no longer needed now that every join against them has run.
ALTER TABLE "users" DROP COLUMN "old_id";
ALTER TABLE "alert_criteria" DROP COLUMN "old_id";
ALTER TABLE "alerts" DROP COLUMN "old_id";

-- (f) Indexes ---------------------------------------------------------------

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE UNIQUE INDEX "two_factor_recovery_codes_code_hash_key" ON "two_factor_recovery_codes"("code_hash");
CREATE INDEX "two_factor_recovery_codes_user_id_idx" ON "two_factor_recovery_codes"("user_id");

CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens"("expires_at");

CREATE UNIQUE INDEX "pending_registrations_token_hash_key" ON "pending_registrations"("token_hash");
CREATE INDEX "pending_registrations_email_idx" ON "pending_registrations"("email");
CREATE INDEX "pending_registrations_expires_at_idx" ON "pending_registrations"("expires_at");

CREATE UNIQUE INDEX "email_verification_tokens_token_hash_key" ON "email_verification_tokens"("token_hash");
CREATE INDEX "email_verification_tokens_user_id_idx" ON "email_verification_tokens"("user_id");
CREATE INDEX "email_verification_tokens_expires_at_idx" ON "email_verification_tokens"("expires_at");

CREATE UNIQUE INDEX "rate_limits_key_key" ON "rate_limits"("key");
CREATE INDEX "rate_limits_expires_at_idx" ON "rate_limits"("expires_at");

CREATE INDEX "favorites_user_id_idx" ON "favorites"("user_id");
CREATE UNIQUE INDEX "favorites_user_id_listing_id_key" ON "favorites"("user_id", "listing_id");

CREATE UNIQUE INDEX "alert_criteria_criteria_hash_key" ON "alert_criteria"("criteria_hash");
CREATE INDEX "alert_criteria_last_polled_at_idx" ON "alert_criteria"("last_polled_at");

CREATE UNIQUE INDEX "alerts_unsubscribe_token_hash_key" ON "alerts"("unsubscribe_token_hash");
CREATE INDEX "alerts_user_id_idx" ON "alerts"("user_id");
CREATE INDEX "alerts_criteria_id_idx" ON "alerts"("criteria_id");
CREATE UNIQUE INDEX "alerts_user_id_criteria_id_key" ON "alerts"("user_id", "criteria_id");

CREATE INDEX "alert_seen_listings_criteria_id_idx" ON "alert_seen_listings"("criteria_id");
CREATE UNIQUE INDEX "alert_seen_listings_criteria_id_listing_id_key" ON "alert_seen_listings"("criteria_id", "listing_id");

CREATE INDEX "alert_matches_alert_id_notified_at_idx" ON "alert_matches"("alert_id", "notified_at");
CREATE UNIQUE INDEX "alert_matches_alert_id_listing_id_key" ON "alert_matches"("alert_id", "listing_id");

CREATE UNIQUE INDEX "alert_poll_jobs_criteria_id_key" ON "alert_poll_jobs"("criteria_id");
CREATE INDEX "alert_poll_jobs_status_available_at_enqueued_at_idx" ON "alert_poll_jobs"("status", "available_at", "enqueued_at");

CREATE UNIQUE INDEX "source_healths_source_key" ON "source_healths"("source");

CREATE INDEX "search_histories_user_id_idx" ON "search_histories"("user_id");

-- (e)/(i) Foreign keys --------------------------------------------------
-- Every onDelete: Cascade from the old schema is carried over unchanged (the
-- 12 relations prisma/schema.prisma comments as "meaningless without its
-- parent"); every new createdById/updatedById is ON DELETE SET NULL.

ALTER TABLE "users" ADD CONSTRAINT "users_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "two_factor_recovery_codes" ADD CONSTRAINT "two_factor_recovery_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "two_factor_recovery_codes" ADD CONSTRAINT "two_factor_recovery_codes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "two_factor_recovery_codes" ADD CONSTRAINT "two_factor_recovery_codes_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pending_registrations" ADD CONSTRAINT "pending_registrations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pending_registrations" ADD CONSTRAINT "pending_registrations_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "rate_limits" ADD CONSTRAINT "rate_limits_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "rate_limits" ADD CONSTRAINT "rate_limits_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "alert_criteria" ADD CONSTRAINT "alert_criteria_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "alert_criteria" ADD CONSTRAINT "alert_criteria_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "alerts" ADD CONSTRAINT "alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_criteria_id_fkey" FOREIGN KEY ("criteria_id") REFERENCES "alert_criteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "alert_seen_listings" ADD CONSTRAINT "alert_seen_listings_criteria_id_fkey" FOREIGN KEY ("criteria_id") REFERENCES "alert_criteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "alert_seen_listings" ADD CONSTRAINT "alert_seen_listings_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "alert_seen_listings" ADD CONSTRAINT "alert_seen_listings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "alert_matches" ADD CONSTRAINT "alert_matches_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "alert_matches" ADD CONSTRAINT "alert_matches_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "alert_matches" ADD CONSTRAINT "alert_matches_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "alert_poll_jobs" ADD CONSTRAINT "alert_poll_jobs_criteria_id_fkey" FOREIGN KEY ("criteria_id") REFERENCES "alert_criteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "alert_poll_jobs" ADD CONSTRAINT "alert_poll_jobs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "alert_poll_jobs" ADD CONSTRAINT "alert_poll_jobs_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "source_healths" ADD CONSTRAINT "source_healths_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "source_healths" ADD CONSTRAINT "source_healths_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "search_histories" ADD CONSTRAINT "search_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "search_histories" ADD CONSTRAINT "search_histories_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "search_histories" ADD CONSTRAINT "search_histories_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop the old tables, now that every row has a home in a new one. CASCADE
-- takes each old table's own constraints and indexes with it; it drops no
-- data, since every old table is empty of anything not already copied above.
DROP TABLE "SearchHistory" CASCADE;
DROP TABLE "SourceHealth" CASCADE;
DROP TABLE "AlertMatch" CASCADE;
DROP TABLE "AlertSeenListing" CASCADE;
DROP TABLE "AlertPollJob" CASCADE;
DROP TABLE "Alert" CASCADE;
DROP TABLE "AlertCriteria" CASCADE;
DROP TABLE "Favorite" CASCADE;
DROP TABLE "RateLimit" CASCADE;
DROP TABLE "PendingRegistration" CASCADE;
DROP TABLE "EmailVerificationToken" CASCADE;
DROP TABLE "PasswordResetToken" CASCADE;
DROP TABLE "VerificationToken" CASCADE;
DROP TABLE "Account" CASCADE;
DROP TABLE "Session" CASCADE;
DROP TABLE "TwoFactorRecoveryCode" CASCADE;
DROP TABLE "User" CASCADE;
