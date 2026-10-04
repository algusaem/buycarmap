import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { hashPassword } from "@/lib/auth/hash";

// BAUTH-13/BAUTH-14 (docs/specs/core-better-auth.md): proven the same way
// DATA-2's migration was — a migration applied to a fresh database holding a
// fixture, built with every OLDER migration but not this new one, checking
// the before/after shape directly with `pg` rather than through the shared
// per-worker database test/setup.integration.ts gives every other
// integration test (prisma/migrations.integration.test.ts is the pattern
// this follows).
//
// The spec's own BAUTH-14 worked example writes the new account row's
// columns as `provider`/`provider_account_id` — today's NextAuth-named
// columns, unrenamed — and its criteria bullet says explicitly that they are
// "mapped to Better Auth's providerId/accountId in Prisma, not renamed".
// Updated to match (previously this file queried `provider_id`/`account_id`,
// Better Auth's own Prisma-adapter default names, which the corrected spec
// does not use); reported as a harness correction, not an expected-value
// change, since the worked example's literal values are unchanged.

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MIGRATIONS_DIR = join(ROOT, "prisma/migrations");
const NEW_MIGRATION_DIR = "20261004000000_better_auth";
const NEW_MIGRATION_PATH = join(MIGRATIONS_DIR, NEW_MIGRATION_DIR, "migration.sql");
const MIGRATION_EXISTS = existsSync(NEW_MIGRATION_PATH);

function oldMigrationSqlFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== NEW_MIGRATION_DIR)
    .map((entry) => entry.name)
    .sort()
    .map((name) => join(MIGRATIONS_DIR, name, "migration.sql"));
}

const host = inject("pgHost");
const port = inject("pgPort");
const user = inject("pgUser");
const password = inject("pgPassword");

const DB_NAME = `buycarmap_bauth_${Math.random().toString(36).slice(2, 10)}`;

let client: Client;
let credentialPasswordHash: string;

const CREDENTIAL_USER_ID = "11111111-1111-7111-8111-111111111111";
const TWO_FACTOR_USER_ID = "22222222-2222-7222-8222-222222222222";

async function tableExists(db: Client, tableName: string): Promise<boolean> {
  const { rows } = await db.query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1) AS exists",
    [tableName],
  );
  return rows[0]?.exists ?? false;
}

beforeAll(async () => {
  credentialPasswordHash = await hashPassword("the-old-password");

  const admin = new Client({ host, port, user, password, database: "postgres" });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${DB_NAME}"`);
  } finally {
    await admin.end();
  }

  client = new Client({ host, port, user, password, database: DB_NAME });
  await client.connect();

  for (const file of oldMigrationSqlFiles()) {
    await client.query(readFileSync(file, "utf8"));
  }

  // A credential user — the migration's one-credential-account-per-user case.
  await client.query(
    `INSERT INTO users (id, email, password, email_verified, created_at, updated_at)
     VALUES ($1, $2, $3, $4, now(), now())`,
    [CREDENTIAL_USER_ID, "credential-fixture@example.test", credentialPasswordHash, new Date()],
  );

  // A user with two-factor on before the cutover (BAUTH-13).
  await client.query(
    `INSERT INTO users (id, email, two_factor_enabled_at, two_factor_secret, created_at, updated_at)
     VALUES ($1, $2, now(), $3, now(), now())`,
    [TWO_FACTOR_USER_ID, "two-factor-fixture@example.test", "encrypted-secret"],
  );
}, 120_000);

afterAll(async () => {
  await client?.end();

  const admin = new Client({ host, port, user, password, database: "postgres" });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${DB_NAME}"`);
  } finally {
    await admin.end();
  }
});

describe("BAUTH-14: the Better Auth migration is expand-only", () => {
  it("BAUTH-14 worked example: one credential account row per user with a password", async () => {
    expect(MIGRATION_EXISTS, `expected ${NEW_MIGRATION_PATH} to exist`).toBe(true);

    await client.query(readFileSync(NEW_MIGRATION_PATH, "utf8"));

    const { rows } = await client.query<{
      provider: string;
      provider_account_id: string;
      password: string;
    }>(
      "SELECT provider, provider_account_id, password FROM accounts WHERE provider_account_id = $1",
      [CREDENTIAL_USER_ID],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      provider: "credential",
      provider_account_id: CREDENTIAL_USER_ID,
      password: credentialPasswordHash,
    });
  });

  it("BAUTH-14: email_confirmed is backfilled from email_verified IS NOT NULL", async () => {
    expect(MIGRATION_EXISTS, `expected ${NEW_MIGRATION_PATH} to exist`).toBe(true);

    const { rows } = await client.query<{ email_confirmed: boolean }>(
      "SELECT email_confirmed FROM users WHERE id = $1",
      [CREDENTIAL_USER_ID],
    );

    expect(rows[0]?.email_confirmed).toBe(true);
  });

  it("BAUTH-13 worked example: a user who had two-factor on is switched off by the migration", async () => {
    expect(MIGRATION_EXISTS, `expected ${NEW_MIGRATION_PATH} to exist`).toBe(true);

    const { rows } = await client.query<{ two_factor_enabled: boolean }>(
      "SELECT two_factor_enabled FROM users WHERE id = $1",
      [TWO_FACTOR_USER_ID],
    );

    expect(rows[0]?.two_factor_enabled).toBe(false);
  });

  it("BAUTH-14: the verifications and two_factors tables exist", async () => {
    expect(MIGRATION_EXISTS, `expected ${NEW_MIGRATION_PATH} to exist`).toBe(true);

    expect(await tableExists(client, "verifications")).toBe(true);
    expect(await tableExists(client, "two_factors")).toBe(true);
  });
});
