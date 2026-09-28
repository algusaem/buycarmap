import "dotenv/config";
import pg from "pg";
import bcrypt from "bcryptjs";

// Every account this suite touches lives under this domain so a single
// pattern-delete can sweep them all, even if a run crashes mid-way.
export const E2E_EMAIL_DOMAIN = "e2e.local";

let counter = 0;

/** Unique, clearly-tagged email so test rows are always identifiable. */
export function e2eEmail(tag = "user"): string {
  counter += 1;
  return `e2e-${tag}-${Date.now()}-${counter}@${E2E_EMAIL_DOMAIN}`;
}

async function withClient<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** Insert a user directly (bcrypt-hashed) so login tests have a known account. */
export async function seedUser(
  email: string,
  password: string,
  name = "Seeded User",
): Promise<void> {
  const id = `${e2eEmail("id")}`;
  const hash = await bcrypt.hash(password, 12);
  await withClient((client) =>
    client.query(
      'INSERT INTO "User"(id, email, password, name, "updatedAt") VALUES ($1, $2, $3, $4, now())',
      [id, email, hash, name],
    ),
  );
}

export async function userExists(email: string): Promise<boolean> {
  return withClient(async (client) => {
    const result = await client.query('SELECT 1 FROM "User" WHERE email = $1', [email]);
    return (result.rowCount ?? 0) > 0;
  });
}

/** Delete every account created by this suite. Safe to call repeatedly. */
export async function cleanupE2eUsers(): Promise<number> {
  return withClient(async (client) => {
    const result = await client.query(`DELETE FROM "User" WHERE email LIKE $1`, [
      `%@${E2E_EMAIL_DOMAIN}`,
    ]);
    return result.rowCount ?? 0;
  });
}

/**
 * Clears the rate-limit counters.
 *
 * The auth suite signs in many times from one address, which exhausts the
 * per-IP login budget partway through a run and fails later tests for a reason
 * that has nothing to do with what they assert. The limiter has its own
 * dedicated tests; here it is environmental noise.
 */
export async function clearRateLimits(): Promise<void> {
  await withClient((client) => client.query('DELETE FROM "RateLimit"'));
}

/**
 * How many favorites the account currently has, read straight from Postgres.
 *
 * The UI's optimistic toggle flips before the server answers and rolls back
 * afterwards on failure, so no assertion on the page can prove a save landed.
 * Polling this does, and it is what the test actually claims.
 */
export async function favoriteCount(email: string): Promise<number> {
  return withClient(async (client) => {
    const result = await client.query(
      'SELECT COUNT(*)::int AS n FROM "Favorite" f JOIN "User" u ON u.id = f."userId" WHERE u.email = $1',
      [email],
    );
    return result.rows[0].n as number;
  });
}

// ---------------------------------------------------------------------------
// Alert queue helpers (ALERT-13, ALERT-14)
//
// These drive the claim query directly rather than through the browser: the
// property under test is what Postgres does when two transactions reach for the
// same rows, and there is no UI for that.
// ---------------------------------------------------------------------------

export interface ClaimedJob {
  id: string;
  enqueuedMinutesAgo: number;
}

/** The claim query the runner issues. Kept here so the tests exercise it verbatim. */
const CLAIM_SQL = `
  SELECT id, EXTRACT(EPOCH FROM (now() - "enqueuedAt")) / 60 AS minutes
  FROM "AlertPollJob"
  WHERE status = 'pending' AND "availableAt" <= now()
  ORDER BY "enqueuedAt" ASC
  LIMIT $1
  FOR UPDATE SKIP LOCKED
`;

export async function clearAlertQueue(): Promise<void> {
  await withClient(async (client) => {
    await client.query('DELETE FROM "AlertPollJob"');
    await client.query('DELETE FROM "AlertCriteria" WHERE "criteriaHash" LIKE $1', ["e2e-%"]);
  });
}

/**
 * Inserts `count` pending jobs, each against its own criteria row.
 *
 * `enqueuedMinutesAgo` and `availableInMinutes` are per-job when supplied, so a
 * test can make insertion order disagree with queue order deliberately.
 */
export async function seedAlertJobs(
  count: number,
  options: {
    enqueuedMinutesAgo?: number[];
    availableInMinutes?: number[];
  } = {},
): Promise<void> {
  await withClient(async (client) => {
    for (let n = 0; n < count; n++) {
      const criteriaId = `e2e-crit-${Date.now()}-${n}`;
      const enqueued = options.enqueuedMinutesAgo?.[n] ?? n;
      const available = options.availableInMinutes?.[n] ?? 0;
      await client.query(
        `INSERT INTO "AlertCriteria"(id, "criteriaHash", criteria)
         VALUES ($1, $2, '{}'::jsonb)`,
        [criteriaId, `e2e-${criteriaId}`],
      );
      await client.query(
        `INSERT INTO "AlertPollJob"(id, "criteriaId", status, attempts, "availableAt", "enqueuedAt")
         VALUES ($1, $2, 'pending', 0, now() + ($3 || ' minutes')::interval, now() - ($4 || ' minutes')::interval)`,
        [`e2e-job-${criteriaId}`, criteriaId, String(available), String(enqueued)],
      );
    }
  });
}

/** Claims in a single transaction and rolls back, leaving the queue untouched. */
export async function claimOnce(limit: number): Promise<ClaimedJob[]> {
  return withClient(async (client) => {
    await client.query("BEGIN");
    const result = await client.query(CLAIM_SQL, [limit]);
    await client.query("ROLLBACK");
    return result.rows.map((row) => ({
      id: row.id as string,
      enqueuedMinutesAgo: Math.round(Number(row.minutes)),
    }));
  });
}

/**
 * Two overlapping transactions claiming at the same time.
 *
 * Both hold their locks until the other has finished claiming, which is the
 * situation two parallel matrix jobs create and the only one where SKIP LOCKED
 * differs observably from plain FOR UPDATE.
 */
export async function claimConcurrently(
  firstLimit: number,
  secondLimit: number,
): Promise<[string[], string[]]> {
  const a = new pg.Client({ connectionString: process.env.DATABASE_URL });
  const b = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await a.connect();
  await b.connect();

  try {
    await a.query("BEGIN");
    await b.query("BEGIN");

    // Sequential statements, overlapping transactions: A still holds its locks
    // when B runs, so B must skip A's rows rather than block on them.
    const first = await a.query(CLAIM_SQL, [firstLimit]);
    const second = await b.query(CLAIM_SQL, [secondLimit]);

    await a.query("ROLLBACK");
    await b.query("ROLLBACK");

    return [first.rows.map((row) => row.id as string), second.rows.map((row) => row.id as string)];
  } finally {
    await a.end();
    await b.end();
  }
}

/**
 * Clears the auth rate limiter.
 *
 * The suite signs in dozens of times from one address, and the login limit is
 * 20 per IP per 15 minutes. Running `pnpm test:e2e:db` twice inside that window
 * therefore exhausts it, and every subsequent sign-in is refused -- which
 * presents as "login is broken" rather than "you are rate limited", and cost an
 * investigation. Starting each run from a clean limiter is test setup, not a
 * weakening of the limit itself.
 */
export async function resetRateLimits(): Promise<number> {
  return withClient(async (client) => {
    const result = await client.query('DELETE FROM "RateLimit"');
    return result.rowCount ?? 0;
  });
}
