import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createAlert } from "@/test/factories/alert";
import { createAlertCriteria } from "@/test/factories/alert-criteria";
import { createUser } from "@/test/factories/user";
import { makeCriteria, makeMatchListing } from "@/test/fixtures/alerts";
import type { RunSummary } from "@/interfaces/alert";

// server/alerts/service.ts's drainQueue claims jobs with a raw SQL query that
// filters and stamps on Postgres' own `now()`, not on the `now: Date`
// argument runAlerts receives — only the enqueue and backoff arithmetic use
// that argument. `NOW` below is therefore read from the database's own clock
// (not a fixed historical date, as the mocked version used, and not the JS
// host clock, which can run ahead of Postgres') and the fake clock is only
// ever pinned to it, never moved into the past or future, so SQL's now() and
// the frozen JS clock stay consistent for the one SQL-driven claim per
// run(). The worked deltas (minutesAgo, the 5-minute backoff, the interval
// maths) are unchanged from the mocked version.

let emailConfigured = true;

vi.mock("@/lib/env", () => ({
  // BETTER_AUTH_SECRET keys the unsubscribe-token HMAC, so the runner cannot
  // build a link without it.
  env: { BETTER_AUTH_SECRET: "test-secret" },
}));

vi.mock("@/lib/app-config", () => ({
  get isEmailConfigured() {
    return emailConfigured;
  },
  appUrl: "https://buycarmap.test",
}));

// Harness change (docs/specs/core-integrations.md, INT-13/decision 6):
// server/alerts/service.ts now sends through lib/platform/email.ts, not the
// deleted lib/email/client.ts — same mock shape, same call-site assertions.
vi.mock("@/lib/platform/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/server/alerts/search", () => ({ searchAllSources: vi.fn() }));
// docs/specs/core-integrations.md, INT-7: /api/alerts/run is meant to accept
// only a request QStash itself signed, verified through this module. It does
// not exist as a dependency of route.ts yet (lib/platform/qstash.ts is a
// stub), so mocking it here changes nothing about today's behaviour — which
// is exactly what makes the INT-7 cases below fail as assertions rather than
// pass by accident.
vi.mock("@/lib/platform/qstash", () => ({ verifyQstashSignature: vi.fn(async () => true) }));

import { sendEmail } from "@/lib/platform/email";
import { verifyQstashSignature } from "@/lib/platform/qstash";
import { searchAllSources } from "@/server/alerts/search";
import { POST } from "./route";

let NOW: Date;
let ADA: { id: string; email: string };
let GRACE: { id: string; email: string };

// The subset of the route's RunSummary this file's assertions read.
type RunSummaryBody = Pick<
  RunSummary,
  | "intervalMs"
  | "criteriaCount"
  | "oldestPendingAgeMs"
  | "claimed"
  | "unhealthySources"
  | "emailed"
  | "skippedNoEmail"
>;

function run(secret: string | null = "cron-secret"): Promise<Response> {
  return POST(
    new NextRequest("http://localhost:3000/api/alerts/run", {
      method: "POST",
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
    }),
  );
}

/**
 * Every source healthy, returning exactly these listings.
 *
 * `perSourceCounts` is derived from the listings rather than omitted, because
 * the real `searchAllSources` always reports it — a mock returning a shape the
 * function never produces would hide bugs instead of surfacing them.
 */
function sourcesReturn(...listings: ReturnType<typeof makeMatchListing>[]) {
  const perSourceCounts: Record<string, number> = {
    Wallapop: 0,
    "Coches.net": 0,
    Milanuncios: 0,
  };
  for (const listing of listings) {
    perSourceCounts[listing.source] = (perSourceCounts[listing.source] ?? 0) + 1;
  }

  vi.mocked(searchAllSources).mockResolvedValue({
    listings,
    failedSources: [],
    perSourceCounts,
  });
}

/** Minutes before NOW, for lastPolledAt / enqueuedAt / availableAt. */
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

/** One subscribed criteria set with a pending job, ready to be drained. */
async function seedSubscribedCriteria(
  options: { userId?: string; lastPolledMinutesAgo?: number } = {},
) {
  const criteria = await createAlertCriteria({
    criteria: makeCriteria(),
    lastPolledAt:
      options.lastPolledMinutesAgo === undefined ? null : minutesAgo(options.lastPolledMinutesAgo),
  });
  const alert = await createAlert({
    user: { connect: { id: options.userId ?? ADA.id } },
    criteria: { connect: { id: criteria.id } },
  });
  const job = await prisma.alertPollJob.create({
    data: { criteriaId: criteria.id, status: "pending", enqueuedAt: NOW },
  });
  return { criteria, alert, job };
}

async function pendingJobs() {
  return prisma.alertPollJob.findMany({ where: { status: "pending" } });
}

async function runningJobs() {
  return prisma.alertPollJob.findMany({ where: { status: "running" } });
}

async function matchesFor(alertId: string) {
  return prisma.alertMatch.findMany({ where: { alertId } });
}

async function seenFor(criteriaId: string) {
  return prisma.alertSeenListing.findMany({ where: { criteriaId } });
}

beforeEach(async () => {
  const [{ now }] = await prisma.$queryRaw<{ now: Date }[]>`SELECT now() AS now`;
  // A few seconds behind the database clock: the Docker VM's clock is synced
  // in steps and can jump back slightly, which would put rows stamped at NOW
  // ahead of a later SQL now() and make the claim skip them.
  NOW = new Date(now.getTime() - 5_000);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  emailConfigured = true;
  ADA = await createUser({ email: "ada@example.com", locale: "en" });
  GRACE = await createUser({ email: "grace@example.com", locale: "es" });
  vi.mocked(sendEmail).mockClear().mockResolvedValue(true);
  vi.mocked(searchAllSources).mockClear();
  vi.mocked(verifyQstashSignature).mockClear().mockResolvedValue(true);
  sourcesReturn();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("authorisation", () => {
  // Harness change (docs/specs/core-integrations.md, INT-7): the route no
  // longer checks a shared bearer secret at all — every ALERT-9 case here now
  // simulates "unauthorised" by mocking verifyQstashSignature's answer,
  // rather than the Authorization header. Expected values (still 401/401/200)
  // are unchanged.
  it("ALERT-9: refuses a request with no valid signature and does no work", async () => {
    const { job } = await seedSubscribedCriteria();
    vi.mocked(verifyQstashSignature).mockResolvedValueOnce(false);

    const response = await run(null);

    expect(response.status).toBe(401);
    expect(searchAllSources).not.toHaveBeenCalled();
    const found = await prisma.alertPollJob.findUnique({ where: { id: job.id } });
    expect(found?.status).toBe("pending");
  });

  it("ALERT-9: refuses a request with the wrong signature", async () => {
    await seedSubscribedCriteria();
    vi.mocked(verifyQstashSignature).mockResolvedValueOnce(false);

    const response = await run(null);

    expect(response.status).toBe(401);
    expect(searchAllSources).not.toHaveBeenCalled();
  });

  it("ALERT-9: accepts a valid signature", async () => {
    await seedSubscribedCriteria();

    expect((await run()).status).toBe(200);
  });
});

describe("INT-7 (docs/specs/core-integrations.md): QStash signature verification", () => {
  it("INT-7: a wrong or missing QStash signature is refused even with the right bearer secret", async () => {
    const { job } = await seedSubscribedCriteria();
    vi.mocked(verifyQstashSignature).mockResolvedValueOnce(false);

    const response = await run();

    expect(response.status).toBe(401);
    expect(searchAllSources).not.toHaveBeenCalled();
    const found = await prisma.alertPollJob.findUnique({ where: { id: job.id } });
    expect(found?.status).toBe("pending");
  });

  it("INT-7: a valid QStash signature is accepted with no bearer secret at all", async () => {
    await seedSubscribedCriteria();
    vi.mocked(verifyQstashSignature).mockResolvedValueOnce(true);

    const response = await run(null);

    expect(response.status).toBe(200);
  });
});

describe("INT-11 (docs/specs/core-integrations.md): the runner's behaviour is unchanged", () => {
  it("INT-11: a full run authorised only by a valid QStash signature still drains a job and creates a match", async () => {
    const { criteria, alert } = await seedSubscribedCriteria();
    vi.mocked(verifyQstashSignature).mockResolvedValue(true);
    sourcesReturn(makeMatchListing({ id: "wallapop-new1" }));

    // No Authorization header at all — mirrors ALERT-15's expected values
    // ("an unseen listing becomes a match for the subscriber"), with the
    // request authorised only by the (mocked) QStash signature.
    const response = await POST(
      new NextRequest("http://localhost:3000/api/alerts/run", { method: "POST" }),
    );

    expect(response.status).toBe(200);
    const matches = await matchesFor(alert.id);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      listingId: "wallapop-new1",
      title: "Audi A3 2.0 TDI",
      price: 14500,
      url: "https://es.wallapop.com/item/audi-a3-abc123",
    });
    expect((await seenFor(criteria.id)).map((row) => row.listingId)).toEqual(["wallapop-new1"]);
  });
});

describe("enqueueing", () => {
  it("ALERT-10: enqueues a criteria set polled longer ago than the interval", async () => {
    const criteria = await createAlertCriteria({
      criteria: makeCriteria(),
      lastPolledAt: minutesAgo(6),
    });
    await createAlert({
      user: { connect: { id: ADA.id } },
      criteria: { connect: { id: criteria.id } },
    });

    // The drain would poll and delete the job; a failing upstream releases it
    // with backoff instead, so the assertion sees what was enqueued.
    vi.mocked(searchAllSources).mockRejectedValue(new Error("upstream down"));
    await run();

    const jobs = await prisma.alertPollJob.findMany({ where: { criteriaId: criteria.id } });
    expect(jobs).toHaveLength(1);
  });

  it("ALERT-10: skips a criteria set polled more recently than the interval", async () => {
    const criteria = await createAlertCriteria({
      criteria: makeCriteria(),
      lastPolledAt: minutesAgo(2),
    });
    await createAlert({
      user: { connect: { id: ADA.id } },
      criteria: { connect: { id: criteria.id } },
    });

    await run();

    expect(await prisma.alertPollJob.count()).toBe(0);
    expect(searchAllSources).not.toHaveBeenCalled();
  });

  it("ALERT-10: enqueues a criteria set that has never been polled", async () => {
    const criteria = await createAlertCriteria({ criteria: makeCriteria(), lastPolledAt: null });
    await createAlert({
      user: { connect: { id: ADA.id } },
      criteria: { connect: { id: criteria.id } },
    });

    // The drain would poll and delete the job; a failing upstream releases it
    // with backoff instead, so the assertion sees what was enqueued.
    vi.mocked(searchAllSources).mockRejectedValue(new Error("upstream down"));
    await run();

    const jobs = await prisma.alertPollJob.findMany({ where: { criteriaId: criteria.id } });
    expect(jobs).toHaveLength(1);
  });

  it("ALERT-11: a criteria set with a pending job does not get a second", async () => {
    const criteria = await createAlertCriteria({
      criteria: makeCriteria(),
      lastPolledAt: minutesAgo(30),
    });
    await createAlert({
      user: { connect: { id: ADA.id } },
      criteria: { connect: { id: criteria.id } },
    });
    // Backing off, so this run enqueues but does not drain it: availableAt is
    // in the future relative to real SQL now(), so the claim query skips it.
    await prisma.alertPollJob.create({
      data: {
        criteriaId: criteria.id,
        status: "pending",
        availableAt: new Date(NOW.getTime() + 60_000),
      },
    });

    await run();

    const jobs = await prisma.alertPollJob.findMany({ where: { criteriaId: criteria.id } });
    expect(jobs).toHaveLength(1);
  });

  it("ALERT-41: a criteria set whose subscribers are all inactive is not enqueued", async () => {
    const criteria = await createAlertCriteria({
      criteria: makeCriteria(),
      lastPolledAt: minutesAgo(30),
    });
    await createAlert({
      user: { connect: { id: ADA.id } },
      criteria: { connect: { id: criteria.id } },
      active: false,
    });

    await run();

    expect(await prisma.alertPollJob.count()).toBe(0);
    expect(searchAllSources).not.toHaveBeenCalled();
  });

  it("ALERT-41: one active subscriber among several inactive keeps it polled", async () => {
    const criteria = await createAlertCriteria({
      criteria: makeCriteria(),
      lastPolledAt: minutesAgo(30),
    });
    await createAlert({
      user: { connect: { id: ADA.id } },
      criteria: { connect: { id: criteria.id } },
      active: false,
    });
    await createAlert({
      user: { connect: { id: GRACE.id } },
      criteria: { connect: { id: criteria.id } },
      active: true,
    });

    // The drain would poll and delete the job; a failing upstream releases it
    // with backoff instead, so the assertion sees what was enqueued.
    vi.mocked(searchAllSources).mockRejectedValue(new Error("upstream down"));
    await run();

    const jobs = await prisma.alertPollJob.findMany({ where: { criteriaId: criteria.id } });
    expect(jobs).toHaveLength(1);
  });

  // DATA-10 (docs/specs/core-data-model.md): `deletedAt` does not exist on
  // Alert yet, so the update below is expected to fail until DATA-8 adds it.
  it("DATA-10: a criteria set whose only alert is soft-deleted is not enqueued", async () => {
    const criteria = await createAlertCriteria({
      criteria: makeCriteria(),
      lastPolledAt: minutesAgo(30),
    });
    const alert = await createAlert({
      user: { connect: { id: ADA.id } },
      criteria: { connect: { id: criteria.id } },
    });
    await prisma.alert.update({ where: { id: alert.id }, data: { deletedAt: new Date() } });

    await run();

    expect(await prisma.alertPollJob.count()).toBe(0);
    expect(searchAllSources).not.toHaveBeenCalled();
  });
});

describe("cadence", () => {
  it("ALERT-35: polls at the five-minute base interval while under the ceiling", async () => {
    // 10 criteria x 3 sources / 300s = 0.1 req/s, far below 60/min.
    for (let n = 0; n < 10; n++) {
      const criteria = await createAlertCriteria({
        criteria: makeCriteria(),
        lastPolledAt: minutesAgo(6),
      });
      await createAlert({
        user: { connect: { id: ADA.id } },
        criteria: { connect: { id: criteria.id } },
      });
    }

    const body: RunSummaryBody = await (await run()).json();

    expect(body.intervalMs).toBe(5 * 60_000);
  });

  it("ALERT-36: stretches the interval once the ceiling would be crossed", async () => {
    // 200 criteria x 3 = 600 requests. At 60/min that needs 10 minutes, so the
    // interval has to stretch from 5 to 10 to stay inside the budget.
    for (let n = 0; n < 200; n++) {
      const criteria = await createAlertCriteria({
        criteria: makeCriteria(),
        lastPolledAt: minutesAgo(30),
      });
      await createAlert({
        user: { connect: { id: ADA.id } },
        criteria: { connect: { id: criteria.id } },
      });
    }

    const body: RunSummaryBody = await (await run()).json();

    expect(body.intervalMs).toBe(10 * 60_000);
  });

  it("ALERT-36: the stretched interval is the same for every criteria set", async () => {
    for (let n = 0; n < 200; n++) {
      const criteria = await createAlertCriteria({
        criteria: makeCriteria(),
        // Wildly different last-polled ages: none of them may be treated
        // preferentially, which is what rules out tiering by match rate.
        lastPolledAt: minutesAgo(11 + n),
      });
      await createAlert({
        user: { connect: { id: ADA.id } },
        criteria: { connect: { id: criteria.id } },
      });
    }

    // Left unmocked, the real searchAllSources mock would resolve and the 25
    // claimed jobs would be deleted, leaving fewer than 200 rows to count.
    // Rejecting releases the claim with backoff instead, so every enqueued
    // job is still there for the count below.
    vi.mocked(searchAllSources).mockRejectedValue(new Error("upstream down"));

    await run();

    // Every one of them is past the stretched 10-minute interval, so all are
    // enqueued in this lap rather than a favoured subset.
    expect(await prisma.alertPollJob.count()).toBe(200);
  });

  it("ALERT-37: reports the interval in force", async () => {
    for (let n = 0; n < 200; n++) {
      const criteria = await createAlertCriteria({
        criteria: makeCriteria(),
        lastPolledAt: minutesAgo(30),
      });
      await createAlert({
        user: { connect: { id: ADA.id } },
        criteria: { connect: { id: criteria.id } },
      });
    }

    const body: RunSummaryBody = await (await run()).json();

    expect(body.intervalMs).toBe(10 * 60_000);
    expect(body.criteriaCount).toBe(200);
  });

  it("ALERT-31: reports the age of the oldest un-polled criteria set", async () => {
    const stale = await createAlertCriteria({
      criteria: makeCriteria(),
      lastPolledAt: minutesAgo(17),
    });
    await createAlert({
      user: { connect: { id: ADA.id } },
      criteria: { connect: { id: stale.id } },
    });
    const fresh = await createAlertCriteria({
      criteria: makeCriteria(),
      lastPolledAt: minutesAgo(6),
    });
    await createAlert({
      user: { connect: { id: ADA.id } },
      criteria: { connect: { id: fresh.id } },
    });

    const body: RunSummaryBody = await (await run()).json();

    expect(body.oldestPendingAgeMs).toBe(17 * 60_000);
  });

  it("ALERT-31: reports zero when nothing is waiting", async () => {
    const criteria = await createAlertCriteria({
      criteria: makeCriteria(),
      lastPolledAt: minutesAgo(1),
    });
    await createAlert({
      user: { connect: { id: ADA.id } },
      criteria: { connect: { id: criteria.id } },
    });

    const body: RunSummaryBody = await (await run()).json();

    expect(body.oldestPendingAgeMs).toBe(0);
  });
});

describe("draining the queue", () => {
  it("ALERT-12: processes at most the configured slice and leaves the rest queued", async () => {
    for (let n = 0; n < 30; n++) {
      const criteria = await createAlertCriteria({
        criteria: makeCriteria(),
        lastPolledAt: minutesAgo(30),
      });
      await createAlert({
        user: { connect: { id: ADA.id } },
        criteria: { connect: { id: criteria.id } },
      });
      await prisma.alertPollJob.create({
        data: { criteriaId: criteria.id, status: "pending", enqueuedAt: minutesAgo(30 - n) },
      });
    }

    const body: RunSummaryBody = await (await run()).json();

    expect(body.claimed).toBe(25);
    expect(searchAllSources).toHaveBeenCalledTimes(25);
    expect(await pendingJobs()).toHaveLength(5);
  });

  it("ALERT-12: stops at the time budget and releases the claims it did not use", async () => {
    for (let n = 0; n < 20; n++) {
      const criteria = await createAlertCriteria({
        criteria: makeCriteria(),
        lastPolledAt: minutesAgo(30),
      });
      await createAlert({
        user: { connect: { id: ADA.id } },
        criteria: { connect: { id: criteria.id } },
      });
      await prisma.alertPollJob.create({
        data: { criteriaId: criteria.id, status: "pending", enqueuedAt: minutesAgo(30 - n) },
      });
    }
    // Each poll burns 10s of the 45s budget. Elapsed is checked before each
    // poll starts, so polls run at 0s, 10s, 20s, 30s and 40s — five — and the
    // sixth is the first to find 50s spent. That leaves 15 claims to release.
    // The advance only moves the frozen JS clock the budget check reads; the
    // one SQL now() call already ran, at the top of drainQueue, before it.
    vi.mocked(searchAllSources).mockImplementation(async () => {
      vi.advanceTimersByTime(10_000);
      return { listings: [], failedSources: [], perSourceCounts: {} };
    });

    await run();

    expect(searchAllSources).toHaveBeenCalledTimes(5);
    // Released, not stranded in `running` — otherwise they would sit unclaimable
    // until their lease went stale.
    expect(await pendingJobs()).toHaveLength(15);
    expect(await runningJobs()).toEqual([]);
  });
});

describe("discovery", () => {
  it("ALERT-15: an unseen listing becomes a match for the subscriber", async () => {
    const { criteria, alert } = await seedSubscribedCriteria();
    sourcesReturn(makeMatchListing({ id: "wallapop-new1" }));

    await run();

    const matches = await matchesFor(alert.id);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      listingId: "wallapop-new1",
      title: "Audi A3 2.0 TDI",
      price: 14500,
      url: "https://es.wallapop.com/item/audi-a3-abc123",
    });
    expect((await seenFor(criteria.id)).map((row) => row.listingId)).toEqual(["wallapop-new1"]);
  });

  it("ALERT-15: every active subscriber to the criteria gets their own match", async () => {
    const criteria = await createAlertCriteria({ criteria: makeCriteria() });
    const adas = await createAlert({
      user: { connect: { id: ADA.id } },
      criteria: { connect: { id: criteria.id } },
    });
    const graces = await createAlert({
      user: { connect: { id: GRACE.id } },
      criteria: { connect: { id: criteria.id } },
    });
    await prisma.alertPollJob.create({ data: { criteriaId: criteria.id, status: "pending" } });
    sourcesReturn(makeMatchListing({ id: "wallapop-new1" }));

    await run();

    // One upstream poll, fanned out in the database — the scaling property.
    expect(searchAllSources).toHaveBeenCalledTimes(1);
    expect(await matchesFor(adas.id)).toHaveLength(1);
    expect(await matchesFor(graces.id)).toHaveLength(1);
  });

  it("ALERT-15: an inactive subscriber gets no match", async () => {
    const criteria = await createAlertCriteria({ criteria: makeCriteria() });
    await createAlert({
      user: { connect: { id: ADA.id } },
      criteria: { connect: { id: criteria.id } },
      active: true,
    });
    const dormant = await createAlert({
      user: { connect: { id: GRACE.id } },
      criteria: { connect: { id: criteria.id } },
      active: false,
    });
    await prisma.alertPollJob.create({ data: { criteriaId: criteria.id, status: "pending" } });
    sourcesReturn(makeMatchListing({ id: "wallapop-new1" }));

    await run();

    expect(await matchesFor(dormant.id)).toEqual([]);
  });

  it("ALERT-16: a listing already in the seen-list produces no match", async () => {
    const { criteria, alert } = await seedSubscribedCriteria();
    await prisma.alertSeenListing.create({
      data: { criteriaId: criteria.id, listingId: "wallapop-abc123", source: "Wallapop" },
    });
    sourcesReturn(makeMatchListing({ id: "wallapop-abc123" }));

    await run();

    expect(await matchesFor(alert.id)).toEqual([]);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("ALERT-16: staying listed across laps never re-notifies", async () => {
    const { criteria, alert } = await seedSubscribedCriteria();
    sourcesReturn(makeMatchListing({ id: "wallapop-abc123" }));
    await run();

    // Second lap, same listing still on the site.
    await prisma.alertPollJob.create({ data: { criteriaId: criteria.id, status: "pending" } });
    vi.mocked(sendEmail).mockClear();
    await run();

    expect(await matchesFor(alert.id)).toHaveLength(1);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("ALERT-17: a failing source does not stop the others producing matches", async () => {
    const { criteria, alert } = await seedSubscribedCriteria();
    vi.mocked(searchAllSources).mockResolvedValue({
      listings: [makeMatchListing({ id: "cochesnet-77", source: "Coches.net" })],
      failedSources: ["Wallapop"],
      perSourceCounts: { "Coches.net": 1, Milanuncios: 0 },
    });

    await run();

    expect((await matchesFor(alert.id)).map((row) => row.listingId)).toEqual(["cochesnet-77"]);
    expect((await seenFor(criteria.id)).map((row) => row.source)).toEqual(["Coches.net"]);
  });

  it("ALERT-17: nothing from the failed source is recorded as seen", async () => {
    const { criteria } = await seedSubscribedCriteria();
    vi.mocked(searchAllSources).mockResolvedValue({
      listings: [makeMatchListing({ id: "cochesnet-77", source: "Coches.net" })],
      failedSources: ["Wallapop"],
      perSourceCounts: { "Coches.net": 1, Milanuncios: 0 },
    });

    await run();

    // If Wallapop were marked polled, cars listed there during the outage would
    // never be new again — the alert would silently skip them forever.
    expect((await seenFor(criteria.id)).some((row) => row.source === "Wallapop")).toBe(false);
  });

  it("ALERT-18: when every source fails nothing is recorded as seen", async () => {
    const { criteria } = await seedSubscribedCriteria();
    vi.mocked(searchAllSources).mockRejectedValue(new Error("all down"));

    await run();

    expect(await seenFor(criteria.id)).toEqual([]);
    expect(await prisma.alertMatch.count()).toBe(0);
  });

  it("ALERT-18: a failed job is retried with backoff rather than immediately", async () => {
    const { job } = await seedSubscribedCriteria();
    vi.mocked(searchAllSources).mockRejectedValue(new Error("all down"));

    await run();

    const found = await prisma.alertPollJob.findUnique({ where: { id: job.id } });
    expect(found?.status).toBe("pending");
    expect(found?.attempts).toBe(1);
    // Backoff is deliberately longer than the poll interval: a failing upstream
    // should be polled less, not more.
    expect(found?.availableAt.getTime()).toBe(NOW.getTime() + 5 * 60_000);
  });

  it("ALERT-19: a job that exhausts its retries is marked failed", async () => {
    const criteria = await createAlertCriteria({ criteria: makeCriteria() });
    await createAlert({
      user: { connect: { id: ADA.id } },
      criteria: { connect: { id: criteria.id } },
    });
    const job = await prisma.alertPollJob.create({
      data: { criteriaId: criteria.id, status: "pending", attempts: 2 },
    });
    vi.mocked(searchAllSources).mockRejectedValue(new Error("all down"));

    await run();

    const found = await prisma.alertPollJob.findUnique({ where: { id: job.id } });
    expect(found?.status).toBe("failed");
    expect(found?.attempts).toBe(3);
    expect(found?.lastError).toContain("all down");
  });

  it("ALERT-19: a failed job does not block the rest of the queue", async () => {
    const broken = await createAlertCriteria({ criteria: makeCriteria() });
    await createAlert({
      user: { connect: { id: ADA.id } },
      criteria: { connect: { id: broken.id } },
    });
    await prisma.alertPollJob.create({
      data: {
        criteriaId: broken.id,
        status: "failed",
        attempts: 3,
        enqueuedAt: minutesAgo(60),
      },
    });
    const { alert } = await seedSubscribedCriteria();
    sourcesReturn(makeMatchListing({ id: "wallapop-new1" }));

    await run();

    expect(await matchesFor(alert.id)).toHaveLength(1);
  });

  it("ALERT-20: a source that returns nothing having returned before is marked unhealthy", async () => {
    await seedSubscribedCriteria();
    vi.mocked(searchAllSources).mockResolvedValue({
      listings: [],
      failedSources: [],
      perSourceCounts: { Wallapop: 4, "Coches.net": 2, Milanuncios: 0 },
    });

    await run();

    const milanuncios = await prisma.sourceHealth.findUnique({ where: { source: "Milanuncios" } });
    // Milanuncios returns zero ads on a parse failure rather than erroring, so
    // "quietly broken" and "nothing new" look identical without this.
    expect(milanuncios?.consecutiveEmptyRuns).toBe(1);
    const wallapop = await prisma.sourceHealth.findUnique({ where: { source: "Wallapop" } });
    expect(wallapop?.consecutiveEmptyRuns).toBe(0);
    expect(wallapop?.lastOkAt).toEqual(NOW);
  });

  it("ALERT-20: a source empty for three runs is reported as unhealthy by the run", async () => {
    await prisma.sourceHealth.upsert({
      where: { source: "Milanuncios" },
      create: { source: "Milanuncios", lastOkAt: null, consecutiveEmptyRuns: 2 },
      update: {},
    });
    await seedSubscribedCriteria();
    vi.mocked(searchAllSources).mockResolvedValue({
      listings: [],
      failedSources: [],
      perSourceCounts: { Wallapop: 4, "Coches.net": 2, Milanuncios: 0 },
    });

    const body: RunSummaryBody = await (await run()).json();

    // In the response, not just the table: nobody goes looking for a source
    // that has quietly stopped parsing.
    expect(body.unhealthySources).toEqual(["Milanuncios"]);
  });

  it("ALERT-20: a source that starts returning results again is reset to healthy", async () => {
    await prisma.sourceHealth.upsert({
      where: { source: "Milanuncios" },
      create: { source: "Milanuncios", lastOkAt: null, consecutiveEmptyRuns: 3 },
      update: {},
    });
    await seedSubscribedCriteria();
    vi.mocked(searchAllSources).mockResolvedValue({
      listings: [makeMatchListing({ id: "milanuncios-5" })],
      failedSources: [],
      perSourceCounts: { Wallapop: 1, "Coches.net": 1, Milanuncios: 2 },
    });

    await run();

    const milanuncios = await prisma.sourceHealth.findUnique({ where: { source: "Milanuncios" } });
    expect(milanuncios?.consecutiveEmptyRuns).toBe(0);
  });
});

describe("delivery", () => {
  it("ALERT-21: several matches for one user produce a single email", async () => {
    const { alert } = await seedSubscribedCriteria();
    sourcesReturn(
      makeMatchListing({ id: "wallapop-new1", title: "Audi A3 Sportback" }),
      makeMatchListing({ id: "wallapop-new2", title: "Audi A3 Cabrio" }),
      makeMatchListing({ id: "wallapop-new3", title: "Audi A3 Sedan" }),
    );

    await run();

    expect(await matchesFor(alert.id)).toHaveLength(3);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    // All three have to be in the one mail, or two of them are lost.
    const [{ html }] = vi.mocked(sendEmail).mock.calls[0];
    expect(html).toContain("Audi A3 Sportback");
    expect(html).toContain("Audi A3 Cabrio");
    expect(html).toContain("Audi A3 Sedan");
  });

  it("ALERT-21: two subscribers get one email each, not one between them", async () => {
    const criteria = await createAlertCriteria({ criteria: makeCriteria() });
    await createAlert({
      user: { connect: { id: ADA.id } },
      criteria: { connect: { id: criteria.id } },
    });
    await createAlert({
      user: { connect: { id: GRACE.id } },
      criteria: { connect: { id: criteria.id } },
    });
    await prisma.alertPollJob.create({ data: { criteriaId: criteria.id, status: "pending" } });
    sourcesReturn(makeMatchListing({ id: "wallapop-new1" }));

    await run();

    expect(sendEmail).toHaveBeenCalledTimes(2);
    const recipients = vi
      .mocked(sendEmail)
      .mock.calls.map(([input]) => input.to)
      .sort();
    expect(recipients).toEqual([ADA.email, GRACE.email]);
  });

  it("ALERT-23: a match already notified is not emailed again", async () => {
    const { criteria, alert } = await seedSubscribedCriteria();
    const match = makeMatchListing({ id: "wallapop-old1" });
    const { id: _id, ...snapshot } = match;
    await prisma.alertMatch.create({
      data: {
        alert: { connect: { id: alert.id } },
        listingId: "wallapop-old1",
        ...snapshot,
        notifiedAt: minutesAgo(60),
      },
    });
    await prisma.alertSeenListing.create({
      data: { criteriaId: criteria.id, listingId: "wallapop-old1", source: "Wallapop" },
    });
    sourcesReturn(makeMatchListing({ id: "wallapop-old1" }));

    await run();

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("ALERT-23: a successful send stamps the match so a later run skips it", async () => {
    const { alert } = await seedSubscribedCriteria();
    sourcesReturn(makeMatchListing({ id: "wallapop-new1" }));

    await run();

    const [match] = await matchesFor(alert.id);
    expect(match.notifiedAt).toEqual(NOW);
  });

  it("ALERT-24: a failed send leaves the match pending for the next run", async () => {
    const { alert } = await seedSubscribedCriteria();
    sourcesReturn(makeMatchListing({ id: "wallapop-new1" }));
    vi.mocked(sendEmail).mockResolvedValue(false);

    await run();

    // sendEmail never throws, so a provider outage would otherwise leave the
    // listing marked seen with nobody told — and it is never new again.
    const [match] = await matchesFor(alert.id);
    expect(match.notifiedAt).toBeNull();
  });

  it("ALERT-24: the next run retries the un-notified match", async () => {
    const { criteria, alert } = await seedSubscribedCriteria();
    sourcesReturn(makeMatchListing({ id: "wallapop-new1" }));
    vi.mocked(sendEmail).mockResolvedValue(false);
    await run();

    vi.mocked(sendEmail).mockResolvedValue(true);
    await prisma.alertPollJob.create({ data: { criteriaId: criteria.id, status: "pending" } });
    await run();

    const [match] = await matchesFor(alert.id);
    expect(match.notifiedAt).toEqual(NOW);
  });

  it("ALERT-25: with email unconfigured the matches are still recorded", async () => {
    emailConfigured = false;
    const { alert } = await seedSubscribedCriteria();
    sourcesReturn(makeMatchListing({ id: "wallapop-new1" }));

    await run();

    const matches = await matchesFor(alert.id);
    expect(matches).toHaveLength(1);
    expect(matches[0].notifiedAt).toBeNull();
  });

  it("ALERT-25: the run says nothing was sent rather than reporting success", async () => {
    emailConfigured = false;
    await seedSubscribedCriteria();
    sourcesReturn(makeMatchListing({ id: "wallapop-new1" }));

    const body: RunSummaryBody = await (await run()).json();

    expect(body.emailed).toBe(0);
    expect(body.skippedNoEmail).toBe(1);
  });

  it("ALERT-32: writes the email in the locale stored on the user", async () => {
    const criteria = await createAlertCriteria({ criteria: makeCriteria() });
    await createAlert({
      user: { connect: { id: GRACE.id } },
      criteria: { connect: { id: criteria.id } },
    });
    await prisma.alertPollJob.create({ data: { criteriaId: criteria.id, status: "pending" } });
    sourcesReturn(makeMatchListing({ id: "wallapop-new1" }));

    await run();

    // Grace's account says `es`. There is no request to read a cookie or
    // accept-language from, so the stored locale is the only signal.
    const [{ subject }] = vi.mocked(sendEmail).mock.calls[0];
    expect(subject).toMatch(/coche|nuevo/i);
  });

  it("ALERT-32: falls back to the default locale when the account stores none", async () => {
    const oldUser = await createUser({ email: "old@example.com", locale: null });
    const criteria = await createAlertCriteria({ criteria: makeCriteria() });
    await createAlert({
      user: { connect: { id: oldUser.id } },
      criteria: { connect: { id: criteria.id } },
    });
    await prisma.alertPollJob.create({ data: { criteriaId: criteria.id, status: "pending" } });
    sourcesReturn(makeMatchListing({ id: "wallapop-new1" }));

    await run();

    // An alert in the wrong language beats no alert at all.
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [{ subject }] = vi.mocked(sendEmail).mock.calls[0];
    expect(subject).toMatch(/coche|nuevo/i);
  });
});
