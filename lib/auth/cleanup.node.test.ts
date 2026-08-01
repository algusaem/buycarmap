import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pendingRegistration: { deleteMany: vi.fn() },
    passwordResetToken: { deleteMany: vi.fn() },
    emailVerificationToken: { deleteMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { maybePruneExpiredAuthRows, pruneExpiredAuthRows } from "./cleanup";

beforeEach(() => {
  vi.mocked(prisma.pendingRegistration.deleteMany).mockReset();
  vi.mocked(prisma.passwordResetToken.deleteMany).mockReset();
  vi.mocked(prisma.emailVerificationToken.deleteMany).mockReset();
  vi.restoreAllMocks();
});

describe("pruneExpiredAuthRows", () => {
  it("deletes expired rows from all three token tables", async () => {
    await pruneExpiredAuthRows();

    // `RateLimit` already self-pruned; these three grew without bound.
    for (const table of [
      prisma.pendingRegistration,
      prisma.passwordResetToken,
      prisma.emailVerificationToken,
    ]) {
      expect(table.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lte: expect.any(Date) } },
      });
    }
  });

  it("only targets rows whose expiry has already passed", async () => {
    await pruneExpiredAuthRows();

    const call = vi.mocked(prisma.pendingRegistration.deleteMany).mock
      .calls[0][0] as { where: { expiresAt: { lte: Date } } };

    // A live token must survive; deleting one would break a link mid-flight.
    expect(call.where.expiresAt.lte.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("swallows a database failure", async () => {
    vi.mocked(prisma.pendingRegistration.deleteMany).mockRejectedValue(
      new Error("connection lost"),
    );

    // Housekeeping must never fail the request that happened to trigger it.
    await expect(pruneExpiredAuthRows()).resolves.toBeUndefined();
  });
});

describe("maybePruneExpiredAuthRows", () => {
  it("prunes when the sampled value falls under the threshold", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    await maybePruneExpiredAuthRows();

    expect(prisma.pendingRegistration.deleteMany).toHaveBeenCalled();
  });

  it("does nothing on the overwhelming majority of calls", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);

    await maybePruneExpiredAuthRows();

    // Otherwise every token-issuing request would pay for three deletes.
    expect(prisma.pendingRegistration.deleteMany).not.toHaveBeenCalled();
  });
});
