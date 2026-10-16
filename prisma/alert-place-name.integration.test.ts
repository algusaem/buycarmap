import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

// docs/specs/redesign-alerts.md (ALERTUI-49; Data model › Migration): one
// expand-only migration adds `alerts.place_name`, a nullable text column with
// no default and no index, and changes nothing else. Proven as DATA-19 was
// (prisma/drop-unused-tables.integration.test.ts): a fresh database of its
// own, migrated in name order up to the migration before it, holding an alert
// inserted the way the code before F6 inserts one, then the migration applied
// and the schema read back with `pg`.

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MIGRATIONS_DIR = join(ROOT, "prisma/migrations");
const MIGRATION_SUFFIX = "_alert_place_name";

const migrationDirs = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const PLACE_NAME_DIR = migrationDirs.find((name) => name.endsWith(MIGRATION_SUFFIX));

function migrationsBefore(): string[] {
  return migrationDirs
    .filter((name) => PLACE_NAME_DIR === undefined || name < PLACE_NAME_DIR)
    .map((name) => join(MIGRATIONS_DIR, name, "migration.sql"));
}

const host = inject("pgHost");
const port = inject("pgPort");
const user = inject("pgUser");
const password = inject("pgPassword");

const DB_NAME = `buycarmap_place_${Math.random().toString(36).slice(2, 10)}`;

let client: Client;

const USER_ID = "01900000-0000-7000-8000-0000000000a1";
const CRITERIA_ID = "01900000-0000-7000-8000-0000000000a2";
const LATER_CRITERIA_ID = "01900000-0000-7000-8000-0000000000a5";
const OLD_ALERT_ID = "01900000-0000-7000-8000-0000000000a3";
const LATER_ALERT_ID = "01900000-0000-7000-8000-0000000000a4";

interface ColumnRow {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

/** Every column of every table under `public`, `_prisma_migrations` excepted. */
async function columns(db: Client): Promise<ColumnRow[]> {
  const { rows } = await db.query<ColumnRow>(
    `SELECT table_name, column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name <> '_prisma_migrations'
     ORDER BY table_name, column_name`,
  );
  return rows;
}

/** Every index under `public`, by its definition. */
async function indexes(db: Client): Promise<string[]> {
  const { rows } = await db.query<{ indexdef: string }>(
    "SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY indexdef",
  );
  return rows.map((row) => row.indexdef);
}

/** An alert as the code before F6 writes one: no `place_name`. */
async function insertPreF6Alert(
  db: Client,
  id: string,
  criteriaId: string,
  label: string,
): Promise<void> {
  await db.query(
    `INSERT INTO alerts (id, user_id, criteria_id, label, unsubscribe_token_hash, unsubscribe_subject, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, now(), now())`,
    [id, USER_ID, criteriaId, label, `place-fixture-unsub-${id}`, id],
  );
}

let columnsBefore: ColumnRow[];
let indexesBefore: string[];

beforeAll(async () => {
  const admin = new Client({ host, port, user, password, database: "postgres" });
  await admin.connect();
  try {
    // DB_NAME is built from Math.random(), never user input, but still quoted.
    await admin.query(`CREATE DATABASE "${DB_NAME}"`);
  } finally {
    await admin.end();
  }

  client = new Client({ host, port, user, password, database: DB_NAME });
  await client.connect();

  for (const file of migrationsBefore()) {
    await client.query(readFileSync(file, "utf8"));
  }

  await client.query(
    "INSERT INTO users (id, email, name, created_at, updated_at) VALUES ($1, $2, $3, now(), now())",
    [USER_ID, "place-fixture@example.test", "Fixture"],
  );
  await client.query(
    "INSERT INTO alert_criteria (id, criteria_hash, criteria, created_at, updated_at) VALUES ($1, $2, $3, now(), now())",
    [CRITERIA_ID, "place-fixture-criteria-hash", JSON.stringify({ brand: "Renault" })],
  );
  await client.query(
    "INSERT INTO alert_criteria (id, criteria_hash, criteria, created_at, updated_at) VALUES ($1, $2, $3, now(), now())",
    [LATER_CRITERIA_ID, "place-fixture-later-criteria-hash", JSON.stringify({ brand: "BMW" })],
  );
  await insertPreF6Alert(client, OLD_ALERT_ID, CRITERIA_ID, "Clio barato");

  columnsBefore = await columns(client);
  indexesBefore = await indexes(client);
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

describe("ALERTUI-49: the alert_place_name migration", () => {
  it("ALERTUI-49: adds alerts.place_name, text, nullable, with no default and no index, and changes nothing else; a row written as before F6 reads null", async () => {
    expect(
      PLACE_NAME_DIR,
      `expected a prisma/migrations/*${MIGRATION_SUFFIX} directory`,
    ).toBeDefined();
    if (PLACE_NAME_DIR === undefined) return;
    expect(columnsBefore.some((column) => column.column_name === "place_name")).toBe(false);

    await client.query(readFileSync(join(MIGRATIONS_DIR, PLACE_NAME_DIR, "migration.sql"), "utf8"));

    const after = await columns(client);
    const added = after.filter(
      (column) =>
        !columnsBefore.some(
          (before) =>
            before.table_name === column.table_name && before.column_name === column.column_name,
        ),
    );
    expect(added).toEqual([
      {
        table_name: "alerts",
        column_name: "place_name",
        data_type: "text",
        is_nullable: "YES",
        column_default: null,
      },
    ]);
    // Every column there before is still there, unchanged.
    expect(after.filter((column) => column.column_name !== "place_name")).toEqual(columnsBefore);
    expect(await indexes(client)).toEqual(indexesBefore);

    // The row already there, and one inserted after the migration by the code
    // before F6 (which never names the column), both read null.
    await insertPreF6Alert(client, LATER_ALERT_ID, LATER_CRITERIA_ID, "Serie 3 diésel");
    const { rows } = await client.query<{ id: string; place_name: string | null }>(
      "SELECT id, place_name FROM alerts ORDER BY id",
    );
    expect(rows).toEqual([
      { id: OLD_ALERT_ID, place_name: null },
      { id: LATER_ALERT_ID, place_name: null },
    ]);
  });
});
