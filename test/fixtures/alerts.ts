import { vi } from "vitest";
import type { AlertSummary } from "@/interfaces/alert";
import type { CarListing } from "@/interfaces/listing";
import type { SearchInput } from "@/lib/validations/search";

// In-memory stand-ins for the six models in docs/specs/alerts.md §5.
//
// Same reasoning as test/fixtures/favorites.ts: asserting that
// `prisma.alertMatch.create` was called proves nothing about ALERT-16 ("no new
// match"), which is a claim about stored state. These rows can be read back.
//
// Only the constraints the criteria depend on are modelled — the unique index on
// (criteriaId, listingId) and on (alertId, listingId). Anything more would be
// reimplementing Postgres in the test suite, and the properties that genuinely
// need Postgres are e2e by design.

export interface AlertCriteriaRow {
  id: string;
  criteriaHash: string;
  criteria: SearchInput;
  lastPolledAt: Date | null;
}

export interface AlertRow {
  id: string;
  userId: string;
  criteriaId: string;
  label: string;
  active: boolean;
  unsubscribeTokenHash: string;
  createdAt: Date;
}

export interface SeenRow {
  id: string;
  criteriaId: string;
  listingId: string;
  source: string;
  firstSeenAt: Date;
}

export interface MatchRow extends Omit<CarListing, "id"> {
  id: string;
  alertId: string;
  listingId: string;
  notifiedAt: Date | null;
  createdAt: Date;
}

export interface JobRow {
  id: string;
  criteriaId: string;
  status: "pending" | "running" | "failed";
  attempts: number;
  availableAt: Date;
  lockedAt: Date | null;
  lastError: string | null;
  enqueuedAt: Date;
}

export interface SourceHealthRow {
  source: string;
  lastOkAt: Date | null;
  consecutiveEmptyRuns: number;
}

export interface UserRow {
  id: string;
  email: string;
  locale: string | null;
}

/** A criteria set narrow enough to clear the ALERT-38 breadth floor. */
export function makeCriteria(overrides: Partial<SearchInput> = {}): SearchInput {
  return {
    brand: "Audi",
    model: "A3",
    maxPrice: 20000,
    latitude: 40.4168,
    longitude: -3.7038,
    distanceInKm: 50,
    ...overrides,
  };
}

export function makeMatchListing(overrides: Partial<CarListing> = {}): CarListing {
  return {
    id: "wallapop-abc123",
    image: "https://cdn.wallapop.com/img1-big.jpg",
    title: "Audi A3 2.0 TDI",
    subtitle: "Great condition",
    price: 14500,
    mileage: 95000,
    year: 2018,
    fuel: "gasoil",
    brand: "Audi",
    model: "A3",
    location: "Madrid",
    source: "Wallapop",
    lat: 40.4168,
    lng: -3.7038,
    url: "https://es.wallapop.com/item/audi-a3-abc123",
    ...overrides,
  };
}

export function makeAlertSummary(overrides: Partial<AlertSummary> = {}): AlertSummary {
  return {
    id: "alert-1",
    label: "Audi A3 under 20k",
    criteria: makeCriteria(),
    matchCount: 0,
    active: true,
    ...overrides,
  };
}

interface Tables {
  users: UserRow[];
  criteria: AlertCriteriaRow[];
  alerts: AlertRow[];
  seen: SeenRow[];
  matches: MatchRow[];
  jobs: JobRow[];
  health: SourceHealthRow[];
}

/**
 * An in-memory stand-in for the alert tables.
 *
 * `$queryRaw` models the claim query's *shape* — pending, available now, oldest
 * first, bounded — but NOT its exclusivity. `FOR UPDATE SKIP LOCKED` is the one
 * thing this cannot reproduce, which is why ALERT-13 is an e2e criterion against
 * real Postgres rather than a node test against this fake.
 */
export function createAlertStore(seed: Partial<Tables> = {}) {
  const t: Tables = {
    users: [...(seed.users ?? [])],
    criteria: [...(seed.criteria ?? [])],
    alerts: [...(seed.alerts ?? [])],
    seen: [...(seed.seen ?? [])],
    matches: [...(seed.matches ?? [])],
    jobs: [...(seed.jobs ?? [])],
    health: [...(seed.health ?? [])],
  };

  let sequence = 0;
  const nextId = (prefix: string) => {
    sequence += 1;
    return `${prefix}-${sequence}`;
  };

  // Models the subset of Prisma's `where` the alert code actually uses:
  // equality, `{ not }` and `{ in }`. Anything richer belongs in a real
  // database, not in here.
  const matches = <T extends object>(row: T, where: Partial<T> = {}) =>
    Object.entries(where).every(([key, value]) => {
      if (value === undefined) return true;
      if (value !== null && typeof value === "object") {
        if ("not" in value) {
          return row[key as keyof T] !== (value as { not: unknown }).not;
        }
        if ("in" in value) {
          return (value as { in: unknown[] }).in.includes(row[key as keyof T]);
        }
      }
      return row[key as keyof T] === value;
    });

  const client = {
    user: {
      findUnique: vi.fn(
        async ({ where }: { where: { id: string } }) =>
          t.users.find((row) => row.id === where.id) ?? null,
      ),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<UserRow> }) => {
        const row = t.users.find((user) => user.id === where.id);
        if (!row) throw new Error("User not found");
        Object.assign(row, data);
        return row;
      }),
    },

    alertCriteria: {
      findUnique: vi.fn(
        async ({ where }: { where: { criteriaHash?: string; id?: string } }) =>
          t.criteria.find((row) =>
            where.id !== undefined ? row.id === where.id : row.criteriaHash === where.criteriaHash,
          ) ?? null,
      ),
      findMany: vi.fn(
        async ({
          where,
        }: {
          where?: {
            id?: string;
            alerts?: { some?: { active?: boolean } };
          };
        } = {}) =>
          t.criteria.filter((row) => {
            if (where?.id && row.id !== where.id) return false;
            // Models `alerts: { some: { active: true } }` — the filter that
            // stops an all-unsubscribed criteria set being polled (ALERT-41).
            const some = where?.alerts?.some;
            if (!some) return true;
            return t.alerts.some(
              (alert) =>
                alert.criteriaId === row.id &&
                (some.active === undefined || alert.active === some.active),
            );
          }),
      ),
      create: vi.fn(async ({ data }: { data: { criteriaHash: string; criteria: SearchInput } }) => {
        const existing = t.criteria.find((row) => row.criteriaHash === data.criteriaHash);
        if (existing) {
          throw Object.assign(new Error("Unique constraint failed"), {
            code: "P2002",
          });
        }
        const row: AlertCriteriaRow = {
          id: nextId("crit"),
          criteriaHash: data.criteriaHash,
          criteria: data.criteria,
          lastPolledAt: null,
        };
        t.criteria.push(row);
        return row;
      }),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: Partial<AlertCriteriaRow> }) => {
          const row = t.criteria.find((crit) => crit.id === where.id);
          if (!row) throw new Error("Criteria not found");
          Object.assign(row, data);
          return row;
        },
      ),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        const row = t.criteria.find((crit) => crit.id === where.id);
        t.criteria = t.criteria.filter((crit) => crit.id !== where.id);
        // Cascade, as the schema declares.
        t.seen = t.seen.filter((s) => s.criteriaId !== where.id);
        t.jobs = t.jobs.filter((job) => job.criteriaId !== where.id);
        return row;
      }),
    },

    alert: {
      findFirst: vi.fn(
        async ({ where }: { where: Partial<AlertRow> }) =>
          t.alerts.find((row) => matches(row, where)) ?? null,
      ),
      findMany: vi.fn(
        async ({
          where,
          include,
        }: {
          where?: Partial<AlertRow>;
          include?: { criteria?: boolean; user?: boolean; _count?: unknown };
        } = {}) =>
          t.alerts
            .filter((row) => matches(row, where))
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .map((row) =>
              include
                ? {
                    ...row,
                    criteria: t.criteria.find((crit) => crit.id === row.criteriaId),
                    user: t.users.find((user) => user.id === row.userId),
                    _count: {
                      matches: t.matches.filter((match) => match.alertId === row.id).length,
                    },
                  }
                : row,
            ),
      ),
      count: vi.fn(
        async ({ where }: { where?: Partial<AlertRow> } = {}) =>
          t.alerts.filter((row) => matches(row, where)).length,
      ),
      create: vi.fn(async ({ data }: { data: Omit<AlertRow, "id"> }) => {
        const clash = t.alerts.find(
          (row) => row.userId === data.userId && row.criteriaId === data.criteriaId,
        );
        if (clash) {
          throw Object.assign(new Error("Unique constraint failed"), {
            code: "P2002",
          });
        }
        const row: AlertRow = { id: nextId("alert"), ...data };
        t.alerts.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<AlertRow> }) => {
        const row = t.alerts.find((alert) => alert.id === where.id);
        if (!row) throw new Error("Alert not found");
        Object.assign(row, data);
        return row;
      }),
      updateMany: vi.fn(
        async ({ where, data }: { where: Partial<AlertRow>; data: Partial<AlertRow> }) => {
          const hit = t.alerts.filter((row) => matches(row, where));
          hit.forEach((row) => {
            Object.assign(row, data);
          });
          return { count: hit.length };
        },
      ),
      deleteMany: vi.fn(async ({ where }: { where: Partial<AlertRow> }) => {
        const doomed = t.alerts.filter((row) => matches(row, where));
        t.alerts = t.alerts.filter((row) => !matches(row, where));
        // Cascade on the delivery rows, as the schema declares.
        const ids = new Set(doomed.map((row) => row.id));
        t.matches = t.matches.filter((row) => !ids.has(row.alertId));
        return { count: doomed.length };
      }),
    },

    alertSeenListing: {
      findMany: vi.fn(async ({ where }: { where: { criteriaId: string } }) =>
        t.seen.filter((row) => row.criteriaId === where.criteriaId),
      ),
      createMany: vi.fn(
        async ({
          data,
        }: {
          data: Omit<SeenRow, "id" | "firstSeenAt">[];
          skipDuplicates?: boolean;
        }) => {
          let count = 0;
          for (const entry of data) {
            const clash = t.seen.some(
              (row) => row.criteriaId === entry.criteriaId && row.listingId === entry.listingId,
            );
            if (clash) continue;
            // The schema's @default(now()); callers do not supply it.
            t.seen.push({
              id: nextId("seen"),
              firstSeenAt: new Date(),
              ...entry,
            });
            count += 1;
          }
          return { count };
        },
      ),
    },

    alertMatch: {
      findMany: vi.fn(async ({ where }: { where?: Partial<MatchRow> } = {}) =>
        t.matches
          .filter((row) => matches(row, where))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      ),
      createMany: vi.fn(
        async ({
          data,
        }: {
          data: Omit<MatchRow, "id" | "createdAt">[];
          skipDuplicates?: boolean;
        }) => {
          let count = 0;
          for (const entry of data) {
            const clash = t.matches.some(
              (row) => row.alertId === entry.alertId && row.listingId === entry.listingId,
            );
            if (clash) continue;
            // The schema's @default(now()); callers do not supply it, and
            // "newest first" reads this.
            t.matches.push({
              id: nextId("match"),
              createdAt: new Date(),
              ...entry,
            });
            count += 1;
          }
          return { count };
        },
      ),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id?: { in: string[] } } & Partial<MatchRow>;
          data: Partial<MatchRow>;
        }) => {
          const ids = where.id?.in;
          const hit = t.matches.filter((row) => (ids ? ids.includes(row.id) : matches(row, where)));
          hit.forEach((row) => {
            Object.assign(row, data);
          });
          return { count: hit.length };
        },
      ),
    },

    alertPollJob: {
      findMany: vi.fn(async ({ where }: { where?: Partial<JobRow> } = {}) =>
        t.jobs.filter((row) => matches(row, where)),
      ),
      findUnique: vi.fn(
        async ({ where }: { where: { id?: string; criteriaId?: string } }) =>
          t.jobs.find((row) =>
            where.id !== undefined ? row.id === where.id : row.criteriaId === where.criteriaId,
          ) ?? null,
      ),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id?: { in: string[] } } & Partial<JobRow>;
          data: Partial<JobRow>;
        }) => {
          const ids = where.id?.in;
          const hit = t.jobs.filter((row) => (ids ? ids.includes(row.id) : matches(row, where)));
          hit.forEach((row) => {
            Object.assign(row, data);
          });
          return { count: hit.length };
        },
      ),
      upsert: vi.fn(
        async ({
          where,
          create,
        }: {
          where: { criteriaId: string };
          create: Omit<JobRow, "id">;
          update: Partial<JobRow>;
        }) => {
          const existing = t.jobs.find((row) => row.criteriaId === where.criteriaId);
          if (existing) return existing;
          const row: JobRow = { id: nextId("job"), ...create };
          t.jobs.push(row);
          return row;
        },
      ),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<JobRow> }) => {
        const row = t.jobs.find((job) => job.id === where.id);
        if (!row) throw new Error("Job not found");
        Object.assign(row, data);
        return row;
      }),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        const row = t.jobs.find((job) => job.id === where.id);
        t.jobs = t.jobs.filter((job) => job.id !== where.id);
        return row;
      }),
    },

    sourceHealth: {
      findMany: vi.fn(async () => [...t.health]),
      upsert: vi.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: { source: string };
          create: SourceHealthRow;
          // Omit before widening: intersecting with Partial<SourceHealthRow>
          // would narrow the field back to `number` and make the increment
          // branch unreachable.
          update: Omit<Partial<SourceHealthRow>, "consecutiveEmptyRuns"> & {
            consecutiveEmptyRuns?: number | { increment: number };
          };
        }) => {
          const existing = t.health.find((row) => row.source === where.source);
          if (existing) {
            const { consecutiveEmptyRuns, ...rest } = update;
            Object.assign(existing, rest);
            // Prisma's atomic `{ increment: n }`, which the runner uses so two
            // workers cannot both read-then-write the same stale count.
            if (consecutiveEmptyRuns !== undefined) {
              existing.consecutiveEmptyRuns =
                typeof consecutiveEmptyRuns === "number"
                  ? consecutiveEmptyRuns
                  : existing.consecutiveEmptyRuns + consecutiveEmptyRuns.increment;
            }
            return existing;
          }
          const row = { ...create };
          t.health.push(row);
          return row;
        },
      ),
    },

    /**
     * Stands in for the claim query. Reproduces its filter, ordering and bound —
     * not its exclusivity, which is what ALERT-13 covers against real Postgres.
     */
    $queryRaw: vi.fn(async (_strings: TemplateStringsArray, limit: number) => {
      const now = new Date();
      const claimable = t.jobs
        .filter((job) => job.status === "pending" && job.availableAt <= now)
        .sort((a, b) => a.enqueuedAt.getTime() - b.enqueuedAt.getTime())
        .slice(0, limit);
      claimable.forEach((job) => {
        job.status = "running";
        job.lockedAt = now;
      });
      return claimable.map((job) => ({ id: job.id }));
    }),
  };

  return {
    client,
    criteria: () => [...t.criteria],
    alerts: () => [...t.alerts],
    alertsFor: (userId: string) => t.alerts.filter((row) => row.userId === userId),
    seen: () => [...t.seen],
    seenFor: (criteriaId: string) => t.seen.filter((row) => row.criteriaId === criteriaId),
    matches: () => [...t.matches],
    matchesFor: (alertId: string) => t.matches.filter((row) => row.alertId === alertId),
    jobs: () => [...t.jobs],
    health: () => [...t.health],
    users: () => [...t.users],

    seedUser: (row: UserRow) => {
      t.users.push(row);
      return row;
    },
    seedCriteria: (row: Partial<AlertCriteriaRow> = {}) => {
      const created: AlertCriteriaRow = {
        id: row.id ?? nextId("crit"),
        criteriaHash: row.criteriaHash ?? `hash-${sequence}`,
        criteria: row.criteria ?? makeCriteria(),
        lastPolledAt: row.lastPolledAt ?? null,
      };
      t.criteria.push(created);
      return created;
    },
    seedAlert: (row: Partial<AlertRow> & { userId: string; criteriaId: string }) => {
      const created: AlertRow = {
        id: row.id ?? nextId("alert"),
        userId: row.userId,
        criteriaId: row.criteriaId,
        label: row.label ?? "Audi A3 under 20k",
        active: row.active ?? true,
        unsubscribeTokenHash: row.unsubscribeTokenHash ?? `tokenhash-${sequence}`,
        createdAt: row.createdAt ?? new Date(2026, 0, 1, 0, 0, sequence),
      };
      t.alerts.push(created);
      return created;
    },
    seedJob: (row: Partial<JobRow> & { criteriaId: string }) => {
      const created: JobRow = {
        id: row.id ?? nextId("job"),
        criteriaId: row.criteriaId,
        status: row.status ?? "pending",
        attempts: row.attempts ?? 0,
        availableAt: row.availableAt ?? new Date(2026, 0, 1),
        lockedAt: row.lockedAt ?? null,
        lastError: row.lastError ?? null,
        enqueuedAt: row.enqueuedAt ?? new Date(2026, 0, 1, 0, 0, sequence),
      };
      t.jobs.push(created);
      return created;
    },
    seedSeen: (criteriaId: string, listingId: string, source = "Wallapop") => {
      t.seen.push({
        id: nextId("seen"),
        criteriaId,
        listingId,
        source,
        firstSeenAt: new Date(2026, 0, 1),
      });
    },
    seedMatch: (row: Partial<MatchRow> & { alertId: string }) => {
      const listing = makeMatchListing();
      const created: MatchRow = {
        ...listing,
        ...row,
        id: row.id ?? nextId("match"),
        alertId: row.alertId,
        listingId: row.listingId ?? listing.id,
        notifiedAt: row.notifiedAt ?? null,
        createdAt: row.createdAt ?? new Date(2026, 0, 1, 0, 0, sequence),
      };
      t.matches.push(created);
      return created;
    },
  };
}
