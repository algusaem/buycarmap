import { beforeEach, describe, expect, it, vi } from "vitest";
import { createKeyValueStoreFake } from "@/test/fakes/key-value-store";

// docs/specs/alerts.md, ALERT-51 and ALERT-55: whether runAlerts reaches the
// database at all. The database is a stand-in that records every property
// read on it and refuses each one, so "no Prisma call" is observable and a
// run that does reach it stops right there. What a full run writes to the key
// is in ./service.integration.test.ts, against real Postgres.

const prismaReads: string[] = [];
const DATABASE_REACHED = "database reached";

vi.mock("@/lib/db/prisma", () => ({
  prisma: new Proxy(
    {},
    {
      get(_target, property) {
        prismaReads.push(String(property));
        throw new Error(DATABASE_REACHED);
      },
    },
  ),
}));

let fake: ReturnType<typeof createKeyValueStoreFake>;
let configured = true;

vi.mock("@/lib/platform/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/platform/rate-limit")>()),
  sharedKeyValueStore: () => (configured ? fake.store : null),
}));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/platform/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/server/alerts/search", () => ({ searchAllSources: vi.fn() }));

import * as Sentry from "@sentry/nextjs";
import { logger } from "@/lib/logger";
import { searchAllSources } from "@/server/alerts/search";
import { runAlerts } from "./service";

// INT-2: VERCEL_ENV is stubbed empty below, so the prefix is "development".
const KEY = "development:alerts:next-due-at";
const T = new Date("2026-10-20T12:00:00.000Z");

beforeEach(() => {
  vi.stubEnv("VERCEL_ENV", "");
  prismaReads.length = 0;
  fake = createKeyValueStoreFake();
  configured = true;
  vi.mocked(logger.error).mockClear();
  vi.mocked(Sentry.captureException).mockClear();
  vi.mocked(searchAllSources).mockClear();
});

describe("runAlerts — the nothing-due gate", () => {
  it("ALERT-51: a key at T + 25 min returns nothing due with zero Prisma calls", async () => {
    fake.values.set(KEY, Date.parse("2026-10-20T12:25:00.000Z"));

    const summary = await runAlerts(T);

    expect(summary).toEqual({
      claimed: 0,
      polled: 0,
      matched: 0,
      emailed: 0,
      skippedNoEmail: 0,
      criteriaCount: 0,
      intervalMs: 300_000,
      oldestPendingAgeMs: 0,
      unhealthySources: [],
      failures: [],
      nothingDue: true,
    });
    expect(prismaReads).toEqual([]);
    expect(searchAllSources).not.toHaveBeenCalled();
    expect(fake.store.set).not.toHaveBeenCalled();
  });

  it("ALERT-51: a key equal to the run's clock queries the database", async () => {
    fake.values.set(KEY, Date.parse("2026-10-20T12:00:00.000Z"));

    await expect(runAlerts(T)).rejects.toThrow(DATABASE_REACHED);
    expect(prismaReads.length).toBeGreaterThan(0);
  });

  it("ALERT-52: no key queries the database", async () => {
    await expect(runAlerts(T)).rejects.toThrow(DATABASE_REACHED);
    expect(prismaReads.length).toBeGreaterThan(0);
  });

  it("ALERT-55: a Redis read failure queries the database, logged once and reported to Sentry", async () => {
    fake.store.get.mockRejectedValueOnce(new Error("redis down"));

    await expect(runAlerts(T)).rejects.toThrow(DATABASE_REACHED);
    expect(prismaReads.length).toBeGreaterThan(0);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it("ALERT-55: without Upstash configured the run queries the database and Redis is never called", async () => {
    configured = false;

    await expect(runAlerts(T)).rejects.toThrow(DATABASE_REACHED);
    expect(prismaReads.length).toBeGreaterThan(0);
    expect(fake.store.get).not.toHaveBeenCalled();
  });
});
