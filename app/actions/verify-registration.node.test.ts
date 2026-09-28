import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { create: vi.fn() },
    pendingRegistration: { findUnique: vi.fn(), deleteMany: vi.fn() },
  },
}));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  getClientIp: vi.fn(async () => "203.0.113.1"),
  consumeRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 14,
    retryAfterMs: 0,
  })),
}));

import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";
import { hashToken } from "@/lib/auth/tokens";
import { verifyRegistration } from "./verify-registration";

const RAW_TOKEN = "a-raw-confirmation-token";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

function pendingRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "pending-1",
    email: "ada@example.com",
    password: "already-bcrypt-hashed",
    name: "Ada",
    tokenHash: hashToken(RAW_TOKEN),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    createdAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(prisma.pendingRegistration.findUnique).mockReset();
  vi.mocked(prisma.pendingRegistration.deleteMany).mockReset();
  vi.mocked(prisma.user.create).mockReset();
  vi.mocked(consumeRateLimit).mockResolvedValue({
    allowed: true,
    remaining: 14,
    retryAfterMs: 0,
  });
});

describe("verifyRegistration token handling", () => {
  it("looks the token up by its hash, never by the raw value", async () => {
    vi.mocked(prisma.pendingRegistration.findUnique).mockResolvedValue(pendingRecord() as never);

    await verifyRegistration(formData({ token: RAW_TOKEN }));

    expect(prisma.pendingRegistration.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashToken(RAW_TOKEN) },
    });
  });

  it("rejects a missing token", async () => {
    expect(await verifyRegistration(formData({ token: "" }))).toEqual({
      success: false,
      error: "tokenInvalid",
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("rejects a token with no pending signup", async () => {
    vi.mocked(prisma.pendingRegistration.findUnique).mockResolvedValue(null);

    expect(await verifyRegistration(formData({ token: RAW_TOKEN }))).toEqual({
      success: false,
      error: "tokenInvalid",
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("rejects an expired token", async () => {
    vi.mocked(prisma.pendingRegistration.findUnique).mockResolvedValue(
      pendingRecord({ expiresAt: new Date(Date.now() - 1000) }) as never,
    );

    expect(await verifyRegistration(formData({ token: RAW_TOKEN }))).toEqual({
      success: false,
      error: "tokenInvalid",
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("gives missing and expired tokens the same error", async () => {
    // Distinguishing them would tell a prober which tokens once existed.
    vi.mocked(prisma.pendingRegistration.findUnique).mockResolvedValue(null);
    const missing = await verifyRegistration(formData({ token: RAW_TOKEN }));

    vi.mocked(prisma.pendingRegistration.findUnique).mockResolvedValue(
      pendingRecord({ expiresAt: new Date(Date.now() - 1000) }) as never,
    );
    const expired = await verifyRegistration(formData({ token: RAW_TOKEN }));

    expect(missing).toEqual(expired);
  });

  it("refuses once the rate limit is exhausted", async () => {
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterMs: 60_000,
    });

    expect(await verifyRegistration(formData({ token: RAW_TOKEN }))).toEqual({
      success: false,
      error: "rateLimited",
    });
    expect(prisma.pendingRegistration.findUnique).not.toHaveBeenCalled();
  });
});

describe("verifyRegistration account creation", () => {
  beforeEach(() => {
    vi.mocked(prisma.pendingRegistration.findUnique).mockResolvedValue(pendingRecord() as never);
  });

  it("AUTH-2: creates the user from the stored hash and marks the email verified", async () => {
    const result = await verifyRegistration(formData({ token: RAW_TOKEN }));

    expect(result).toEqual({ success: true, email: "ada@example.com" });
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: "ada@example.com",
        // Reused as-is: the password was hashed at submit time, so
        // confirmation never has to ask for it again.
        password: "already-bcrypt-hashed",
        name: "Ada",
        emailVerified: expect.any(Date),
      },
    });
  });

  it("consumes every pending signup for that address", async () => {
    await verifyRegistration(formData({ token: RAW_TOKEN }));

    // Single use, and any sibling attempt on the same address dies with it.
    expect(prisma.pendingRegistration.deleteMany).toHaveBeenCalledWith({
      where: { email: "ada@example.com" },
    });
  });

  it("treats an address claimed in the meantime as already done", async () => {
    vi.mocked(prisma.user.create).mockRejectedValue(
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
    expect(prisma.pendingRegistration.deleteMany).toHaveBeenCalled();
  });

  it("returns a generic failure on an unexpected DB error, leaving the token", async () => {
    vi.mocked(prisma.user.create).mockRejectedValue(new Error("connection lost"));

    expect(await verifyRegistration(formData({ token: RAW_TOKEN }))).toEqual({
      success: false,
      error: "generic",
    });
    // The signup must survive so the user can retry the same link.
    expect(prisma.pendingRegistration.deleteMany).not.toHaveBeenCalled();
  });
});
