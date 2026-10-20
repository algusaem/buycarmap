import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { asAlertId, asUserId } from "@/lib/ids";
import { createAlert } from "@/test/factories/alert";
import { createAlertCriteria } from "@/test/factories/alert-criteria";
import { createUser } from "@/test/factories/user";
import { makeCriteria } from "@/test/fixtures/alerts";
import { createKeyValueStoreFake } from "@/test/fakes/key-value-store";

vi.mock("@/lib/platform/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("next-intl/server", () => ({ getLocale: vi.fn(async () => "en") }));

// The seed poll (ALERT-2) is the only network createAlertForUser does. Stubbed
// at the server-side search seam, not the database.
vi.mock("@/server/alerts/search", () => ({
  searchAllSources: vi.fn(async () => ({ listings: [], failedSources: [], perSourceCounts: {} })),
}));

// docs/specs/alerts.md, ALERT-51 to ALERT-55: the gate's Upstash client, as
// an in-memory stand-in. Unconfigured (null) unless a test opts in, so every
// other case here runs exactly as it did before the gate.
let fake: ReturnType<typeof createKeyValueStoreFake> | null = null;

vi.mock("@/lib/platform/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/platform/rate-limit")>()),
  sharedKeyValueStore: () => fake?.store ?? null,
}));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import * as Sentry from "@sentry/nextjs";
import { logger } from "@/lib/logger";
import { hashUnsubscribeToken } from "./unsubscribe-token";
import {
  createAlertForUser,
  deleteAlertForUser,
  findAlertSummaries,
  findAlertWithMatches,
  pauseAlertByUnsubscribeToken,
  runAlerts,
} from "./service";

describe("findAlertWithMatches", () => {
  it("LAYOUT-11: another user's alert is not found", async () => {
    const ada = await createUser({ email: "ada@example.com" });
    const grace = await createUser({ email: "grace@example.com" });
    const criteria = await createAlertCriteria();
    const gracesAlert = await createAlert({
      user: { connect: { id: grace.id } },
      criteria: { connect: { id: criteria.id } },
    });

    const alert = await findAlertWithMatches(asUserId(ada.id), asAlertId(gracesAlert.id));

    expect(alert).toBeNull();
  });

  it("LAYOUT-11 / ALERTUI-45: the user's own alert is returned", async () => {
    const ada = await createUser({ email: "ada@example.com" });
    const criteria = await createAlertCriteria();
    const adasAlert = await createAlert({
      user: { connect: { id: ada.id } },
      criteria: { connect: { id: criteria.id } },
    });

    const alert = await findAlertWithMatches(asUserId(ada.id), asAlertId(adasAlert.id));

    // ALERTUI-45: only the fields of redesign-alerts.md › Contracts › Server;
    // ownership is the 404 above (another user's alert is not found).
    expect(alert).toMatchObject({
      id: adasAlert.id,
      label: adasAlert.label,
      placeName: adasAlert.placeName,
      active: adasAlert.active,
      createdAt: adasAlert.createdAt,
      matches: [],
    });
    expect(Object.keys(alert ?? {}).sort()).toEqual([
      "active",
      "createdAt",
      "criteria",
      "id",
      "label",
      "matches",
      "placeName",
    ]);
  });
});

describe("findAlertSummaries", () => {
  it("ALERT-1: the alert is readable on a later request", async () => {
    const ada = await createUser({ email: "ada@example.com" });

    await createAlertForUser(asUserId(ada.id), makeCriteria(), "Audi A3 under 20k");

    const result = await findAlertSummaries(asUserId(ada.id));

    expect(result.map((row) => row.label)).toEqual(["Audi A3 under 20k"]);
  });

  it("ALERT-1: returns only the caller's own alerts", async () => {
    const ada = await createUser({ email: "ada@example.com" });
    const grace = await createUser({ email: "grace@example.com" });

    await createAlertForUser(asUserId(grace.id), makeCriteria({ brand: "BMW" }), "Grace's search");
    await createAlertForUser(asUserId(ada.id), makeCriteria(), "Ada's search");

    const result = await findAlertSummaries(asUserId(ada.id));

    expect(result.map((row) => row.label)).toEqual(["Ada's search"]);
  });

  it("ALERT-1: an empty list is a success, not an error", async () => {
    const ada = await createUser({ email: "ada@example.com" });

    const result = await findAlertSummaries(asUserId(ada.id));

    expect(result).toEqual([]);
  });

  it("ALERT-42: an inactive alert still holds its criteria set", async () => {
    const ada = await createUser({ email: "ada@example.com" });
    await createAlertForUser(asUserId(ada.id), makeCriteria(), "Audi A3 under 20k");
    const [alert] = await prisma.alert.findMany({ where: { userId: ada.id } });
    // Unsubscribing deactivates; only deletion releases the criteria, so the
    // matches page still renders and re-enabling loses nothing.
    await prisma.alert.update({ where: { id: alert.id }, data: { active: false } });

    await expect(findAlertSummaries(asUserId(ada.id))).resolves.toEqual([
      expect.objectContaining({ label: "Audi A3 under 20k", matchCount: 0, active: false }),
    ]);
    expect(await prisma.alertCriteria.count()).toBe(1);
  });
});

// INT-2: VERCEL_ENV is stubbed empty below, so the prefix is "development".
const KEY = "development:alerts:next-due-at";
const MINUTE = 60_000;

describe("the nothing-due gate", () => {
  // The moment every case writes or runs at: the real clock, a few seconds
  // back and pinned, so the claim query's SQL now() and the rows below agree
  // (as in app/api/alerts/run/route.integration.test.ts).
  let W: number;
  let gate: ReturnType<typeof createKeyValueStoreFake>;

  beforeEach(() => {
    vi.stubEnv("VERCEL_ENV", "");
    W = Date.now() - 5_000;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(W);
    gate = createKeyValueStoreFake();
    fake = gate;
    vi.mocked(logger.error).mockClear();
    vi.mocked(Sentry.captureException).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    fake = null;
  });

  async function subscribe(lastPolledAt: Date | null) {
    const ada = await createUser({ email: "ada@example.com" });
    const criteria = await createAlertCriteria({ lastPolledAt });
    await createAlert({
      user: { connect: { id: ada.id } },
      criteria: { connect: { id: criteria.id } },
    });
    return criteria;
  }

  it("ALERT-52 (a): a criteria set polled 2 min ago, with no job, stores now + 3 min, expiring then", async () => {
    await subscribe(new Date(W - 2 * MINUTE));

    const summary = await runAlerts(new Date(W));

    expect(summary.nothingDue).toBe(false);
    expect(await prisma.alertPollJob.count()).toBe(0);
    expect(gate.values.get(KEY)).toBe(W + 3 * MINUTE);
    expect(gate.expiries.get(KEY)).toBe(W + 3 * MINUTE);
  });

  it("ALERT-52 (a) then ALERT-51: the next run, one minute later, is nothing due", async () => {
    await subscribe(new Date(W - 2 * MINUTE));
    await runAlerts(new Date(W));

    const summary = await runAlerts(new Date(W + MINUTE));

    expect(summary.nothingDue).toBe(true);
  });

  it("ALERT-52 (b): no active alert and an empty queue store now + 6 h", async () => {
    await runAlerts(new Date(W));

    expect(gate.values.get(KEY)).toBe(W + 6 * 60 * MINUTE);
  });

  it("ALERT-52 (c): a backed-off pending job holds the key; a failed job counts for nothing", async () => {
    const c = await subscribe(new Date(W - 120 * MINUTE));
    const d = await createAlertCriteria({ lastPolledAt: new Date(W - 120 * MINUTE) });
    const grace = await createUser({ email: "grace@example.com" });
    await createAlert({ user: { connect: { id: grace.id } }, criteria: { connect: { id: d.id } } });
    await prisma.alertPollJob.create({
      data: { criteriaId: c.id, status: "pending", availableAt: new Date(W + 15 * MINUTE) },
    });
    await prisma.alertPollJob.create({
      data: { criteriaId: d.id, status: "failed", attempts: 3 },
    });

    await runAlerts(new Date(W));

    expect(gate.values.get(KEY)).toBe(W + 15 * MINUTE);
  });

  it("ALERT-53: saving a new alert sets the key to the moment of the write, and the next run polls it", async () => {
    const ada = await createUser({ email: "ada@example.com" });
    gate.values.set(KEY, W + 15 * MINUTE);

    await createAlertForUser(asUserId(ada.id), makeCriteria(), "Audi A3 under 20k");

    expect(gate.values.get(KEY)).toBe(W);
    const summary = await runAlerts(new Date(W + 30_000));
    expect(summary.nothingDue).toBe(false);
    expect(summary.polled).toBe(1);
  });

  it("ALERT-53: reactivating a paused alert sets the key", async () => {
    const ada = await createUser({ email: "ada@example.com" });
    await createAlertForUser(asUserId(ada.id), makeCriteria(), "Audi A3 under 20k");
    await prisma.alert.updateMany({ where: { userId: ada.id }, data: { active: false } });
    gate.values.set(KEY, W + 15 * MINUTE);

    await createAlertForUser(asUserId(ada.id), makeCriteria(), "Audi A3, again");

    expect(gate.values.get(KEY)).toBe(W);
  });

  it("ALERT-53: saving criteria already live leaves the key alone", async () => {
    const ada = await createUser({ email: "ada@example.com" });
    await createAlertForUser(asUserId(ada.id), makeCriteria(), "Audi A3 under 20k");
    gate.values.set(KEY, W + 15 * MINUTE);

    const result = await createAlertForUser(asUserId(ada.id), makeCriteria(), "Audi A3 under 20k");

    expect(result).toEqual({ ok: true, value: { created: false } });
    expect(gate.values.get(KEY)).toBe(W + 15 * MINUTE);
  });

  it("ALERT-53: deleting an alert sets the key", async () => {
    const ada = await createUser({ email: "ada@example.com" });
    await createAlertForUser(asUserId(ada.id), makeCriteria(), "Audi A3 under 20k");
    const [alert] = await prisma.alert.findMany({ where: { userId: ada.id } });
    gate.values.set(KEY, W + 15 * MINUTE);

    await deleteAlertForUser(asUserId(ada.id), asAlertId(alert.id));

    expect(gate.values.get(KEY)).toBe(W);
  });

  it("ALERT-53: pausing from a valid unsubscribe link sets the key; an unknown token leaves it", async () => {
    const criteria = await subscribe(null);
    await prisma.alert.updateMany({
      where: { criteriaId: criteria.id },
      data: { unsubscribeTokenHash: hashUnsubscribeToken("raw-token-ada") },
    });
    gate.values.set(KEY, W + 15 * MINUTE);

    await pauseAlertByUnsubscribeToken("some-token-nobody-issued");
    expect(gate.values.get(KEY)).toBe(W + 15 * MINUTE);

    await pauseAlertByUnsubscribeToken("raw-token-ada");
    expect(gate.values.get(KEY)).toBe(W);
  });

  it("ALERT-55: deleting an alert while Redis rejects the write still deletes it, logged and reported", async () => {
    const ada = await createUser({ email: "ada@example.com" });
    await createAlertForUser(asUserId(ada.id), makeCriteria(), "Audi A3 under 20k");
    const [alert] = await prisma.alert.findMany({ where: { userId: ada.id } });
    vi.mocked(logger.error).mockClear();
    vi.mocked(Sentry.captureException).mockClear();
    gate.store.set.mockRejectedValueOnce(new Error("redis down"));

    await expect(
      deleteAlertForUser(asUserId(ada.id), asAlertId(alert.id)),
    ).resolves.toBeUndefined();

    const deleted = await prisma.alert.findUnique({ where: { id: alert.id } });
    expect(deleted?.deletedAt).not.toBeNull();
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it("ALERT-55: a run whose Redis read fails queries the database and stores nothing", async () => {
    await subscribe(new Date(W - 2 * MINUTE));
    gate.store.get.mockRejectedValueOnce(new Error("redis down"));

    const summary = await runAlerts(new Date(W));

    expect(summary).toMatchObject({ nothingDue: false, criteriaCount: 1 });
    expect(gate.store.set).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });
});
