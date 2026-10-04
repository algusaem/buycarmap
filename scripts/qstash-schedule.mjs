// Creates or updates the one QStash schedule that drives the alert runner
// (docs/decisions/0007-adopt-core-rules.md row 23; docs/specs/core-integrations.md,
// INT-8). Run twice, it must leave exactly one schedule.
//
// Usage:
//   node scripts/qstash-schedule.mjs

import { fileURLToPath } from "node:url";
import { Client } from "@upstash/qstash";

const CRON = "*/5 * * * *";
const RETRIES = 3;
const METHOD = "POST";

/**
 * @typedef {{
 *   schedules: {
 *     list(): Promise<Array<{ scheduleId: string, destination: string, cron: string }>>,
 *     create(opts: { destination: string, cron: string, retries: number, method: string }): Promise<{ scheduleId: string }>,
 *     delete(scheduleId: string): Promise<void>,
 *   }
 * }} QstashScheduleClient
 */

/**
 * TOOLING-safe seam: `env`, `client` and the reporting functions are
 * injected, so the colocated test can run the whole check against a fake
 * QStash client instead of the real network.
 *
 * @param {{
 *   env?: Record<string, string | undefined>,
 *   client?: QstashScheduleClient,
 *   log?: (message: string) => void,
 *   error?: (message: string) => void,
 * }} [deps]
 * @returns {Promise<number>} the process exit code
 */
export async function main({
  env = process.env,
  client,
  log = console.log,
  error = console.error,
} = {}) {
  const token = env.QSTASH_TOKEN;
  if (!token) {
    error("QSTASH_TOKEN is required");
    return 1;
  }

  const appUrl = env.APP_URL;
  if (!appUrl) {
    error("APP_URL is required");
    return 1;
  }

  // QSTASH_URL picks the account's region (e.g. https://qstash-eu-central-1.upstash.io);
  // without it the SDK uses its default endpoint.
  const qstash = client ?? new Client({ token, baseUrl: env.QSTASH_URL });
  const destination = `${appUrl}/api/alerts/run`;

  // A schedule's `retries` is only compared when the listing actually reports
  // one — QStash's own API does, but this keeps the check meaningful even
  // against a listing that omits it.
  const isCurrent = (schedule) =>
    schedule.destination === destination &&
    schedule.cron === CRON &&
    (schedule.retries === undefined || schedule.retries === RETRIES);

  const existing = await qstash.schedules.list();

  // A schedule at the right destination but the wrong cron or retries is
  // replaced rather than left to drift from what this script would create —
  // run twice, it must leave exactly one schedule at the current settings.
  for (const schedule of existing) {
    if (schedule.destination === destination && !isCurrent(schedule)) {
      await qstash.schedules.delete(schedule.scheduleId);
    }
  }

  const stillCurrent = (await qstash.schedules.list()).some(isCurrent);

  if (stillCurrent) {
    log(`Schedule already up to date for ${destination}`);
    return 0;
  }

  const created = await qstash.schedules.create({
    destination,
    cron: CRON,
    retries: RETRIES,
    method: METHOD,
  });

  log(`Created schedule ${created.scheduleId} for ${destination}`);
  return 0;
}

// Guarded so `main` can be imported by the colocated test without the
// schedule call running as a side effect of `import`.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(await main());
}
