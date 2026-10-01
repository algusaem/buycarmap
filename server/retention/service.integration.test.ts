import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createUser } from "@/test/factories/user";
import { createFavorite } from "@/test/factories/favorite";
import { maybePruneExpiredAuthRows } from "@/server/auth/service";
import { purgeSoftDeletedRows } from "./service";

// DATA-12 (docs/specs/core-data-model.md): soft-deleted rows are erased 30
// days after deletedAt. `deletedAt` does not exist on any model yet
// (DATA-8/DATA-10), so every override below type-errors until the schema
// changes — expected and structural, per the spec's own framing.

const THIRTY_ONE_DAYS_MS = 31 * 24 * 60 * 60 * 1000;
const TWENTY_NINE_DAYS_MS = 29 * 24 * 60 * 60 * 1000;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("purgeSoftDeletedRows", () => {
  it("DATA-12 (worked example): a row deleted 31 days ago is purged; one deleted 29 days ago is kept", async () => {
    const user = await createUser();
    const now = new Date("2026-10-01T00:00:00.000Z");

    const stale = await createFavorite({
      user: { connect: { id: user.id } },
      deletedAt: new Date(now.getTime() - THIRTY_ONE_DAYS_MS),
    });
    const recent = await createFavorite({
      user: { connect: { id: user.id } },
      deletedAt: new Date(now.getTime() - TWENTY_NINE_DAYS_MS),
    });

    await purgeSoftDeletedRows(now);

    expect(await prisma.favorite.findUnique({ where: { id: stale.id } })).toBeNull();
    expect(await prisma.favorite.findUnique({ where: { id: recent.id } })).not.toBeNull();
  });
});

describe("maybePruneExpiredAuthRows also runs the soft-delete purge", () => {
  it("DATA-12: forcing a prune purges a favorite soft-deleted more than 30 days ago", async () => {
    const user = await createUser();
    const stale = await createFavorite({
      user: { connect: { id: user.id } },
      deletedAt: new Date(Date.now() - THIRTY_ONE_DAYS_MS),
    });
    vi.spyOn(Math, "random").mockReturnValue(0);

    await maybePruneExpiredAuthRows();

    expect(await prisma.favorite.findUnique({ where: { id: stale.id } })).toBeNull();
  });
});
