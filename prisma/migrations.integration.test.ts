import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { hashUnsubscribeToken, unsubscribeTokenFor } from "@/server/alerts/unsubscribe-token";

// DATA-2 (docs/specs/core-data-model.md): the migration is proven on a
// migrated copy of a fixture database holding one of each relation, checking
// counts and joins before and after. This test builds its OWN database — a
// fresh one, migrated with every OLD migration but not the new one — rather
// than using the shared per-worker database test/setup.integration.ts gives
// every other integration test, because it has to control exactly which
// migrations are applied and in what order.

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MIGRATIONS_DIR = join(ROOT, "prisma/migrations");
const NEW_MIGRATION_DIR = "20261001000000_core_data_model";
const NEW_MIGRATION_PATH = join(MIGRATIONS_DIR, NEW_MIGRATION_DIR, "migration.sql");
const MIGRATION_EXISTS = existsSync(NEW_MIGRATION_PATH);

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function oldMigrationSqlFiles(): string[] {
  // Strictly before NEW_MIGRATION_DIR, not merely "a different name": a
  // migration added after it (BAUTH-14's 20261004000000_better_auth, which
  // assumes the snake_case table names NEW_MIGRATION_DIR itself introduces)
  // would otherwise be swept in here and fail against the un-renamed tables
  // this fixture deliberately stops short of.
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name < NEW_MIGRATION_DIR)
    .map((entry) => entry.name)
    .sort()
    .map((name) => join(MIGRATIONS_DIR, name, "migration.sql"));
}

const host = inject("pgHost");
const port = inject("pgPort");
const user = inject("pgUser");
const password = inject("pgPassword");

const DB_NAME = `buycarmap_mig_${Math.random().toString(36).slice(2, 10)}`;

let client: Client;

// Distinct, cuid-shaped old ids — any text works as the old primary key, what
// matters is that they are NOT UUIDs, so a post-migration UUID check can tell
// the difference.
const OLD_USER_ID = "old-cuid-user-1";
const OLD_FAVORITE_EARLY_ID = "old-cuid-favorite-0";
const OLD_FAVORITE_ID = "old-cuid-favorite-1";
const OLD_CRITERIA_ID = "old-cuid-criteria-1";
const OLD_ALERT_ID = "old-cuid-alert-1";
const OLD_MATCH_ID = "old-cuid-match-1";
const OLD_SEEN_ID = "old-cuid-seen-1";

/** Minutes after a fixed base instant, distinct per row (DATA-2). */
function createdAt(minutesAfterBase: number): string {
  return new Date(Date.UTC(2026, 8, 1, 0, minutesAfterBase, 0)).toISOString();
}

async function count(db: Client, tableSql: string): Promise<number> {
  const { rows } = await db.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM ${tableSql}`);
  return rows[0].n;
}

let oldCounts: Record<string, number>;

async function seedOldFixture(db: Client): Promise<void> {
  await db.query(
    `INSERT INTO "User" (id, email, "updatedAt", "createdAt") VALUES ($1, $2, $3, $4)`,
    [OLD_USER_ID, "fixture-user@example.test", createdAt(1), createdAt(1)],
  );

  const favoriteColumns = `(id, "userId", "listingId", source, title, subtitle, image, brand, model, location, fuel, url, price, mileage, year, lat, lng, "createdAt")`;
  const favoriteValues = `($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`;

  // An earlier row than F, so the ordering assertion below has two rows to compare.
  await db.query(`INSERT INTO "Favorite" ${favoriteColumns} VALUES ${favoriteValues}`, [
    OLD_FAVORITE_EARLY_ID,
    OLD_USER_ID,
    "wallapop-fixture-0",
    "Wallapop",
    "Seat Leon",
    "Fine",
    "https://cdn.wallapop.com/img0.jpg",
    "Seat",
    "Leon",
    "Valencia",
    "gasoil",
    "https://es.wallapop.com/item/seat-leon-0",
    9000,
    150000,
    2015,
    39.47,
    -0.37,
    createdAt(0),
  ]);

  await db.query(`INSERT INTO "Favorite" ${favoriteColumns} VALUES ${favoriteValues}`, [
    OLD_FAVORITE_ID,
    OLD_USER_ID,
    "wallapop-fixture-1",
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
    createdAt(2),
  ]);

  await db.query(
    `INSERT INTO "AlertCriteria" (id, "criteriaHash", criteria, "createdAt") VALUES ($1,$2,$3,$4)`,
    [OLD_CRITERIA_ID, "fixture-criteria-hash", JSON.stringify({ brand: "Audi" }), createdAt(3)],
  );

  const unsubscribeTokenHash = hashUnsubscribeToken(unsubscribeTokenFor(OLD_ALERT_ID));

  await db.query(
    `INSERT INTO "Alert" (id, "userId", "criteriaId", label, "unsubscribeTokenHash", "createdAt") VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      OLD_ALERT_ID,
      OLD_USER_ID,
      OLD_CRITERIA_ID,
      "Fixture alert",
      unsubscribeTokenHash,
      createdAt(4),
    ],
  );

  await db.query(
    `INSERT INTO "AlertMatch" (id, "alertId", "listingId", source, title, subtitle, image, brand, model, location, fuel, url, price, mileage, year, lat, lng, "createdAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
    [
      OLD_MATCH_ID,
      OLD_ALERT_ID,
      "wallapop-fixture-match",
      "Wallapop",
      "Audi A3 Match",
      "Great condition",
      "https://cdn.wallapop.com/img2.jpg",
      "Audi",
      "A3",
      "Madrid",
      "gasoil",
      "https://es.wallapop.com/item/audi-a3-match",
      15000,
      90000,
      2019,
      40.41,
      -3.7,
      createdAt(5),
    ],
  );

  await db.query(
    `INSERT INTO "AlertSeenListing" (id, "criteriaId", "listingId", source, "firstSeenAt") VALUES ($1,$2,$3,$4,$5)`,
    [OLD_SEEN_ID, OLD_CRITERIA_ID, "wallapop-fixture-seen", "Wallapop", createdAt(6)],
  );
}

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

  for (const file of oldMigrationSqlFiles()) {
    await client.query(readFileSync(file, "utf8"));
  }

  await seedOldFixture(client);

  oldCounts = {
    users: await count(client, '"User"'),
    favorites: await count(client, '"Favorite"'),
    alert_criteria: await count(client, '"AlertCriteria"'),
    alerts: await count(client, '"Alert"'),
    alert_matches: await count(client, '"AlertMatch"'),
    alert_seen_listings: await count(client, '"AlertSeenListing"'),
  };
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

describe("DATA-2: the migration converts every id to a UUIDv7 and rewrites every FK", () => {
  it("DATA-2: preserves row counts, the five relations, and assigns v7 UUIDs in createdAt order", async () => {
    // Fails here, cleanly, until the migration is written — not a crash from
    // reading a file or querying a table that does not exist yet.
    expect(MIGRATION_EXISTS, `expected ${NEW_MIGRATION_PATH} to exist`).toBe(true);

    await client.query(readFileSync(NEW_MIGRATION_PATH, "utf8"));

    const newCounts = {
      users: await count(client, "users"),
      favorites: await count(client, "favorites"),
      alert_criteria: await count(client, "alert_criteria"),
      alerts: await count(client, "alerts"),
      alert_matches: await count(client, "alert_matches"),
      alert_seen_listings: await count(client, "alert_seen_listings"),
    };
    expect(newCounts).toEqual(oldCounts);

    const favoriteUserJoin = await client.query(
      "SELECT f.id FROM favorites f JOIN users u ON f.user_id = u.id",
    );
    expect(favoriteUserJoin.rowCount).toBe(newCounts.favorites);

    const alertUserJoin = await client.query(
      "SELECT a.id FROM alerts a JOIN users u ON a.user_id = u.id",
    );
    expect(alertUserJoin.rowCount).toBe(newCounts.alerts);

    const alertCriteriaJoin = await client.query(
      "SELECT a.id FROM alerts a JOIN alert_criteria c ON a.criteria_id = c.id",
    );
    expect(alertCriteriaJoin.rowCount).toBe(newCounts.alerts);

    const matchAlertJoin = await client.query(
      "SELECT m.id FROM alert_matches m JOIN alerts a ON m.alert_id = a.id",
    );
    expect(matchAlertJoin.rowCount).toBe(newCounts.alert_matches);

    const seenCriteriaJoin = await client.query(
      "SELECT s.id FROM alert_seen_listings s JOIN alert_criteria c ON s.criteria_id = c.id",
    );
    expect(seenCriteriaJoin.rowCount).toBe(newCounts.alert_seen_listings);

    for (const table of [
      "users",
      "favorites",
      "alert_criteria",
      "alerts",
      "alert_matches",
      "alert_seen_listings",
    ]) {
      const { rows } = await client.query<{ id: string }>(`SELECT id FROM ${table}`);
      for (const row of rows) {
        expect(row.id, `${table}.id`).toMatch(UUID_V7);
      }
    }

    // F was created after the early favorite, so its UUIDv7 must sort after it too.
    const { rows: favoritesByCreatedAt } = await client.query<{ id: string }>(
      "SELECT id FROM favorites ORDER BY created_at ASC",
    );
    const ids = favoritesByCreatedAt.map((row) => row.id);
    expect(ids).toEqual([...ids].sort());
  });

  it("DATA-2 edge case: an unsubscribe link sent before the migration still verifies", async () => {
    expect(MIGRATION_EXISTS, `expected ${NEW_MIGRATION_PATH} to exist`).toBe(true);

    // Relies on the previous test having already applied the migration to
    // this same database — this file owns its database end to end and the
    // two tests run in file order, unlike the shared per-worker database.
    const { rows } = await client.query<{
      unsubscribe_subject: string;
      unsubscribe_token_hash: string;
    }>("SELECT unsubscribe_subject, unsubscribe_token_hash FROM alerts LIMIT 1");

    expect(rows[0]?.unsubscribe_subject).toBe(OLD_ALERT_ID);
    expect(rows[0]?.unsubscribe_token_hash).toBe(
      hashUnsubscribeToken(unsubscribeTokenFor(OLD_ALERT_ID)),
    );
  });
});
