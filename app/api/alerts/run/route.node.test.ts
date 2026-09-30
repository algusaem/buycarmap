import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createAlertStore, makeCriteria, makeMatchListing } from "@/test/fixtures/alerts";
import type { RunSummary } from "@/interfaces/alert";

let store: ReturnType<typeof createAlertStore>;
let emailConfigured = true;

vi.mock("@/lib/db/prisma", () => ({
  get prisma() {
    return store.client;
  },
}));

vi.mock("@/lib/env", () => ({
  // NEXTAUTH_SECRET keys the unsubscribe-token HMAC, so the runner cannot build
  // a link without it.
  env: { ALERTS_CRON_SECRET: "cron-secret", NEXTAUTH_SECRET: "test-secret" },
}));

vi.mock("@/lib/app-config", () => ({
  get isEmailConfigured() {
    return emailConfigured;
  },
  appUrl: "https://buycarmap.test",
}));

vi.mock("@/lib/email/client", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/server/alerts/search", () => ({ searchAllSources: vi.fn() }));

import { sendEmail } from "@/lib/email/client";
import { searchAllSources } from "@/server/alerts/search";
import { POST } from "./route";

const NOW = new Date("2026-08-03T10:00:00.000Z");
const ADA = { id: "user-ada", email: "ada@example.com" };
const GRACE = { id: "user-grace", email: "grace@example.com" };

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

/** Minutes before now, for lastPolledAt / enqueuedAt. */
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

/** One subscribed criteria set with a pending job, ready to be drained. */
function seedSubscribedCriteria(options: { userId?: string; lastPolledMinutesAgo?: number } = {}) {
  const criteria = store.seedCriteria({
    criteria: makeCriteria(),
    lastPolledAt:
      options.lastPolledMinutesAgo === undefined ? null : minutesAgo(options.lastPolledMinutesAgo),
  });
  const alert = store.seedAlert({
    userId: options.userId ?? ADA.id,
    criteriaId: criteria.id,
  });
  const job = store.seedJob({ criteriaId: criteria.id });
  return { criteria, alert, job };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  emailConfigured = true;
  store = createAlertStore();
  store.seedUser({ id: ADA.id, email: ADA.email, locale: "en" });
  store.seedUser({ id: GRACE.id, email: GRACE.email, locale: "es" });
  vi.mocked(sendEmail).mockClear().mockResolvedValue(true);
  // History as well as the resolved value: several criteria assert how many
  // polls a run made, or that it made none.
  vi.mocked(searchAllSources).mockClear();
  sourcesReturn();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("authorisation", () => {
  it("ALERT-9: refuses a request with no shared secret and does no work", async () => {
    seedSubscribedCriteria();

    const response = await run(null);

    expect(response.status).toBe(401);
    expect(searchAllSources).not.toHaveBeenCalled();
    // The job is untouched, so a probe cannot drain the queue.
    expect(store.jobs()[0].status).toBe("pending");
  });

  it("ALERT-9: refuses a request with the wrong secret", async () => {
    seedSubscribedCriteria();

    const response = await run("not-the-secret");

    expect(response.status).toBe(401);
    expect(searchAllSources).not.toHaveBeenCalled();
  });

  it("ALERT-9: accepts the correct secret", async () => {
    seedSubscribedCriteria();

    expect((await run()).status).toBe(200);
  });
});

describe("enqueueing", () => {
  it("ALERT-10: enqueues a criteria set polled longer ago than the interval", async () => {
    const criteria = store.seedCriteria({ lastPolledAt: minutesAgo(6) });
    store.seedAlert({ userId: ADA.id, criteriaId: criteria.id });

    await run();

    expect(store.jobs().map((job) => job.criteriaId)).toContain(criteria.id);
  });

  it("ALERT-10: skips a criteria set polled more recently than the interval", async () => {
    const criteria = store.seedCriteria({ lastPolledAt: minutesAgo(2) });
    store.seedAlert({ userId: ADA.id, criteriaId: criteria.id });

    await run();

    expect(store.jobs()).toEqual([]);
    expect(searchAllSources).not.toHaveBeenCalled();
  });

  it("ALERT-10: enqueues a criteria set that has never been polled", async () => {
    const criteria = store.seedCriteria({ lastPolledAt: null });
    store.seedAlert({ userId: ADA.id, criteriaId: criteria.id });

    await run();

    expect(store.jobs().map((job) => job.criteriaId)).toContain(criteria.id);
  });

  it("ALERT-11: a criteria set with a pending job does not get a second", async () => {
    const criteria = store.seedCriteria({ lastPolledAt: minutesAgo(30) });
    store.seedAlert({ userId: ADA.id, criteriaId: criteria.id });
    // Backing off, so this run enqueues but does not drain it. Without that the
    // job is legitimately consumed and "one job" cannot be told apart from
    // "two jobs, both processed".
    store.seedJob({
      criteriaId: criteria.id,
      status: "pending",
      availableAt: new Date(NOW.getTime() + 60_000),
    });

    await run();

    expect(store.jobs().filter((job) => job.criteriaId === criteria.id)).toHaveLength(1);
  });

  it("ALERT-41: a criteria set whose subscribers are all inactive is not enqueued", async () => {
    const criteria = store.seedCriteria({ lastPolledAt: minutesAgo(30) });
    store.seedAlert({
      userId: ADA.id,
      criteriaId: criteria.id,
      active: false,
    });

    await run();

    expect(store.jobs()).toEqual([]);
    expect(searchAllSources).not.toHaveBeenCalled();
  });

  it("ALERT-41: one active subscriber among several inactive keeps it polled", async () => {
    const criteria = store.seedCriteria({ lastPolledAt: minutesAgo(30) });
    store.seedAlert({ userId: ADA.id, criteriaId: criteria.id, active: false });
    store.seedAlert({ userId: GRACE.id, criteriaId: criteria.id, active: true });

    await run();

    expect(store.jobs().map((job) => job.criteriaId)).toEqual([criteria.id]);
  });
});

describe("cadence", () => {
  it("ALERT-35: polls at the five-minute base interval while under the ceiling", async () => {
    // 10 criteria x 3 sources / 300s = 0.1 req/s, far below 60/min.
    for (let n = 0; n < 10; n++) {
      const criteria = store.seedCriteria({ lastPolledAt: minutesAgo(6) });
      store.seedAlert({ userId: ADA.id, criteriaId: criteria.id });
    }

    const body: RunSummaryBody = await (await run()).json();

    expect(body.intervalMs).toBe(5 * 60_000);
  });

  it("ALERT-36: stretches the interval once the ceiling would be crossed", async () => {
    // 200 criteria x 3 = 600 requests. At 60/min that needs 10 minutes, so the
    // interval has to stretch from 5 to 10 to stay inside the budget.
    for (let n = 0; n < 200; n++) {
      const criteria = store.seedCriteria({ lastPolledAt: minutesAgo(30) });
      store.seedAlert({ userId: ADA.id, criteriaId: criteria.id });
    }

    const body: RunSummaryBody = await (await run()).json();

    expect(body.intervalMs).toBe(10 * 60_000);
  });

  it("ALERT-36: the stretched interval is the same for every criteria set", async () => {
    for (let n = 0; n < 200; n++) {
      const criteria = store.seedCriteria({
        // Wildly different last-polled ages: none of them may be treated
        // preferentially, which is what rules out tiering by match rate.
        lastPolledAt: minutesAgo(11 + n),
      });
      store.seedAlert({ userId: ADA.id, criteriaId: criteria.id });
    }

    await run();

    // Every one of them is past the stretched 10-minute interval, so all are
    // enqueued in this lap rather than a favoured subset.
    expect(store.jobs()).toHaveLength(200);
  });

  it("ALERT-37: reports the interval in force", async () => {
    for (let n = 0; n < 200; n++) {
      const criteria = store.seedCriteria({ lastPolledAt: minutesAgo(30) });
      store.seedAlert({ userId: ADA.id, criteriaId: criteria.id });
    }

    const body: RunSummaryBody = await (await run()).json();

    // Degradation has to be a number someone can watch, not something inferred
    // from users complaining their alerts are slow.
    expect(body.intervalMs).toBe(10 * 60_000);
    expect(body.criteriaCount).toBe(200);
  });

  it("ALERT-31: reports the age of the oldest un-polled criteria set", async () => {
    const stale = store.seedCriteria({ lastPolledAt: minutesAgo(17) });
    store.seedAlert({ userId: ADA.id, criteriaId: stale.id });
    const fresh = store.seedCriteria({ lastPolledAt: minutesAgo(6) });
    store.seedAlert({ userId: ADA.id, criteriaId: fresh.id });

    const body: RunSummaryBody = await (await run()).json();

    expect(body.oldestPendingAgeMs).toBe(17 * 60_000);
  });

  it("ALERT-31: reports zero when nothing is waiting", async () => {
    const criteria = store.seedCriteria({ lastPolledAt: minutesAgo(1) });
    store.seedAlert({ userId: ADA.id, criteriaId: criteria.id });

    const body: RunSummaryBody = await (await run()).json();

    expect(body.oldestPendingAgeMs).toBe(0);
  });
});

describe("draining the queue", () => {
  it("ALERT-12: processes at most the configured slice and leaves the rest queued", async () => {
    for (let n = 0; n < 30; n++) {
      const criteria = store.seedCriteria({ lastPolledAt: minutesAgo(30) });
      store.seedAlert({ userId: ADA.id, criteriaId: criteria.id });
      store.seedJob({
        criteriaId: criteria.id,
        enqueuedAt: minutesAgo(30 - n),
      });
    }

    const body: RunSummaryBody = await (await run()).json();

    expect(body.claimed).toBe(25);
    expect(searchAllSources).toHaveBeenCalledTimes(25);
    expect(store.jobs().filter((job) => job.status === "pending")).toHaveLength(5);
  });

  it("ALERT-12: stops at the time budget and releases the claims it did not use", async () => {
    for (let n = 0; n < 20; n++) {
      const criteria = store.seedCriteria({ lastPolledAt: minutesAgo(30) });
      store.seedAlert({ userId: ADA.id, criteriaId: criteria.id });
      store.seedJob({ criteriaId: criteria.id, enqueuedAt: minutesAgo(30 - n) });
    }
    // Each poll burns 10s of the 45s budget. Elapsed is checked before each
    // poll starts, so polls run at 0s, 10s, 20s, 30s and 40s — five — and the
    // sixth is the first to find 50s spent. That leaves 15 claims to release.
    vi.mocked(searchAllSources).mockImplementation(async () => {
      vi.advanceTimersByTime(10_000);
      return { listings: [], failedSources: [], perSourceCounts: {} };
    });

    await run();

    expect(searchAllSources).toHaveBeenCalledTimes(5);
    // Released, not stranded in `running` — otherwise they would sit unclaimable
    // until their lease went stale.
    expect(store.jobs().filter((job) => job.status === "pending")).toHaveLength(15);
    expect(store.jobs().filter((job) => job.status === "running")).toEqual([]);
  });
});

describe("discovery", () => {
  it("ALERT-15: an unseen listing becomes a match for the subscriber", async () => {
    const { criteria, alert } = seedSubscribedCriteria();
    sourcesReturn(makeMatchListing({ id: "wallapop-new1" }));

    await run();

    const matches = store.matchesFor(alert.id);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      listingId: "wallapop-new1",
      title: "Audi A3 2.0 TDI",
      price: 14500,
      url: "https://es.wallapop.com/item/audi-a3-abc123",
    });
    expect(store.seenFor(criteria.id).map((row) => row.listingId)).toEqual(["wallapop-new1"]);
  });

  it("ALERT-15: every active subscriber to the criteria gets their own match", async () => {
    const criteria = store.seedCriteria({ criteria: makeCriteria() });
    const adas = store.seedAlert({ userId: ADA.id, criteriaId: criteria.id });
    const graces = store.seedAlert({
      userId: GRACE.id,
      criteriaId: criteria.id,
    });
    store.seedJob({ criteriaId: criteria.id });
    sourcesReturn(makeMatchListing({ id: "wallapop-new1" }));

    await run();

    // One upstream poll, fanned out in the database — the scaling property.
    expect(searchAllSources).toHaveBeenCalledTimes(1);
    expect(store.matchesFor(adas.id)).toHaveLength(1);
    expect(store.matchesFor(graces.id)).toHaveLength(1);
  });

  it("ALERT-15: an inactive subscriber gets no match", async () => {
    const criteria = store.seedCriteria({ criteria: makeCriteria() });
    store.seedAlert({ userId: ADA.id, criteriaId: criteria.id, active: true });
    const dormant = store.seedAlert({
      userId: GRACE.id,
      criteriaId: criteria.id,
      active: false,
    });
    store.seedJob({ criteriaId: criteria.id });
    sourcesReturn(makeMatchListing({ id: "wallapop-new1" }));

    await run();

    expect(store.matchesFor(dormant.id)).toEqual([]);
  });

  it("ALERT-16: a listing already in the seen-list produces no match", async () => {
    const { criteria, alert } = seedSubscribedCriteria();
    store.seedSeen(criteria.id, "wallapop-abc123");
    sourcesReturn(makeMatchListing({ id: "wallapop-abc123" }));

    await run();

    expect(store.matchesFor(alert.id)).toEqual([]);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("ALERT-16: staying listed across laps never re-notifies", async () => {
    const { alert } = seedSubscribedCriteria();
    sourcesReturn(makeMatchListing({ id: "wallapop-abc123" }));
    await run();

    // Second lap, same listing still on the site.
    store.seedJob({ criteriaId: store.criteria()[0].id });
    vi.mocked(sendEmail).mockClear();
    await run();

    expect(store.matchesFor(alert.id)).toHaveLength(1);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("ALERT-17: a failing source does not stop the others producing matches", async () => {
    const { criteria, alert } = seedSubscribedCriteria();
    vi.mocked(searchAllSources).mockResolvedValue({
      listings: [makeMatchListing({ id: "cochesnet-77", source: "Coches.net" })],
      failedSources: ["Wallapop"],
      perSourceCounts: { "Coches.net": 1, Milanuncios: 0 },
    });

    await run();

    expect(store.matchesFor(alert.id).map((row) => row.listingId)).toEqual(["cochesnet-77"]);
    expect(store.seenFor(criteria.id).map((row) => row.source)).toEqual(["Coches.net"]);
  });

  it("ALERT-17: nothing from the failed source is recorded as seen", async () => {
    const { criteria } = seedSubscribedCriteria();
    vi.mocked(searchAllSources).mockResolvedValue({
      listings: [makeMatchListing({ id: "cochesnet-77", source: "Coches.net" })],
      failedSources: ["Wallapop"],
      perSourceCounts: { "Coches.net": 1, Milanuncios: 0 },
    });

    await run();

    // If Wallapop were marked polled, cars listed there during the outage would
    // never be new again — the alert would silently skip them forever.
    expect(store.seenFor(criteria.id).some((row) => row.source === "Wallapop")).toBe(false);
  });

  it("ALERT-18: when every source fails nothing is recorded as seen", async () => {
    const { criteria } = seedSubscribedCriteria();
    vi.mocked(searchAllSources).mockRejectedValue(new Error("all down"));

    await run();

    expect(store.seenFor(criteria.id)).toEqual([]);
    expect(store.matches()).toEqual([]);
  });

  it("ALERT-18: a failed job is retried with backoff rather than immediately", async () => {
    seedSubscribedCriteria();
    vi.mocked(searchAllSources).mockRejectedValue(new Error("all down"));

    await run();

    const [job] = store.jobs();
    expect(job.status).toBe("pending");
    expect(job.attempts).toBe(1);
    // Backoff is deliberately longer than the poll interval: a failing upstream
    // should be polled less, not more.
    expect(job.availableAt.getTime()).toBe(NOW.getTime() + 5 * 60_000);
  });

  it("ALERT-19: a job that exhausts its retries is marked failed", async () => {
    const criteria = store.seedCriteria({ criteria: makeCriteria() });
    store.seedAlert({ userId: ADA.id, criteriaId: criteria.id });
    store.seedJob({ criteriaId: criteria.id, attempts: 2 });
    vi.mocked(searchAllSources).mockRejectedValue(new Error("all down"));

    await run();

    const [job] = store.jobs();
    expect(job.status).toBe("failed");
    expect(job.attempts).toBe(3);
    expect(job.lastError).toContain("all down");
  });

  it("ALERT-19: a failed job does not block the rest of the queue", async () => {
    const broken = store.seedCriteria({ criteria: makeCriteria() });
    store.seedAlert({ userId: ADA.id, criteriaId: broken.id });
    store.seedJob({
      criteriaId: broken.id,
      status: "failed",
      attempts: 3,
      enqueuedAt: minutesAgo(60),
    });
    const { alert } = seedSubscribedCriteria();
    sourcesReturn(makeMatchListing({ id: "wallapop-new1" }));

    await run();

    expect(store.matchesFor(alert.id)).toHaveLength(1);
  });

  it("ALERT-20: a source that returns nothing having returned before is marked unhealthy", async () => {
    seedSubscribedCriteria();
    vi.mocked(searchAllSources).mockResolvedValue({
      listings: [],
      failedSources: [],
      perSourceCounts: { Wallapop: 4, "Coches.net": 2, Milanuncios: 0 },
    });

    await run();

    const milanuncios = store.health().find((row) => row.source === "Milanuncios");
    // Milanuncios returns zero ads on a parse failure rather than erroring, so
    // "quietly broken" and "nothing new" look identical without this.
    expect(milanuncios?.consecutiveEmptyRuns).toBe(1);
    const wallapop = store.health().find((row) => row.source === "Wallapop");
    expect(wallapop?.consecutiveEmptyRuns).toBe(0);
    expect(wallapop?.lastOkAt).toEqual(NOW);
  });

  it("ALERT-20: a source empty for three runs is reported as unhealthy by the run", async () => {
    store.client.sourceHealth.upsert({
      where: { source: "Milanuncios" },
      create: {
        source: "Milanuncios",
        lastOkAt: null,
        consecutiveEmptyRuns: 2,
      },
      update: {},
    });
    seedSubscribedCriteria();
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
    store.client.sourceHealth.upsert({
      where: { source: "Milanuncios" },
      create: {
        source: "Milanuncios",
        lastOkAt: null,
        consecutiveEmptyRuns: 3,
      },
      update: {},
    });
    seedSubscribedCriteria();
    vi.mocked(searchAllSources).mockResolvedValue({
      listings: [makeMatchListing({ id: "milanuncios-5" })],
      failedSources: [],
      perSourceCounts: { Wallapop: 1, "Coches.net": 1, Milanuncios: 2 },
    });

    await run();

    expect(store.health().find((row) => row.source === "Milanuncios")?.consecutiveEmptyRuns).toBe(
      0,
    );
  });
});

describe("delivery", () => {
  it("ALERT-21: several matches for one user produce a single email", async () => {
    const { alert } = seedSubscribedCriteria();
    sourcesReturn(
      makeMatchListing({ id: "wallapop-new1", title: "Audi A3 Sportback" }),
      makeMatchListing({ id: "wallapop-new2", title: "Audi A3 Cabrio" }),
      makeMatchListing({ id: "wallapop-new3", title: "Audi A3 Sedan" }),
    );

    await run();

    expect(store.matchesFor(alert.id)).toHaveLength(3);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    // All three have to be in the one mail, or two of them are lost.
    const [{ html }] = vi.mocked(sendEmail).mock.calls[0];
    expect(html).toContain("Audi A3 Sportback");
    expect(html).toContain("Audi A3 Cabrio");
    expect(html).toContain("Audi A3 Sedan");
  });

  it("ALERT-21: two subscribers get one email each, not one between them", async () => {
    const criteria = store.seedCriteria({ criteria: makeCriteria() });
    store.seedAlert({ userId: ADA.id, criteriaId: criteria.id });
    store.seedAlert({ userId: GRACE.id, criteriaId: criteria.id });
    store.seedJob({ criteriaId: criteria.id });
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
    const { criteria, alert } = seedSubscribedCriteria();
    store.seedMatch({
      alertId: alert.id,
      listingId: "wallapop-old1",
      notifiedAt: minutesAgo(60),
    });
    store.seedSeen(criteria.id, "wallapop-old1");
    sourcesReturn(makeMatchListing({ id: "wallapop-old1" }));

    await run();

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("ALERT-23: a successful send stamps the match so a later run skips it", async () => {
    const { alert } = seedSubscribedCriteria();
    sourcesReturn(makeMatchListing({ id: "wallapop-new1" }));

    await run();

    expect(store.matchesFor(alert.id)[0].notifiedAt).toEqual(NOW);
  });

  it("ALERT-24: a failed send leaves the match pending for the next run", async () => {
    const { alert } = seedSubscribedCriteria();
    sourcesReturn(makeMatchListing({ id: "wallapop-new1" }));
    vi.mocked(sendEmail).mockResolvedValue(false);

    await run();

    // sendEmail never throws, so a provider outage would otherwise leave the
    // listing marked seen with nobody told — and it is never new again.
    expect(store.matchesFor(alert.id)[0].notifiedAt).toBeNull();
  });

  it("ALERT-24: the next run retries the un-notified match", async () => {
    const { criteria, alert } = seedSubscribedCriteria();
    sourcesReturn(makeMatchListing({ id: "wallapop-new1" }));
    vi.mocked(sendEmail).mockResolvedValue(false);
    await run();

    vi.mocked(sendEmail).mockResolvedValue(true);
    store.seedJob({ criteriaId: criteria.id });
    await run();

    expect(store.matchesFor(alert.id)[0].notifiedAt).toEqual(NOW);
  });

  it("ALERT-25: with email unconfigured the matches are still recorded", async () => {
    emailConfigured = false;
    const { alert } = seedSubscribedCriteria();
    sourcesReturn(makeMatchListing({ id: "wallapop-new1" }));

    await run();

    expect(store.matchesFor(alert.id)).toHaveLength(1);
    expect(store.matchesFor(alert.id)[0].notifiedAt).toBeNull();
  });

  it("ALERT-25: the run says nothing was sent rather than reporting success", async () => {
    emailConfigured = false;
    seedSubscribedCriteria();
    sourcesReturn(makeMatchListing({ id: "wallapop-new1" }));

    const body: RunSummaryBody = await (await run()).json();

    expect(body.emailed).toBe(0);
    expect(body.skippedNoEmail).toBe(1);
  });

  it("ALERT-32: writes the email in the locale stored on the user", async () => {
    const criteria = store.seedCriteria({ criteria: makeCriteria() });
    store.seedAlert({ userId: GRACE.id, criteriaId: criteria.id });
    store.seedJob({ criteriaId: criteria.id });
    sourcesReturn(makeMatchListing({ id: "wallapop-new1" }));

    await run();

    // Grace's account says `es`. There is no request to read a cookie or
    // accept-language from, so the stored locale is the only signal.
    const [{ subject }] = vi.mocked(sendEmail).mock.calls[0];
    expect(subject).toMatch(/coche|nuevo/i);
  });

  it("ALERT-32: falls back to the default locale when the account stores none", async () => {
    store.seedUser({ id: "user-old", email: "old@example.com", locale: null });
    const criteria = store.seedCriteria({ criteria: makeCriteria() });
    store.seedAlert({ userId: "user-old", criteriaId: criteria.id });
    store.seedJob({ criteriaId: criteria.id });
    sourcesReturn(makeMatchListing({ id: "wallapop-new1" }));

    await run();

    // An alert in the wrong language beats no alert at all.
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [{ subject }] = vi.mocked(sendEmail).mock.calls[0];
    expect(subject).toMatch(/coche|nuevo/i);
  });
});
