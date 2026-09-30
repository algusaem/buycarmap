import { faker } from "@faker-js/faker";
import { Client } from "pg";
import { afterAll, beforeEach, inject } from "vitest";

// TEST-6 (docs/specs/core-testing.md): per Vitest worker, a database copied
// from the template test/integration.global-setup.ts migrated, truncated
// before every test so order never matters.
//
// `process.env.DATABASE_URL` is set here, before any app import, because
// lib/env.ts (t3-oss/env-nextjs) validates and caches it the first time it is
// imported. A static `import { prisma } from "@/lib/db/prisma"` at the top of
// this file would be hoisted above this assignment by ES module semantics and
// read the dummy value vitest.config.ts's shared `env` sets for the other
// projects — so the app modules below are imported dynamically instead, after
// the real URL is in place.

const host = inject("pgHost");
const port = inject("pgPort");
const user = inject("pgUser");
const password = inject("pgPassword");
const templateDatabase = inject("pgTemplateDatabase");

const workerDatabase = `buycarmap_w${process.env.VITEST_POOL_ID ?? "0"}`;

process.env.DATABASE_URL = `postgresql://${user}:${password}@${host}:${port}/${workerDatabase}`;

async function ensureWorkerDatabase(): Promise<void> {
  const admin = new Client({ host, port, user, password, database: "postgres" });
  await admin.connect();
  try {
    const { rows } = await admin.query<{ exists: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
      [workerDatabase],
    );
    if (!rows[0]?.exists) {
      // workerDatabase and templateDatabase are both built from trusted,
      // non-user-supplied values (VITEST_POOL_ID and the container's own
      // database name) — never user input — but still double-quoted rather
      // than trusted.
      await admin.query(`CREATE DATABASE "${workerDatabase}" TEMPLATE "${templateDatabase}"`);
    }
  } finally {
    await admin.end();
  }
}

await ensureWorkerDatabase();

const { prisma } = await import("@/lib/db/prisma");

const FAKER_SEED = 20260930;

beforeEach(async () => {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
  `;
  if (tables.length > 0) {
    const identifiers = tables.map((table) => `"${table.tablename}"`).join(", ");
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${identifiers} RESTART IDENTITY CASCADE`);
  }
  faker.seed(FAKER_SEED);
});

afterAll(async () => {
  await prisma.$disconnect();
});
