import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { hashToken } from "@/lib/auth/tokens";
import { createUser } from "@/test/factories/user";

vi.mock("@/lib/auth/hash", () => ({
  hashPassword: vi.fn(async (p: string) => `hashed:${p}`),
}));
// Toggled per describe block: the action takes a different path depending on
// whether email can actually be delivered.
vi.mock("@/lib/app-config", () => ({
  appUrl: "https://buycarmap.test",
  isEmailConfigured: true,
}));
vi.mock("@/server/rate-limit/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/rate-limit/service")>()),
  getClientIp: vi.fn(async () => "203.0.113.1"),
  consumeRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 4,
    retryAfterMs: 0,
  })),
}));
vi.mock("@/lib/email/client", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/i18n/server", () => ({ getLocale: vi.fn(async () => "en") }));

import * as appConfig from "@/lib/app-config";
import { sendEmail } from "@/lib/email/client";
import { consumeRateLimit } from "@/server/rate-limit/service";
import { register } from "./actions";

function formData(fields: Record<string, string | undefined>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) fd.set(key, value);
  }
  return fd;
}

// Clears the 12-character floor and the strength scorer. The MSW default
// reports it as unbreached.
const STRONG_PASSWORD = "harbour-lentil-quilt";

const valid = {
  name: "Ada",
  email: "ada@example.com",
  password: STRONG_PASSWORD,
  confirmPassword: STRONG_PASSWORD,
};

function setEmailConfigured(configured: boolean) {
  vi.spyOn(appConfig, "isEmailConfigured", "get").mockReturnValue(configured);
}

beforeEach(() => {
  vi.mocked(sendEmail).mockClear();
  vi.mocked(consumeRateLimit).mockClear();
  vi.mocked(consumeRateLimit).mockResolvedValue({
    allowed: true,
    remaining: 4,
    retryAfterMs: 0,
  });
});

describe("register input validation", () => {
  it("accepts a signup with no name field at all", async () => {
    setEmailConfigured(true);

    // The form omits `name` entirely when it is blank, so FormData.get returns
    // null. Zod's `.optional()` accepts undefined but rejects null, which made
    // every nameless signup fail with a raw untranslated Zod message.
    const result = await register(
      formData({
        email: valid.email,
        password: valid.password,
        confirmPassword: valid.confirmPassword,
      }),
    );

    expect(result).toEqual({ success: true, pending: true });
  });

  it("stores a null name when the field is omitted", async () => {
    setEmailConfigured(true);

    await register(
      formData({
        email: valid.email,
        password: valid.password,
        confirmPassword: valid.confirmPassword,
      }),
    );

    const [stored] = await prisma.pendingRegistration.findMany();
    expect(stored.name).toBeNull();
  });

  it("refuses when the rate limit is exhausted, before any bcrypt work", async () => {
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterMs: 60_000,
    });

    expect(await register(formData(valid))).toEqual({
      success: false,
      error: "rateLimited",
    });
    // Unlimited hashing here would make signup a CPU-exhaustion vector.
    expect(await prisma.pendingRegistration.count()).toBe(0);
  });
});

describe("register with email configured (verify-first)", () => {
  beforeEach(() => setEmailConfigured(true));

  it("AUTH-1: creates no user, only a pending registration, for a free address", async () => {
    const result = await register(formData(valid));

    expect(result).toEqual({ success: true, pending: true });
    // Nothing exists until the address is confirmed — that absence is what
    // makes the two outcomes indistinguishable.
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.pendingRegistration.count()).toBe(1);
  });

  it("returns exactly the same result for a taken address", async () => {
    const free = await register(formData(valid));

    await createUser({ email: valid.email });
    const taken = await register(formData(valid));

    // The whole point: the caller cannot tell which case it hit.
    expect(taken).toEqual(free);
    expect(taken).toEqual({ success: true, pending: true });
  });

  it("AUTH-1: emails in both cases, so the send itself is not a signal", async () => {
    await register(formData(valid));
    expect(sendEmail).toHaveBeenCalledOnce();

    vi.mocked(sendEmail).mockClear();
    await createUser({ email: valid.email });
    await register(formData(valid));
    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it("sends a confirmation link to a free address", async () => {
    await register(formData(valid));

    const sent = vi.mocked(sendEmail).mock.calls[0][0];
    expect(sent.to).toBe("ada@example.com");
    expect(sent.text).toContain("https://buycarmap.test/verify-email?token=");
  });

  it("sends an account-already-exists notice to a taken address", async () => {
    await createUser({ email: valid.email });

    await register(formData(valid));

    const sent = vi.mocked(sendEmail).mock.calls[0][0];
    expect(sent.to).toBe("ada@example.com");
    // Only the mailbox owner learns anything.
    expect(sent.text).toContain("You already have an account");
    expect(await prisma.pendingRegistration.count()).toBe(0);
  });

  it("stores only the token's hash and the already-hashed password", async () => {
    await register(formData(valid));

    const [stored] = await prisma.pendingRegistration.findMany();
    const sent = vi.mocked(sendEmail).mock.calls[0][0];
    const tokenMatch = sent.text.match(/token=(\S+)/);
    if (!tokenMatch) throw new Error("expected a token in the emailed link");
    const rawToken = decodeURIComponent(tokenMatch[1]);

    // Hand-derived from the emailed link: proves the column holds a digest.
    expect(stored.tokenHash).toBe(hashToken(rawToken));
    expect(stored.tokenHash).not.toBe(rawToken);
    expect(stored.password).toBe(`hashed:${STRONG_PASSWORD}`);
    expect(stored.password).not.toBe(STRONG_PASSWORD);
  });

  it("clears earlier pending signups so only one link stays live", async () => {
    await prisma.pendingRegistration.create({
      data: {
        email: "ada@example.com",
        password: "hashed:old",
        tokenHash: "old-token-hash",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    await register(formData(valid));

    expect(await prisma.pendingRegistration.count()).toBe(1);
  });

  it("still reports the neutral result when the follow-up throws", async () => {
    vi.spyOn(prisma.user, "findUnique").mockRejectedValueOnce(new Error("database down"));

    // An error response would differ between the two branches and hand back
    // the oracle this design removes.
    expect(await register(formData(valid))).toEqual({
      success: true,
      pending: true,
    });
  });

  it("normalizes the email (trim + lowercase) before use", async () => {
    await register(formData({ ...valid, email: "  ADA@Example.COM " }));

    const [stored] = await prisma.pendingRegistration.findMany();
    expect(stored.email).toBe("ada@example.com");
  });
});

describe("register without email configured (fallback)", () => {
  beforeEach(() => setEmailConfigured(false));

  it("creates the user immediately", async () => {
    const result = await register(formData(valid));

    // `pending: false` tells the form to auto sign-in, since the account is
    // real and there is no confirmation step to wait for.
    expect(result).toEqual({ success: true, pending: false });
    const [user] = await prisma.user.findMany();
    expect(user).toMatchObject({
      email: "ada@example.com",
      password: `hashed:${STRONG_PASSWORD}`,
      name: "Ada",
    });
  });

  it("stores a null name when the field is submitted empty", async () => {
    await register(formData({ ...valid, name: "" }));

    const [user] = await prisma.user.findMany();
    expect(user.name).toBeNull();
  });

  it("reports a taken address, which is the leak this path accepts", async () => {
    await createUser({ email: valid.email });

    // Documented trade: without a way to deliver a confirmation link, the
    // alternative is a deployment where nobody can register at all.
    expect(await register(formData(valid))).toEqual({
      success: false,
      error: "emailTaken",
    });
    expect(await prisma.user.count()).toBe(1);
  });

  it("maps a unique-constraint race (P2002) to the same taken-address error", async () => {
    const { Prisma } = await import("@/app/generated/prisma/client");
    vi.spyOn(prisma.user, "create").mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    expect(await register(formData(valid))).toEqual({
      success: false,
      error: "emailTaken",
    });
  });

  it("returns a generic failure on an unexpected DB error", async () => {
    vi.spyOn(prisma.user, "create").mockRejectedValueOnce(new Error("connection lost"));

    // No detail escapes, so internals stay unexposed.
    expect(await register(formData(valid))).toEqual({
      success: false,
      error: "generic",
    });
  });
});
