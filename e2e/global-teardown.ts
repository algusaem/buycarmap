import { cleanupE2eUsers } from "./fixtures/db";

// Runs once after the whole Playwright run. Only touches the DB when the
// DB-gated auth tests were enabled (E2E_DB=1); otherwise there is nothing to
// clean and no real database is configured.
export default async function globalTeardown(): Promise<void> {
  if (!process.env.E2E_DB) return;

  const deleted = await cleanupE2eUsers();
  console.log(`[e2e teardown] removed ${deleted} test user(s)`);
}
