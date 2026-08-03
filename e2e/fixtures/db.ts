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
  name = "Seeded User"
): Promise<void> {
  const id = `${e2eEmail("id")}`;
  const hash = await bcrypt.hash(password, 12);
  await withClient((client) =>
    client.query(
      'INSERT INTO "User"(id, email, password, name, "updatedAt") VALUES ($1, $2, $3, $4, now())',
      [id, email, hash, name]
    )
  );
}

export async function userExists(email: string): Promise<boolean> {
  return withClient(async (client) => {
    const result = await client.query('SELECT 1 FROM "User" WHERE email = $1', [
      email,
    ]);
    return (result.rowCount ?? 0) > 0;
  });
}

/** Delete every account created by this suite. Safe to call repeatedly. */
export async function cleanupE2eUsers(): Promise<number> {
  return withClient(async (client) => {
    const result = await client.query(
      `DELETE FROM "User" WHERE email LIKE $1`,
      [`%@${E2E_EMAIL_DOMAIN}`]
    );
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
      [email]
    );
    return result.rows[0].n as number;
  });
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
