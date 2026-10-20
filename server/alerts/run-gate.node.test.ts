import { beforeEach, describe, expect, it, vi } from "vitest";
import { createKeyValueStoreFake } from "@/test/fakes/key-value-store";

// docs/specs/alerts.md, ALERT-51 to ALERT-55: the "nothing due" gate on its
// own, against an in-memory stand-in for the Upstash client. The runner's use
// of it is in ./service.node.test.ts and ./service.integration.test.ts.

let fake: ReturnType<typeof createKeyValueStoreFake>;
let configured = true;

vi.mock("@/lib/platform/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/platform/rate-limit")>()),
  sharedKeyValueStore: () => (configured ? fake.store : null),
}));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import * as Sentry from "@sentry/nextjs";
import { logger } from "@/lib/logger";
import { closeRunGate, markAlertsChanged, nextDueAt, openRunGate } from "./run-gate";

// INT-2: VERCEL_ENV is stubbed empty below, so the prefix is "development".
const KEY = "development:alerts:next-due-at";
const at = (iso: string) => Date.parse(iso);
const T = new Date("2026-10-20T12:00:00.000Z");
const FIVE_MIN = 5 * 60_000;
const LEASE = 10 * 60_000;

beforeEach(() => {
  vi.stubEnv("VERCEL_ENV", "");
  fake = createKeyValueStoreFake();
  configured = true;
  vi.mocked(logger.error).mockClear();
  vi.mocked(Sentry.captureException).mockClear();
});

describe("openRunGate", () => {
  it("ALERT-51: a stored moment later than the clock means nothing is due", async () => {
    fake.values.set(KEY, at("2026-10-20T12:25:00.000Z"));

    await expect(openRunGate(T)).resolves.toMatchObject({ nothingDue: true });
  });

  it("ALERT-51: a stored moment equal to the clock is due", async () => {
    fake.values.set(KEY, at("2026-10-20T12:00:00.000Z"));

    await expect(openRunGate(T)).resolves.toMatchObject({ nothingDue: false });
  });

  it("ALERT-52: no key is due", async () => {
    await expect(openRunGate(T)).resolves.toEqual({ nothingDue: false, observed: null });
  });

  it("ALERT-55: a Redis read failure is due, logged once and reported to Sentry", async () => {
    fake.store.get.mockRejectedValueOnce(new Error("redis down"));

    await expect(openRunGate(T)).resolves.toEqual({ nothingDue: false });
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it("ALERT-55: without Upstash configured the gate is off and Redis is never called", async () => {
    configured = false;

    await expect(openRunGate(T)).resolves.toEqual({ nothingDue: false });
    expect(fake.store.get).not.toHaveBeenCalled();
  });
});

describe("closeRunGate", () => {
  it("ALERT-52: stores the next moment, expiring at that moment", async () => {
    const gate = await openRunGate(T);

    await closeRunGate(gate, T, at("2026-10-20T12:03:00.000Z"));

    expect(fake.values.get(KEY)).toBe(at("2026-10-20T12:03:00.000Z"));
    expect(fake.expiries.get(KEY)).toBe(at("2026-10-20T12:03:00.000Z"));
  });

  it("ALERT-52 (e): a moment at the clock is not stored", async () => {
    const gate = await openRunGate(T);

    await closeRunGate(gate, T, at("2026-10-20T12:00:00.000Z"));

    expect(fake.store.set).not.toHaveBeenCalled();
  });

  it("ALERT-54: a key changed during the run is left as the write set it", async () => {
    const gate = await openRunGate(T);
    // Ada saves an alert at 12:00:20 while the run is in progress.
    fake.values.set(KEY, at("2026-10-20T12:00:20.000Z"));

    await closeRunGate(gate, T, at("2026-10-20T12:05:00.000Z"));

    expect(fake.values.get(KEY)).toBe(at("2026-10-20T12:00:20.000Z"));
    expect(fake.store.set).not.toHaveBeenCalled();
  });

  it("ALERT-55: a gate whose read failed writes nothing", async () => {
    fake.store.get.mockRejectedValueOnce(new Error("redis down"));
    const gate = await openRunGate(T);

    await closeRunGate(gate, T, at("2026-10-20T12:03:00.000Z"));

    expect(fake.store.set).not.toHaveBeenCalled();
  });

  it("ALERT-55: a Redis write failure is logged and reported, never thrown", async () => {
    const gate = await openRunGate(T);
    fake.store.set.mockRejectedValueOnce(new Error("redis down"));

    await expect(closeRunGate(gate, T, at("2026-10-20T12:03:00.000Z"))).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });
});

describe("markAlertsChanged", () => {
  it("ALERT-53: sets the key to the moment of the write", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-20T12:10:00.000Z"));
    fake.values.set(KEY, at("2026-10-20T12:25:00.000Z"));

    await markAlertsChanged();

    vi.useRealTimers();
    expect(fake.values.get(KEY)).toBe(at("2026-10-20T12:10:00.000Z"));
    // Expires at the gate's ceiling, 6 h after the write.
    expect(fake.expiries.get(KEY)).toBe(at("2026-10-20T18:10:00.000Z"));
  });

  it("ALERT-55: a Redis write failure is logged and reported, never thrown", async () => {
    fake.store.set.mockRejectedValueOnce(new Error("redis down"));

    await expect(markAlertsChanged()).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it("ALERT-55: without Upstash configured nothing is written", async () => {
    configured = false;

    await markAlertsChanged();

    expect(fake.store.set).not.toHaveBeenCalled();
  });
});

describe("nextDueAt", () => {
  const base = {
    now: T.getTime(),
    intervalMs: FIVE_MIN,
    leaseTimeoutMs: LEASE,
    undelivered: false,
    criteria: [],
    jobs: [],
  };

  it("ALERT-52 (a): a criteria set polled at 11:58 with no job is next due at 12:03", () => {
    expect(
      nextDueAt({
        ...base,
        criteria: [{ id: "C", lastPolledAt: new Date("2026-10-20T11:58:00.000Z") }],
      }),
    ).toBe(at("2026-10-20T12:03:00.000Z"));
  });

  it("ALERT-52: a criteria set never polled, with no job, is due now", () => {
    expect(nextDueAt({ ...base, criteria: [{ id: "C", lastPolledAt: null }] })).toBe(
      at("2026-10-20T12:00:00.000Z"),
    );
  });

  it("ALERT-52 (b): no active criteria, no job and nothing undelivered is the 6 h ceiling", () => {
    expect(nextDueAt(base)).toBe(at("2026-10-20T18:00:00.000Z"));
  });

  it("ALERT-52 (c): a pending job's availableAt outranks its criteria, and a failed job counts for nothing", () => {
    expect(
      nextDueAt({
        ...base,
        criteria: [
          { id: "C", lastPolledAt: new Date("2026-10-20T10:00:00.000Z") },
          { id: "D", lastPolledAt: new Date("2026-10-20T10:00:00.000Z") },
        ],
        jobs: [
          {
            criteriaId: "C",
            status: "pending",
            availableAt: new Date("2026-10-20T12:15:00.000Z"),
            lockedAt: null,
          },
          {
            criteriaId: "D",
            status: "failed",
            availableAt: new Date("2026-10-20T09:00:00.000Z"),
            lockedAt: null,
          },
        ],
      }),
    ).toBe(at("2026-10-20T12:15:00.000Z"));
  });

  it("ALERT-52 (d): a running job is next due 1 ms after its lease expires", () => {
    expect(
      nextDueAt({
        ...base,
        criteria: [{ id: "C", lastPolledAt: new Date("2026-10-20T10:00:00.000Z") }],
        jobs: [
          {
            criteriaId: "C",
            status: "running",
            availableAt: new Date("2026-10-20T09:00:00.000Z"),
            lockedAt: new Date("2026-10-20T11:55:00.000Z"),
          },
        ],
      }),
    ).toBe(at("2026-10-20T12:05:00.001Z"));
  });

  it("ALERT-52 (e): an un-notified match of an active alert is due now", () => {
    expect(
      nextDueAt({
        ...base,
        undelivered: true,
        criteria: [{ id: "C", lastPolledAt: new Date("2026-10-20T11:58:00.000Z") }],
      }),
    ).toBe(at("2026-10-20T12:00:00.000Z"));
  });
});
