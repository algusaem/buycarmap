import { beforeEach, describe, expect, it, vi } from "vitest";

// docs/specs/core-integrations.md, INT-10: the housekeeping this module runs
// opportunistically is meant to move inside next/server's after(), so it
// never delays the response that happens to trigger it. Mocked before any
// other import so every call in this file sees the mock, not the real
// (no-op in tests) implementation.
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/server/retention/service", () => ({ purgeSoftDeletedRows: vi.fn(async () => 0) }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { after } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { purgeSoftDeletedRows } from "@/server/retention/service";
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
  // `vi.restoreAllMocks()` only restores spies created with `vi.spyOn`; the
  // mocked `after` import (set up by the `vi.mock("next/server", ...)` call
  // above) is a plain `vi.fn()` whose call history would otherwise keep
  // growing across every test in this file.
  vi.mocked(after).mockClear();
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

    // INT-10 (docs/specs/core-integrations.md): the housekeeping now runs
    // inside after() instead of inline, so the call above only registers
    // it — invoke the captured callback to actually run it.
    const [callback] = vi.mocked(after).mock.calls[0] as [() => Promise<void>];
    await callback();

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

describe("INT-10 (docs/specs/core-integrations.md): housekeeping runs inside after()", () => {
  it("INT-10: registers the housekeeping through after() instead of awaiting it inline", async () => {
    await createExpiredPendingRegistration();
    vi.spyOn(Math, "random").mockReturnValue(0);

    await maybePruneExpiredAuthRows();

    expect(after).toHaveBeenCalledTimes(1);
    const [callback] = vi.mocked(after).mock.calls[0] as [() => Promise<void>];
    expect(typeof callback).toBe("function");
    // The whole point of after(): the response-triggering call must return
    // before the housekeeping itself has run.
    expect(await prisma.pendingRegistration.count()).toBe(1);

    await callback();

    expect(await prisma.pendingRegistration.count()).toBe(0);
  });

  it("INT-10: a failure inside the after() callback is logged, never rethrown", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.mocked(purgeSoftDeletedRows).mockRejectedValueOnce(new Error("boom"));
    vi.mocked(logger.error).mockClear();

    await maybePruneExpiredAuthRows();

    expect(after).toHaveBeenCalledTimes(1);
    const [callback] = vi.mocked(after).mock.calls[0] as [() => Promise<void>];

    await expect(callback()).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });
});
