import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { hashToken } from "@/lib/auth/tokens";
import { createPendingRegistration } from "@/test/factories/auth-tokens";

vi.mock("@/server/rate-limit/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/rate-limit/service")>()),
  getClientIp: vi.fn(async () => "203.0.113.1"),
  consumeRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 14,
    retryAfterMs: 0,
  })),
}));

import { consumeRateLimit } from "@/server/rate-limit/service";
import { verifyRegistration } from "./actions";

const RAW_TOKEN = "a-raw-confirmation-token";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

async function seedPending(overrides: { expiresAt?: Date } = {}) {
  return createPendingRegistration({
    email: "ada@example.com",
    password: "already-bcrypt-hashed",
    name: "Ada",
    tokenHash: hashToken(RAW_TOKEN),
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000),
  });
}

beforeEach(() => {
  vi.mocked(consumeRateLimit).mockResolvedValue({
    allowed: true,
    remaining: 14,
    retryAfterMs: 0,
  });
});

describe("verifyRegistration token handling", () => {
  it("looks the token up by its hash, never by the raw value", async () => {
    await seedPending();
    const spy = vi.spyOn(prisma.pendingRegistration, "findUnique");

    await verifyRegistration(formData({ token: RAW_TOKEN }));

    expect(spy).toHaveBeenCalledWith({ where: { tokenHash: hashToken(RAW_TOKEN) } });
    spy.mockRestore();
  });

  it("rejects a missing token", async () => {
    expect(await verifyRegistration(formData({ token: "" }))).toEqual({
      success: false,
      error: "tokenInvalid",
    });
    expect(await prisma.user.count()).toBe(0);
  });

  it("rejects a token with no pending signup", async () => {
    expect(await verifyRegistration(formData({ token: RAW_TOKEN }))).toEqual({
      success: false,
      error: "tokenInvalid",
    });
    expect(await prisma.user.count()).toBe(0);
  });

  it("rejects an expired token", async () => {
    await seedPending({ expiresAt: new Date(Date.now() - 1000) });

    expect(await verifyRegistration(formData({ token: RAW_TOKEN }))).toEqual({
      success: false,
      error: "tokenInvalid",
    });
    expect(await prisma.user.count()).toBe(0);
  });

  it("gives missing and expired tokens the same error", async () => {
    // Distinguishing them would tell a prober which tokens once existed.
    const missing = await verifyRegistration(formData({ token: RAW_TOKEN }));

    await seedPending({ expiresAt: new Date(Date.now() - 1000) });
    const expired = await verifyRegistration(formData({ token: RAW_TOKEN }));

    expect(missing).toEqual(expired);
  });

  it("refuses once the rate limit is exhausted", async () => {
    await seedPending();
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterMs: 60_000,
    });

    expect(await verifyRegistration(formData({ token: RAW_TOKEN }))).toEqual({
      success: false,
      error: "rateLimited",
    });
    expect(await prisma.user.count()).toBe(0);
  });
});

describe("verifyRegistration account creation", () => {
  it("AUTH-2: creates the user from the stored hash and marks the email verified", async () => {
    await seedPending();

    const result = await verifyRegistration(formData({ token: RAW_TOKEN }));

    expect(result).toEqual({ success: true, email: "ada@example.com" });
    const [user] = await prisma.user.findMany();
    expect(user).toMatchObject({
      email: "ada@example.com",
      // Reused as-is: the password was hashed at submit time, so
      // confirmation never has to ask for it again.
      password: "already-bcrypt-hashed",
      name: "Ada",
    });
    expect(user.emailVerified).not.toBeNull();
  });

  it("consumes every pending signup for that address", async () => {
    await seedPending();

    await verifyRegistration(formData({ token: RAW_TOKEN }));

    // Single use, and any sibling attempt on the same address dies with it.
    expect(await prisma.pendingRegistration.count({ where: { email: "ada@example.com" } })).toBe(0);
  });

  it("treats an address claimed in the meantime as already done", async () => {
    await seedPending();
    const { Prisma } = await import("@/app/generated/prisma/client");
    vi.spyOn(prisma.user, "create").mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    // Whoever holds this mailbox can sign in either way, so surfacing an error
    // would only confuse them.
    expect(await verifyRegistration(formData({ token: RAW_TOKEN }))).toEqual({
      success: true,
      email: "ada@example.com",
    });
    expect(await prisma.pendingRegistration.count({ where: { email: "ada@example.com" } })).toBe(0);
  });

  it("returns a generic failure on an unexpected DB error, leaving the token", async () => {
    await seedPending();
    vi.spyOn(prisma.user, "create").mockRejectedValueOnce(new Error("connection lost"));

    expect(await verifyRegistration(formData({ token: RAW_TOKEN }))).toEqual({
      success: false,
      error: "generic",
    });
    // The signup must survive so the user can retry the same link.
    expect(await prisma.pendingRegistration.count({ where: { email: "ada@example.com" } })).toBe(1);
  });
});

// BAUTH-7 (docs/specs/core-better-auth.md): registration keeps its own
// server action, token table and behaviour (AUTH-1, 2), but once confirmed
// it must now also create the Better Auth `credential` account row and sign
// the new user in through a real session. `accounts.password` does not exist
// on this database until the migration lands, so the raw query below throws
// rather than returning an empty result — that thrown error is this test's
// red state today, not a clean assertion mismatch.
describe("BAUTH-7: confirming a registration creates a credential account and a session", () => {
  it("BAUTH-7: one credential account row with the stored hash, and one session, for the new user", async () => {
    await seedPending();

    const result = await verifyRegistration(formData({ token: RAW_TOKEN }));
    expect(result).toEqual({ success: true, email: "ada@example.com" });

    const user = await prisma.user.findUniqueOrThrow({ where: { email: "ada@example.com" } });

    const accounts = await prisma.$queryRaw<
      { provider: string; provider_account_id: string; password: string }[]
    >`SELECT provider, provider_account_id, password FROM accounts WHERE provider_account_id = ${user.id} AND provider = 'credential'`;

    expect(accounts).toHaveLength(1);
    // Reused as-is: the password was hashed at submit time (AUTH-2), so
    // confirmation never has to ask for it again.
    expect(accounts[0]?.password).toBe("already-bcrypt-hashed");

    const sessions = await prisma.$queryRaw<{ user_id: string }[]>`
      SELECT user_id FROM sessions WHERE user_id = ${user.id}
    `;

    expect(sessions.length).toBeGreaterThan(0);
  });
});
