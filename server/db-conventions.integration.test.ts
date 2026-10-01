import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createUser } from "@/test/factories/user";
import { createFavorite } from "@/test/factories/favorite";
import { makeFavoriteInput } from "@/test/fixtures/favorites";
import { makeCriteria } from "@/test/fixtures/alerts";

// docs/specs/core-data-model.md: the cross-cutting database conventions that
// are not owned by one feature's own test file — DATA-6, DATA-7, DATA-9,
// DATA-13 and DATA-14. Several of these assertions name fields
// (`createdById`, `deletedAt`, `version`) the schema does not have yet; until
// the migration lands they read back `undefined` from Prisma and fail the
// comparison, which is the point.

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/server/alerts/search", () => ({ searchAllSources: vi.fn() }));
vi.mock("@/lib/email/client", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/i18n/server", () => ({ getLocale: vi.fn(async () => "en") }));
vi.mock("@/lib/auth/hash", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/hash")>()),
  verifyPassword: vi.fn(),
}));

import { getCurrentUser } from "@/lib/auth/session";
import { searchAllSources } from "@/server/alerts/search";
import { saveFavorite } from "@/server/favorites/actions";
import { createAlert } from "@/server/alerts/actions";
import { deleteAccount } from "@/server/account/actions";
import { consumeRateLimit, RATE_LIMITS } from "@/server/rate-limit/service";
import { createPasswordResetToken } from "@/test/factories/auth-tokens";
import { pruneExpiredAuthRows } from "@/server/auth/service";

beforeEach(() => {
  vi.mocked(getCurrentUser).mockReset();
  vi.mocked(searchAllSources).mockReset().mockResolvedValue({
    listings: [],
    failedSources: [],
    perSourceCounts: {},
  });
});

describe("DATA-6: every DateTime column is @db.Timestamptz(3)", () => {
  it("DATA-6: no column in public is timestamp without time zone", async () => {
    const rows = await prisma.$queryRaw<{ table_name: string; column_name: string }[]>`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND data_type = 'timestamp without time zone'
    `;

    expect(rows).toEqual([]);
  });

  it("DATA-6 (worked example): an instant round-trips unchanged through createdAt", async () => {
    const user = await createUser();
    const when = new Date("2026-09-30T10:00:00.000Z");

    const favorite = await createFavorite({ user: { connect: { id: user.id } }, createdAt: when });

    const found = await prisma.favorite.findUnique({ where: { id: favorite.id } });
    expect(found?.createdAt.getTime()).toBe(when.getTime());
  });
});

describe("DATA-7: AlertPollJobStatus is a real Postgres enum", () => {
  it("DATA-7: a status outside pending/running/failed is rejected by the database", async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO alert_poll_jobs (id, criteria_id, status) VALUES (gen_random_uuid(), gen_random_uuid(), 'done')`,
      ),
    ).rejects.toThrow(/enum|check constraint|invalid input value/i);
  });
});

describe("DATA-9: createdById/updatedById follow the actor, and are null for system writes", () => {
  it("DATA-9: saveFavorite as U sets createdById to U.id", async () => {
    const user = await createUser();
    vi.mocked(getCurrentUser).mockResolvedValue({ id: user.id, email: user.email });

    await saveFavorite(makeFavoriteInput());

    const row = await prisma.favorite.findFirst({ where: { userId: user.id } });
    expect(row?.createdById).toBe(user.id);
  });

  it("DATA-9: createAlert as U sets createdById to U.id", async () => {
    const user = await createUser({ email: "ada-data9@example.com", locale: "en" });
    vi.mocked(getCurrentUser).mockResolvedValue({ id: user.id, email: user.email });

    await createAlert(makeCriteria(), "Audi A3 under 20k");

    const row = await prisma.alert.findFirst({ where: { userId: user.id } });
    expect(row?.createdById).toBe(user.id);
  });

  it("DATA-9: a rate-limit consume leaves createdById null (a system write)", async () => {
    await consumeRateLimit("data-9:system-write", RATE_LIMITS.loginPerIp);

    const row = await prisma.rateLimit.findUnique({ where: { key: "data-9:system-write" } });
    expect(row?.createdById).toBeNull();
  });
});

describe("DATA-13: account deletion still erases at once, and orphaned authorship is nulled", () => {
  it("DATA-13: deleteAccount leaves no user row and no favorites or alerts, soft-deleted or not", async () => {
    const user = await createUser({ password: null });
    vi.mocked(getCurrentUser).mockResolvedValue({ id: user.id, email: user.email });
    await createFavorite({ user: { connect: { id: user.id } } });

    const result = await deleteAccount(new FormData());

    expect(result).toEqual({ success: true });
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect(await prisma.favorite.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.alert.count({ where: { userId: user.id } })).toBe(0);
  });

  it("DATA-13: a row created by U but owned by V keeps existing, with createdById nulled, once U is deleted", async () => {
    const creator = await createUser({ email: "creator-data13@example.com", password: null });
    const owner = await createUser({ email: "owner-data13@example.com" });
    const favorite = await createFavorite({
      user: { connect: { id: owner.id } },
      createdById: creator.id,
    });
    vi.mocked(getCurrentUser).mockResolvedValue({ id: creator.id, email: creator.email });

    await deleteAccount(new FormData());

    const found = await prisma.favorite.findUnique({ where: { id: favorite.id } });
    expect(found).not.toBeNull();
    expect(found?.createdById).toBeNull();
  });
});

describe("DATA-14: system rows are still hard-deleted when pruned, never soft-deleted", () => {
  it("DATA-14: an expired password-reset token is gone, not soft-deleted, after the prune", async () => {
    const user = await createUser();
    const expired = await createPasswordResetToken({
      user: { connect: { id: user.id } },
      expiresAt: new Date(Date.now() - 1000),
    });

    await pruneExpiredAuthRows();

    expect(await prisma.passwordResetToken.count({ where: { id: expired.id } })).toBe(0);
  });
});
