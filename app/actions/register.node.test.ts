import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the data + hashing dependencies; the action's own logic is the SUT.
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn() },
    pendingRegistration: { create: vi.fn(), deleteMany: vi.fn() },
  },
}));
vi.mock("@/lib/auth/hash", () => ({
  hashPassword: vi.fn(async (p: string) => `hashed:${p}`),
}));
// Toggled per describe block: the action takes a different path depending on
// whether email can actually be delivered.
vi.mock("@/lib/env", () => ({
  appUrl: "https://buycarmap.test",
  isEmailConfigured: true,
}));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  getClientIp: vi.fn(async () => "203.0.113.1"),
  consumeRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 4,
    retryAfterMs: 0,
  })),
}));
vi.mock("@/lib/email/client", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/i18n/server", () => ({ getLocale: vi.fn(async () => "en") }));

import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import * as env from "@/lib/env";
import { sendEmail } from "@/lib/email/client";
import { consumeRateLimit } from "@/lib/rate-limit";
import { hashToken } from "@/lib/auth/tokens";
import { register } from "./register";

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
  vi.spyOn(env, "isEmailConfigured", "get").mockReturnValue(configured);
}

beforeEach(() => {
  vi.mocked(prisma.user.findUnique).mockReset();
  vi.mocked(prisma.user.create).mockReset();
  vi.mocked(prisma.pendingRegistration.create).mockReset();
  vi.mocked(prisma.pendingRegistration.deleteMany).mockReset();
  vi.mocked(sendEmail).mockClear();
  vi.mocked(consumeRateLimit).mockClear();
  vi.mocked(consumeRateLimit).mockResolvedValue({
    allowed: true,
    remaining: 4,
    retryAfterMs: 0,
  });
});

describe("register input validation", () => {
  it("rejects mismatched passwords without touching the database", async () => {
    const result = await register(formData({ ...valid, confirmPassword: "different" }));

    expect(result).toEqual({
      success: false,
      error: "passwordsDoNotMatch",
    });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.pendingRegistration.create).not.toHaveBeenCalled();
  });

  it("rejects a password below the 12-character minimum", async () => {
    const short = "harbour1";

    expect(await register(formData({ ...valid, password: short, confirmPassword: short }))).toEqual(
      { success: false, error: "passwordTooShort" },
    );
  });

  it("rejects a long-but-trivial password on strength grounds", async () => {
    // Passes the length rule at 16 characters, but is a keyboard run — exactly
    // the case a length-only policy would wave through.
    const weak = "qwertyuiopasdfgh";

    expect(await register(formData({ ...valid, password: weak, confirmPassword: weak }))).toEqual({
      success: false,
      error: "passwordWeak",
    });
  });

  it("accepts a signup with no name field at all", async () => {
    setEmailConfigured(true);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    // The form omits `name` entirely when it is blank, so FormData.get returns
    // null. Zod's `.optional()` accepts undefined but rejects null, which made
    // every nameless signup fail with a raw untranslated Zod message. The
    // fixtures always set a name, which is exactly why this went unnoticed.
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
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    await register(
      formData({
        email: valid.email,
        password: valid.password,
        confirmPassword: valid.confirmPassword,
      }),
    );

    const stored = vi.mocked(prisma.pendingRegistration.create).mock.calls[0][0] as {
      data: { name: string | null };
    };
    expect(stored.data.name).toBeNull();
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
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});

describe("register with email configured (verify-first)", () => {
  beforeEach(() => setEmailConfigured(true));

  it("AUTH-1: creates no user, only a pending registration, for a free address", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const result = await register(formData(valid));

    expect(result).toEqual({ success: true, pending: true });
    // Nothing exists until the address is confirmed — that absence is what
    // makes the two outcomes indistinguishable.
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.pendingRegistration.create).toHaveBeenCalledOnce();
  });

  it("returns exactly the same result for a taken address", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const free = await register(formData(valid));

    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "1" } as never);
    const taken = await register(formData(valid));

    // The whole point: the caller cannot tell which case it hit.
    expect(taken).toEqual(free);
    expect(taken).toEqual({ success: true, pending: true });
  });

  it("AUTH-1: emails in both cases, so the send itself is not a signal", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    await register(formData(valid));
    expect(sendEmail).toHaveBeenCalledOnce();

    vi.mocked(sendEmail).mockClear();
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "1" } as never);
    await register(formData(valid));
    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it("sends a confirmation link to a free address", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    await register(formData(valid));

    const sent = vi.mocked(sendEmail).mock.calls[0][0];
    expect(sent.to).toBe("ada@example.com");
    expect(sent.text).toContain("https://buycarmap.test/verify-email?token=");
  });

  it("sends an account-already-exists notice to a taken address", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "1" } as never);

    await register(formData(valid));

    const sent = vi.mocked(sendEmail).mock.calls[0][0];
    expect(sent.to).toBe("ada@example.com");
    // Only the mailbox owner learns anything.
    expect(sent.text).toContain("You already have an account");
    expect(prisma.pendingRegistration.create).not.toHaveBeenCalled();
  });

  it("stores only the token's hash and the already-hashed password", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    await register(formData(valid));

    const stored = vi.mocked(prisma.pendingRegistration.create).mock.calls[0][0] as {
      data: { tokenHash: string; password: string; email: string };
    };
    const sent = vi.mocked(sendEmail).mock.calls[0][0];
    const tokenMatch = sent.text.match(/token=(\S+)/);
    if (!tokenMatch) throw new Error("expected a token in the emailed link");
    const rawToken = decodeURIComponent(tokenMatch[1]);

    // Hand-derived from the emailed link: proves the column holds a digest.
    expect(stored.data.tokenHash).toBe(hashToken(rawToken));
    expect(stored.data.tokenHash).not.toBe(rawToken);
    // What lands in the pending table is hashPassword's output, not the raw
    // password. (The stub's `hashed:` prefix keeps the plaintext visible, so a
    // substring check would prove nothing here — identity is the real claim.)
    expect(stored.data.password).toBe(`hashed:${STRONG_PASSWORD}`);
    expect(stored.data.password).not.toBe(STRONG_PASSWORD);
  });

  it("clears earlier pending signups so only one link stays live", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    await register(formData(valid));

    expect(prisma.pendingRegistration.deleteMany).toHaveBeenCalledWith({
      where: { email: "ada@example.com" },
    });
  });

  it("still reports the neutral result when the follow-up throws", async () => {
    vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error("database down"));

    // An error response would differ between the two branches and hand back
    // the oracle this design removes.
    expect(await register(formData(valid))).toEqual({
      success: true,
      pending: true,
    });
  });

  it("normalizes the email (trim + lowercase) before use", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    await register(formData({ ...valid, email: "  ADA@Example.COM " }));

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "ada@example.com" },
    });
  });
});

describe("register without email configured (fallback)", () => {
  beforeEach(() => setEmailConfigured(false));

  it("creates the user immediately", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({ id: "1" } as never);

    const result = await register(formData(valid));

    // `pending: false` tells the form to auto sign-in, since the account is
    // real and there is no confirmation step to wait for.
    expect(result).toEqual({ success: true, pending: false });
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: "ada@example.com",
        password: `hashed:${STRONG_PASSWORD}`,
        name: "Ada",
      },
    });
  });

  it("stores a null name when the field is submitted empty", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({ id: "1" } as never);

    await register(formData({ ...valid, name: "" }));

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: null }),
    });
  });

  it("reports a taken address, which is the leak this path accepts", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "1" } as never);

    // Documented trade: without a way to deliver a confirmation link, the
    // alternative is a deployment where nobody can register at all.
    expect(await register(formData(valid))).toEqual({
      success: false,
      error: "emailTaken",
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("maps a unique-constraint race (P2002) to the same taken-address error", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockRejectedValue(
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
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockRejectedValue(new Error("connection lost"));

    // No detail escapes, so internals stay unexposed.
    expect(await register(formData(valid))).toEqual({
      success: false,
      error: "generic",
    });
  });
});
