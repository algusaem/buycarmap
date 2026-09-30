import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createUser } from "@/test/factories/user";
import {
  createEmailVerificationToken,
  createPasswordResetToken,
} from "@/test/factories/auth-tokens";
import { maybePruneExpiredAuthRows, pruneExpiredAuthRows } from "./service";

async function createExpiredPendingRegistration() {
  return prisma.pendingRegistration.create({
    data: {
      email: "expired@example.test",
      password: "hashed",
      tokenHash: "expired-pending-hash",
      expiresAt: new Date(Date.now() - 1000),
    },
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("pruneExpiredAuthRows", () => {
  it("AUTH-15: deletes expired rows from all three token tables", async () => {
    const user = await createUser();
    await createExpiredPendingRegistration();
    await createPasswordResetToken({
      user: { connect: { id: user.id } },
      expiresAt: new Date(Date.now() - 1000),
    });
    await createEmailVerificationToken({
      user: { connect: { id: user.id } },
      expiresAt: new Date(Date.now() - 1000),
    });

    await pruneExpiredAuthRows();

    // `RateLimit` already self-pruned; these three grew without bound.
    expect(await prisma.pendingRegistration.count()).toBe(0);
    expect(await prisma.passwordResetToken.count()).toBe(0);
    expect(await prisma.emailVerificationToken.count()).toBe(0);
  });

  it("only targets rows whose expiry has already passed", async () => {
    const user = await createUser();
    // A live token must survive; deleting one would break a link mid-flight.
    const live = await createPasswordResetToken({
      user: { connect: { id: user.id } },
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    await pruneExpiredAuthRows();

    const found = await prisma.passwordResetToken.findUnique({ where: { id: live.id } });
    expect(found).not.toBeNull();
  });

  it("swallows a database failure", async () => {
    vi.spyOn(prisma.pendingRegistration, "deleteMany").mockRejectedValue(
      new Error("connection lost"),
    );

    // Housekeeping must never fail the request that happened to trigger it.
    await expect(pruneExpiredAuthRows()).resolves.toBeUndefined();
  });
});

describe("maybePruneExpiredAuthRows", () => {
  it("prunes when the sampled value falls under the threshold", async () => {
    await createExpiredPendingRegistration();
    vi.spyOn(Math, "random").mockReturnValue(0);

    await maybePruneExpiredAuthRows();

    expect(await prisma.pendingRegistration.count()).toBe(0);
  });

  it("does nothing on the overwhelming majority of calls", async () => {
    await createExpiredPendingRegistration();
    vi.spyOn(Math, "random").mockReturnValue(0.99);

    await maybePruneExpiredAuthRows();

    // Otherwise every token-issuing request would pay for three deletes.
    expect(await prisma.pendingRegistration.count()).toBe(1);
  });
});
