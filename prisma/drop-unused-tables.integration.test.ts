import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

// DATA-19 (docs/specs/core-data-model.md): one migration drops the four
// unused tables. Proven the way DATA-2 and BAUTH-14 were
// (prisma/migrations.integration.test.ts): a fresh database of its own,
// migrated in name order up to the migration before the drop, holding a
// fixture, then the drop applied and the before/after shape compared with `pg`.

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MIGRATIONS_DIR = join(ROOT, "prisma/migrations");
const DROP_MIGRATION_SUFFIX = "_drop_unused_tables";

const DROPPED_TABLES = [
  "rate_limits",
  "verification_tokens",
  "two_factor_recovery_codes",
  "search_histories",
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

const DB_NAME = `buycarmap_drop_${Math.random().toString(36).slice(2, 10)}`;

let client: Client;

const USER_ID = "01900000-0000-7000-8000-000000000001";
const FAVORITE_ID = "01900000-0000-7000-8000-000000000002";
const CRITERIA_ID = "01900000-0000-7000-8000-000000000003";
const ALERT_ID = "01900000-0000-7000-8000-000000000004";
const RATE_LIMIT_ID = "01900000-0000-7000-8000-000000000005";
const VERIFICATION_TOKEN_ID = "01900000-0000-7000-8000-000000000006";
const RECOVERY_CODE_ID = "01900000-0000-7000-8000-000000000007";
const SEARCH_HISTORY_ID = "01900000-0000-7000-8000-000000000008";

async function publicTables(db: Client): Promise<string[]> {
  const { rows } = await db.query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations' ORDER BY table_name",
  );
  return rows.map((row) => row.table_name);
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
    "INSERT INTO users (id, email, name, created_at, updated_at) VALUES ($1, $2, $3, now(), now())",
    [USER_ID, "drop-fixture@example.test", "Fixture"],
  );

  await db.query(
    `INSERT INTO favorites (id, user_id, listing_id, source, title, subtitle, image, brand, model, location, fuel, url, price, mileage, year, lat, lng, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17, now(), now())`,
    [
      FAVORITE_ID,
      USER_ID,
      "wallapop-drop-fixture",
      "Wallapop",
      "Audi A3",
      "Great condition",
      "https://cdn.wallapop.com/img1.jpg",
      "Audi",
      "A3",
      "Madrid",
      "gasoil",
      "https://es.wallapop.com/item/audi-a3-1",
      14500,
      95000,
      2018,
      40.4168,
      -3.7038,
    ],
  );

  await db.query(
    "INSERT INTO alert_criteria (id, criteria_hash, criteria, created_at, updated_at) VALUES ($1, $2, $3, now(), now())",
    [CRITERIA_ID, "drop-fixture-criteria-hash", JSON.stringify({ brand: "Audi" })],
  );

  await db.query(
    `INSERT INTO alerts (id, user_id, criteria_id, label, unsubscribe_token_hash, unsubscribe_subject, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, now(), now())`,
    [ALERT_ID, USER_ID, CRITERIA_ID, "Fixture alert", "drop-fixture-unsubscribe-hash", ALERT_ID],
  );

  await db.query(
    "INSERT INTO rate_limits (id, key, count, expires_at, created_at, updated_at) VALUES ($1, $2, $3, now(), now(), now())",
    [RATE_LIMIT_ID, "login:drop-fixture", 1],
  );

  await db.query(
    "INSERT INTO verification_tokens (id, identifier, token, expires, created_at, updated_at) VALUES ($1, $2, $3, now(), now(), now())",
    [VERIFICATION_TOKEN_ID, "drop-fixture@example.test", "drop-fixture-token"],
  );

  await db.query(
    "INSERT INTO two_factor_recovery_codes (id, user_id, code_hash, created_at, updated_at) VALUES ($1, $2, $3, now(), now())",
    [RECOVERY_CODE_ID, USER_ID, "drop-fixture-code-hash"],
  );

  await db.query(
    "INSERT INTO search_histories (id, user_id, query, created_at, updated_at) VALUES ($1, $2, $3, now(), now())",
    [SEARCH_HISTORY_ID, USER_ID, "audi a3 madrid"],
  );
}

let tablesBefore: string[];
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

describe("DATA-19: one migration drops the four unused tables", () => {
  it("DATA-19 worked example: the four tables are gone and every other table, U, F and A are intact", async () => {
    // Fails here, cleanly, until the migration is written.
    expect(
      DROP_MIGRATION_DIR,
      `expected a prisma/migrations/*${DROP_MIGRATION_SUFFIX} directory`,
    ).toBeDefined();
    if (DROP_MIGRATION_DIR === undefined) return;

    // The fixture really held one row in each table about to be dropped.
    for (const table of DROPPED_TABLES) {
      expect(countsBefore[table], table).toBe(1);
    }

    await client.query(
      readFileSync(join(MIGRATIONS_DIR, DROP_MIGRATION_DIR, "migration.sql"), "utf8"),
    );

    const tablesAfter = await publicTables(client);
    for (const table of DROPPED_TABLES) {
      expect(tablesAfter, table).not.toContain(table);
    }

    const keptTables = tablesBefore.filter((table) => !DROPPED_TABLES.includes(table));
    expect(tablesAfter).toEqual(keptTables);

    const expectedCounts = Object.fromEntries(
      keptTables.map((table) => [table, countsBefore[table]]),
    );
    expect(await rowCounts(client, tablesAfter)).toEqual(expectedCounts);

    const { rows: usersAfter } = await client.query("SELECT * FROM users WHERE id = $1", [USER_ID]);
    expect(usersAfter[0]).toEqual(userBefore);

    const { rows: favorites } = await client.query<{ user_id: string }>(
      "SELECT user_id FROM favorites WHERE id = $1",
      [FAVORITE_ID],
    );
    expect(favorites).toEqual([{ user_id: USER_ID }]);

    const { rows: alerts } = await client.query<{ user_id: string }>(
      "SELECT user_id FROM alerts WHERE id = $1",
      [ALERT_ID],
    );
    expect(alerts).toEqual([{ user_id: USER_ID }]);
  });
});
