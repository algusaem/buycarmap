import { beforeEach, describe, expect, it, vi } from "vitest";

// The DB and bcrypt are dependencies; authorizeCredentials' branching is the SUT.
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/auth/hash", () => ({
  verifyPassword: vi.fn(),
  DUMMY_PASSWORD_HASH: "$2b$12$dummy",
}));
vi.mock("@/lib/auth/two-factor/verify", () => ({
  verifyAndConsumeTwoFactor: vi.fn(),
}));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  getClientIp: vi.fn(async () => "203.0.113.1"),
  consumeRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 19,
    retryAfterMs: 0,
  })),
  isRateLimited: vi.fn(async () => false),
  resetRateLimit: vi.fn(async () => undefined),
}));

import { prisma } from "@/lib/prisma";
import { verifyPassword, DUMMY_PASSWORD_HASH } from "@/lib/auth/hash";
import {
  consumeRateLimit,
  isRateLimited,
  resetRateLimit,
} from "@/lib/rate-limit";
import { verifyAndConsumeTwoFactor } from "@/lib/auth/two-factor/verify";
import { authorizeCredentials, loginEmailRateKey } from "./authorize";

const dbUser = {
  id: "u1",
  email: "ada@example.com",
  password: "$2b$12$storedhash",
  name: "Ada",
  image: "https://img/ada.png",
};

describe("authorizeCredentials", () => {
  beforeEach(() => {
    vi.mocked(prisma.user.findUnique).mockReset();
    vi.mocked(verifyPassword).mockReset();
    vi.mocked(consumeRateLimit).mockClear();
    vi.mocked(resetRateLimit).mockClear();
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 19,
      retryAfterMs: 0,
    });
    vi.mocked(isRateLimited).mockResolvedValue(false);
  });

  it("returns null and never queries when a field is missing", async () => {
    expect(await authorizeCredentials({ email: "", password: "x" })).toBeNull();
    expect(await authorizeCredentials(undefined)).toBeNull();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it("normalizes the email (trim + lowercase) before lookup", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never);

    await authorizeCredentials({ email: "  ADA@Example.COM ", password: "pw" });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "ada@example.com" },
    });
  });

  it("runs a dummy bcrypt compare for an unknown email (timing safe)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never);
    vi.mocked(verifyPassword).mockResolvedValue(false);

    const result = await authorizeCredentials({
      email: "ghost@example.com",
      password: "pw",
    });

    expect(result).toBeNull();
    // Must still hash against the dummy so timing matches the wrong-password path.
    expect(verifyPassword).toHaveBeenCalledWith("pw", DUMMY_PASSWORD_HASH);
  });

  it("returns null when the password does not match", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(dbUser as never);
    vi.mocked(verifyPassword).mockResolvedValue(false);

    const result = await authorizeCredentials({
      email: "ada@example.com",
      password: "wrong",
    });

    expect(result).toBeNull();
    expect(verifyPassword).toHaveBeenCalledWith("wrong", dbUser.password);
  });

  it("treats an OAuth-only account like a wrong password", async () => {
    // A null password means the account was created through a provider.
    // Saying so would confirm the address is registered.
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...dbUser,
      password: null,
    } as never);
    vi.mocked(verifyPassword).mockResolvedValue(false);

    const result = await authorizeCredentials({
      email: "ada@example.com",
      password: "anything",
    });

    expect(result).toBeNull();
    expect(verifyPassword).toHaveBeenCalledWith("anything", DUMMY_PASSWORD_HASH);
  });

  it("returns the mapped user on a correct password", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(dbUser as never);
    vi.mocked(verifyPassword).mockResolvedValue(true);

    const result = await authorizeCredentials({
      email: "ada@example.com",
      password: "correct",
    });

    expect(result).toEqual({
      id: "u1",
      email: "ada@example.com",
      name: "Ada",
      image: "https://img/ada.png",
    });
  });
});

describe("authorizeCredentials rate limiting", () => {
  beforeEach(() => {
    vi.mocked(prisma.user.findUnique).mockReset();
    vi.mocked(verifyPassword).mockReset();
    vi.mocked(consumeRateLimit).mockClear();
    vi.mocked(resetRateLimit).mockClear();
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 19,
      retryAfterMs: 0,
    });
    vi.mocked(isRateLimited).mockResolvedValue(false);
  });

  it("throws rateLimited when the per-IP budget is spent", async () => {
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterMs: 60_000,
    });

    // Thrown rather than returned as null: NextAuth surfaces the message to the
    // client, and "wait a few minutes" is actionable in a way that the generic
    // credentials error is not.
    await expect(
      authorizeCredentials({ email: "ada@example.com", password: "pw" }),
    ).rejects.toThrow("rateLimited");

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("throws rateLimited when the account is locked out, without querying", async () => {
    vi.mocked(isRateLimited).mockResolvedValue(true);

    await expect(
      authorizeCredentials({ email: "ada@example.com", password: "pw" }),
    ).rejects.toThrow("rateLimited");

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("AUTH-6: counts a failed attempt against the account", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(dbUser as never);
    vi.mocked(verifyPassword).mockResolvedValue(false);

    await authorizeCredentials({ email: "ada@example.com", password: "wrong" });

    expect(consumeRateLimit).toHaveBeenCalledWith(
      loginEmailRateKey("ada@example.com"),
      expect.objectContaining({ limit: 8 }),
    );
  });

  it("AUTH-6: clears the account's failure counter on a successful sign-in", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(dbUser as never);
    vi.mocked(verifyPassword).mockResolvedValue(true);

    await authorizeCredentials({
      email: "ada@example.com",
      password: "correct",
    });

    // Otherwise earlier typos would keep counting toward a lockout the user
    // has just demonstrably earned their way out of.
    expect(resetRateLimit).toHaveBeenCalledWith(
      loginEmailRateKey("ada@example.com"),
    );
  });

  it("does not count a successful sign-in as a failure", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(dbUser as never);
    vi.mocked(verifyPassword).mockResolvedValue(true);

    await authorizeCredentials({
      email: "ada@example.com",
      password: "correct",
    });

    const emailKeyCalls = vi
      .mocked(consumeRateLimit)
      .mock.calls.filter(
        ([key]) => key === loginEmailRateKey("ada@example.com"),
      );
    expect(emailKeyCalls).toHaveLength(0);
  });
});

describe("authorizeCredentials with two-factor enabled", () => {
  const twoFactorUser = {
    ...dbUser,
    twoFactorEnabledAt: new Date("2026-01-01"),
    twoFactorSecret: "encrypted-secret",
    twoFactorLastStep: null,
  };

  beforeEach(() => {
    vi.mocked(prisma.user.findUnique).mockReset();
    vi.mocked(verifyPassword).mockReset();
    vi.mocked(consumeRateLimit).mockClear();
    vi.mocked(resetRateLimit).mockClear();
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 9,
      retryAfterMs: 0,
    });
    vi.mocked(isRateLimited).mockResolvedValue(false);
    vi.mocked(verifyAndConsumeTwoFactor).mockReset();
  });

  it("AUTH-7: asks for a code when the password is right but none was given", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(twoFactorUser as never);
    vi.mocked(verifyPassword).mockResolvedValue(true);

    await expect(
      authorizeCredentials({ email: "ada@example.com", password: "correct" }),
    ).rejects.toThrow("totpRequired");
  });

  it("never asks for a code when the password is wrong", async () => {
    // Ordering matters: if this leaked before the password check, it would
    // reveal which accounts exist and have 2FA to anyone who can type an email.
    vi.mocked(prisma.user.findUnique).mockResolvedValue(twoFactorUser as never);
    vi.mocked(verifyPassword).mockResolvedValue(false);

    await expect(
      authorizeCredentials({ email: "ada@example.com", password: "wrong" }),
    ).resolves.toBeNull();
    expect(verifyAndConsumeTwoFactor).not.toHaveBeenCalled();
  });

  it("signs in when the code checks out", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(twoFactorUser as never);
    vi.mocked(verifyPassword).mockResolvedValue(true);
    vi.mocked(verifyAndConsumeTwoFactor).mockResolvedValue({
      valid: true,
      method: "totp",
    });

    await expect(
      authorizeCredentials({
        email: "ada@example.com",
        password: "correct",
        totp: "123456",
      }),
    ).resolves.toEqual({
      id: "u1",
      email: "ada@example.com",
      name: "Ada",
      image: "https://img/ada.png",
    });
  });

  it("rejects a wrong code and counts it as a failed attempt", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(twoFactorUser as never);
    vi.mocked(verifyPassword).mockResolvedValue(true);
    vi.mocked(verifyAndConsumeTwoFactor).mockResolvedValue({
      valid: false,
      method: null,
    });

    await expect(
      authorizeCredentials({
        email: "ada@example.com",
        password: "correct",
        totp: "000000",
      }),
    ).rejects.toThrow("totpInvalid");

    expect(consumeRateLimit).toHaveBeenCalledWith(
      loginEmailRateKey("ada@example.com"),
      expect.objectContaining({ limit: 8 }),
    );
  });

  it("bounds code guessing separately from password guessing", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(twoFactorUser as never);
    vi.mocked(verifyPassword).mockResolvedValue(true);
    vi.mocked(verifyAndConsumeTwoFactor).mockResolvedValue({
      valid: true,
      method: "totp",
    });

    await authorizeCredentials({
      email: "ada@example.com",
      password: "correct",
      totp: "123456",
    });

    expect(consumeRateLimit).toHaveBeenCalledWith(
      "two-factor:user:u1",
      expect.objectContaining({ limit: 10 }),
    );
  });

  it("refuses once the code rate limit is spent, without checking the code", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(twoFactorUser as never);
    vi.mocked(verifyPassword).mockResolvedValue(true);
    vi.mocked(consumeRateLimit).mockImplementation((async (key: string) => ({
      allowed: !key.startsWith("two-factor:"),
      remaining: 0,
      retryAfterMs: 60_000,
    })) as never);

    await expect(
      authorizeCredentials({
        email: "ada@example.com",
        password: "correct",
        totp: "123456",
      }),
    ).rejects.toThrow("rateLimited");
    expect(verifyAndConsumeTwoFactor).not.toHaveBeenCalled();
  });

  it("ignores a code for an account without two-factor", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(dbUser as never);
    vi.mocked(verifyPassword).mockResolvedValue(true);

    await expect(
      authorizeCredentials({
        email: "ada@example.com",
        password: "correct",
        totp: "123456",
      }),
    ).resolves.not.toBeNull();
    expect(verifyAndConsumeTwoFactor).not.toHaveBeenCalled();
  });
});
