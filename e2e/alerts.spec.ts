import { test, expect } from "@playwright/test";
import {
  clearAlertQueue,
  seedAlertJobs,
  claimConcurrently,
  claimOnce,
} from "./fixtures/db";

// The queue's safety property is the one thing Vitest cannot reach. Prisma is
// mocked there, so a node test would assert that the right query was issued
// while any fake it ran against would supply the exclusivity and the ordering
// itself — proving the fake, not the queue.
//
// `FOR UPDATE SKIP LOCKED` is a Postgres behaviour, so it is verified against
// Postgres. This suite does NOT run in CI (see docs/testing.md), which is why
// the unique indexes in the spec's §5 exist as an independent second guard.
const dbTest = process.env.E2E_DB ? test : test.skip;

test.describe("alert queue", () => {
  // Guarded inside rather than as `dbTest.beforeEach`: `dbTest` is a union of
  // `test` and `test.skip`, and `test.skip` carries no hooks.
  test.beforeEach(async () => {
    if (!process.env.E2E_DB) return;
    await clearAlertQueue();
  });

  test.afterAll(async () => {
    if (!process.env.E2E_DB) return;
    await clearAlertQueue();
  });

  dbTest("ALERT-13: two workers draining at once never claim the same job", async () => {
    await seedAlertJobs(20);

    // Both claim in overlapping transactions, exactly as two matrix jobs do.
    const [first, second] = await claimConcurrently(10, 10);

    const overlap = first.filter((id) => second.includes(id));
    expect(overlap).toEqual([]);
    // And nothing was silently dropped: 20 jobs, 20 distinct claims.
    expect(new Set([...first, ...second]).size).toBe(20);
  });

  dbTest("ALERT-13: a second worker takes different work rather than waiting", async () => {
    await seedAlertJobs(4);

    const [first, second] = await claimConcurrently(2, 2);

    // Plain FOR UPDATE would make the second worker block behind the first,
    // which is a slower version of one worker. SKIP LOCKED is what makes
    // parallel draining actually parallel.
    expect(first).toHaveLength(2);
    expect(second).toHaveLength(2);
  });

  dbTest("ALERT-14: the job waiting longest is claimed first", async () => {
    // Inserted newest-first so insertion order cannot be mistaken for ordering.
    await seedAlertJobs(3, { enqueuedMinutesAgo: [5, 40, 20] });

    const claimed = await claimOnce(1);

    expect(claimed).toHaveLength(1);
    // A fair queue bounds the worst-case lag; an arbitrary one bounds only the
    // average, and the freshness target is a claim about the worst case.
    expect(claimed[0].enqueuedMinutesAgo).toBe(40);
  });

  dbTest("ALERT-14: a job still backing off is not claimed even when oldest", async () => {
    await seedAlertJobs(2, {
      enqueuedMinutesAgo: [60, 5],
      availableInMinutes: [30, 0],
    });

    const claimed = await claimOnce(2);

    // The oldest is the one that keeps failing; claiming it every lap would
    // starve the healthy work behind it.
    expect(claimed).toHaveLength(1);
    expect(claimed[0].enqueuedMinutesAgo).toBe(5);
  });
});
