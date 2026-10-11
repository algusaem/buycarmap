import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

// BAUTH-20 (docs/specs/core-better-auth.md): contract, step B. One migration
// drops the five legacy `users` columns that BAUTH-19 (step A) stopped
// reading and writing. Proven the way DATA-19 was
// (prisma/drop-unused-tables.integration.test.ts): a fresh database of its
// own, migrated in name order up to the migration before the drop, holding a
// fixture, then the drop applied and the before/after shape compared with `pg`.

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MIGRATIONS_DIR = join(ROOT, "prisma/migrations");
const DROP_MIGRATION_SUFFIX = "_drop_legacy_user_columns";

const DROPPED_COLUMNS = [
  "password",
  "email_verified",
  "password_changed_at",
  "two_factor_secret",
  "two_factor_last_step",
];

const migrationDirs = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const DROP_MIGRATION_DIR = migrationDirs.find((name) => name.endsWith(DROP_MIGRATION_SUFFIX));

function migrationsBeforeDrop(): string[] {
  return migrationDirs
    .filter((name) => DROP_MIGRATION_DIR === undefined || name < DROP_MIGRATION_DIR)
    .map((name) => join(MIGRATIONS_DIR, name, "migration.sql"));
}

const host = inject("pgHost");
const port = inject("pgPort");
const user = inject("pgUser");
const password = inject("pgPassword");

const DB_NAME = `buycarmap_legacy_${Math.random().toString(36).slice(2, 10)}`;

let client: Client;

const USER_ID = "01900000-0000-7000-8000-000000000011";
const ACCOUNT_ID = "01900000-0000-7000-8000-000000000012";
const PASSWORD_HASH = "$2b$12$legacyColumnsFixtureHashAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

async function publicTables(db: Client): Promise<string[]> {
  const { rows } = await db.query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations' ORDER BY table_name",
  );
  return rows.map((row) => row.table_name);
}

async function userColumns(db: Client): Promise<string[]> {
  const { rows } = await db.query<{ column_name: string }>(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' ORDER BY ordinal_position",
  );
  return rows.map((row) => row.column_name);
}

async function rowCounts(db: Client, tables: string[]): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of tables) {
    // Table names come from information_schema, never user input; still quoted.
    const { rows } = await db.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM "${table}"`);
    counts[table] = rows[0].n;
  }
  return counts;
}

async function seedFixture(db: Client): Promise<void> {
  await db.query(
    `INSERT INTO users (id, email, name, password, email_verified, password_changed_at, two_factor_secret, two_factor_last_step, email_confirmed, created_at, updated_at)
     VALUES ($1, $2, $3, $4, '2026-01-02T03:04:05Z', '2026-01-03T04:05:06Z', $5, $6, true, now(), now())`,
    [
      USER_ID,
      "legacy-fixture@example.test",
      "Fixture",
      PASSWORD_HASH,
      "legacy-fixture-totp-secret",
      58_000_000,
    ],
  );

  await db.query(
    `INSERT INTO accounts (id, user_id, type, provider, provider_account_id, password, created_at, updated_at)
     VALUES ($1, $2, 'credential', 'credential', $3, $4, now(), now())`,
    [ACCOUNT_ID, USER_ID, USER_ID, PASSWORD_HASH],
  );
}

let tablesBefore: string[];
let columnsBefore: string[];
let countsBefore: Record<string, number>;
let userBefore: Record<string, unknown>;

beforeAll(async () => {
  const admin = new Client({ host, port, user, password, database: "postgres" });
  await admin.connect();
  try {
    // DB_NAME is built from Math.random(), never user input, but still
    // double-quoted rather than trusted (test/setup.integration.ts's reasoning).
    await admin.query(`CREATE DATABASE "${DB_NAME}"`);
  } finally {
    await admin.end();
  }

  client = new Client({ host, port, user, password, database: DB_NAME });
  await client.connect();

  for (const file of migrationsBeforeDrop()) {
    await client.query(readFileSync(file, "utf8"));
  }

  await seedFixture(client);

  tablesBefore = await publicTables(client);
  columnsBefore = await userColumns(client);
  countsBefore = await rowCounts(client, tablesBefore);
  const { rows } = await client.query("SELECT * FROM users WHERE id = $1", [USER_ID]);
  userBefore = rows[0];
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

describe("BAUTH-20: one migration drops the five legacy users columns", () => {
  it("BAUTH-20 worked example: the five columns are gone, U and its credential account are intact", async () => {
    // Fails here, cleanly, until the migration is written.
    expect(
      DROP_MIGRATION_DIR,
      `expected a prisma/migrations/*${DROP_MIGRATION_SUFFIX} directory`,
    ).toBeDefined();
    if (DROP_MIGRATION_DIR === undefined) return;

    // The fixture really set all five legacy columns before the drop.
    for (const column of DROPPED_COLUMNS) {
      expect(userBefore[column], column).not.toBeNull();
    }
    expect(userBefore.password).toBe(PASSWORD_HASH);

    await client.query(
      readFileSync(join(MIGRATIONS_DIR, DROP_MIGRATION_DIR, "migration.sql"), "utf8"),
    );

    const columnsAfter = await userColumns(client);
    for (const column of DROPPED_COLUMNS) {
      expect(columnsAfter, column).not.toContain(column);
    }
    expect(columnsAfter).toEqual(
      columnsBefore.filter((column) => !DROPPED_COLUMNS.includes(column)),
    );

    const { rows: usersAfter } = await client.query("SELECT * FROM users WHERE id = $1", [USER_ID]);
    const expectedUser = Object.fromEntries(
      Object.entries(userBefore).filter(([column]) => !DROPPED_COLUMNS.includes(column)),
    );
    expect(usersAfter[0]).toEqual(expectedUser);

    const { rows: accounts } = await client.query<{ provider: string; password: string }>(
      "SELECT provider, password FROM accounts WHERE user_id = $1",
      [USER_ID],
    );
    expect(accounts).toEqual([{ provider: "credential", password: PASSWORD_HASH }]);

    const tablesAfter = await publicTables(client);
    expect(tablesAfter).toEqual(tablesBefore);
    expect(await rowCounts(client, tablesAfter)).toEqual(countsBefore);
  });
});
