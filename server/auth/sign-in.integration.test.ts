import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createUser } from "@/test/factories/user";
import { createRatelimitFake } from "@/test/fakes/ratelimit";
import { deriveCodeFromUri } from "@/test/two-factor-totp";

// BAUTH-3, harness change: the integration project runs with no Upstash
// configured (vitest.config.ts's `test.env` sets neither
// UPSTASH_REDIS_REST_URL nor UPSTASH_REDIS_REST_TOKEN), so
// lib/platform/rate-limit.ts's `consume`/`peek`/`reset` fail open — every
// call here would otherwise silently allow every attempt, and the lockout
// this file is about would never trip. `signIn` (./actions.ts) calls
// `consumeRateLimit`/`isRateLimited` without a `limiterFactory` of its own,
// so the fake is injected by wrapping the dependency
// (`@/lib/platform/rate-limit`) rather than the unit under test — every real
// caller still goes through the same `consume`/`peek`/`reset`, just backed by
// the in-memory fake instead of a real or absent Upstash client.
vi.mock("@/lib/platform/rate-limit", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/platform/rate-limit")>();
  const { factory } = createRatelimitFake();
  return {
    ...original,
    consume: (...args: Parameters<typeof original.consume>) =>
      original.consume(args[0], args[1], args[2] ?? factory),
    peek: (...args: Parameters<typeof original.peek>) =>
      original.peek(args[0], args[1], args[2] ?? factory),
    reset: (...args: Parameters<typeof original.reset>) =>
      original.reset(args[0], args[1] ?? factory),
  };
});

// BAUTH-11 (docs/specs/core-better-auth.md): `verifySignInTotp`/
// `verifySignInBackupCode` need a real two-factor challenge cookie in
// `headers()` — the signed identifier Better Auth's own `twoFactor` plugin
// hook set on the prior `/sign-in/email` call, via its own internal
// `nextCookies()`-forwarded `next/headers`. That forwarding goes through a
// dynamic `import("next/headers.js")` inside node_modules
// (better-auth/dist/integrations/next-js.mjs, working around
// https://github.com/better-auth/better-auth/issues/10466), which Vitest's
// `vi.mock("next/headers", …)` cannot intercept — only this file's own calls
// into `next/headers` get mocked, not a third-party package's internal one.
// So the challenge cookie is minted for real, through the actual HTTP route
// (`app/api/auth/[...all]/route.ts`), exactly as a browser's request would
// produce it; `cookieJar` below only has to carry that one real value
// through to `verifySignInTotp`/`verifySignInBackupCode`'s own `headers()`.
const cookieJar = new Map<string, string>();
vi.mock("next/headers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/headers")>()),
  cookies: vi.fn(async () => ({
    get: (name: string) => (cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined),
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
  })),
  headers: vi.fn(async () => {
    const cookieHeader = Array.from(cookieJar.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
    return new Headers(cookieHeader ? { cookie: cookieHeader } : {});
  }),
}));

vi.mock("@/server/rate-limit/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/rate-limit/service")>()),
  getClientIp: vi.fn(),
}));

// The fixtures below store a placeholder, not a real bcrypt hash of either
// password used in this file — this file is about the lockout and the
// two-factor gate, not bcrypt itself. Only the literal string
// "wrong-password" is treated as wrong.
vi.mock("@/lib/auth/hash", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/hash")>()),
  verifyPassword: vi.fn(async (password: string) => password !== "wrong-password"),
}));

import { getClientIp } from "@/server/rate-limit/service";
import { signIn, loginEmailRateKey, verifySignInBackupCode, verifySignInTotp } from "./actions";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  vi.mocked(getClientIp).mockReset();
  cookieJar.clear();
});

describe("BAUTH-3 worked example: the per-account lockout survives rotating IPs", () => {
  it("AUTH-6/BAUTH-3: 8 wrong passwords from 8 different IPs, then the 9th attempt is refused even with the right password", async () => {
    await createUser({ email: "ana@example.test", password: "$2b$12$storedhash" });

    for (let attempt = 0; attempt < 8; attempt++) {
      vi.mocked(getClientIp).mockResolvedValueOnce(`203.0.113.${attempt}`);
      await signIn(formData({ email: "ana@example.test", password: "wrong-password" }));
    }

    vi.mocked(getClientIp).mockResolvedValueOnce("203.0.113.9");
    const ninthAttempt = await signIn(
      formData({ email: "ana@example.test", password: "the-real-password" }),
    );

    // The generic failure, identical to a wrong password — never anything
    // that would tell the caller the account itself exists and is locked.
    expect(ninthAttempt).toEqual({ success: false, error: "rateLimited" });
  });

  it("BAUTH-3: the lockout key is per account, not per IP", () => {
    expect(loginEmailRateKey("ana@example.test")).toBe("login:email:ana@example.test");
  });

  it("returns the generic failure without a query when the email or password is blank", async () => {
    expect(await signIn(formData({ email: "", password: "whatever" }))).toEqual({
      success: false,
      error: "generic",
    });
    expect(await signIn(formData({ email: "ana@example.test", password: "" }))).toEqual({
      success: false,
      error: "generic",
    });
  });

  it("security review fix: 4 failed attempts leave room for the 5th, correct one to succeed", async () => {
    // `hooks.after` in lib/auth/auth.ts already counts a failed
    // /sign-in/email call once against `loginPerEmail`; `signIn`'s own catch
    // block used to consume the same budget a second time, so 4 real
    // failures were counted as 8 and tripped the limit (8) before a
    // legitimate 5th attempt ever got a chance.
    await createUser({ email: "beatriz@example.test", password: "$2b$12$storedhash" });

    for (let attempt = 0; attempt < 4; attempt++) {
      vi.mocked(getClientIp).mockResolvedValueOnce(`203.0.113.${100 + attempt}`);
      await signIn(formData({ email: "beatriz@example.test", password: "wrong-password" }));
    }

    vi.mocked(getClientIp).mockResolvedValueOnce("203.0.113.104");
    const fifthAttempt = await signIn(
      formData({ email: "beatriz@example.test", password: "the-real-password" }),
    );

    expect(fifthAttempt).toEqual({ success: true });
  });
});

/**
 * Enrols a real, verified two-factor secret directly through the plugin,
 * with its own explicit session header — independent of the `signIn`/
 * `verifySignInTotp` actions under test, and of this file's `cookieJar` mock,
 * which exists only for those actions' own `cookies()`/`headers()` calls.
 */
async function enrolRealTwoFactorFor(userId: string) {
  const { auth, createSessionCookie } = await import("@/lib/auth/auth");
  const cookie = await createSessionCookie(userId);
  const sessionHeaders = new Headers({ cookie: `${cookie.name}=${cookie.value}` });

  const enabled = await auth.api.enableTwoFactor({
    body: { password: "correct" },
    headers: sessionHeaders,
  });
  if (enabled.method !== "totp" || !enabled.totpURI) {
    throw new Error("expected a TOTP enrolment");
  }
  await auth.api.verifyTOTP({
    body: { code: deriveCodeFromUri(enabled.totpURI) },
    headers: sessionHeaders,
  });

  return enabled;
}

/**
 * The real two-factor challenge cookie (`name=value`) a correct password
 * produces for a two-factor account — minted through the actual HTTP route,
 * not through `signIn` (see the module comment above for why), then dropped
 * into `cookieJar` so `verifySignInTotp`/`verifySignInBackupCode`'s own
 * `headers()` carries it, exactly as a browser would on the next request.
 */
async function requestTwoFactorChallenge(email: string, password: string): Promise<void> {
  const { POST } = await import("@/app/api/auth/[...all]/route");
  const request = new NextRequest("http://localhost:3000/api/auth/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const response = await POST(request);
  const body = (await response.json()) as { twoFactorRedirect?: boolean };
  if (!body.twoFactorRedirect) {
    throw new Error("expected a two-factor challenge, got a session instead");
  }

  const setCookie = response.headers.get("set-cookie") ?? "";
  const match = setCookie.match(/(better-auth\.two_factor)=([^;]+)/);
  if (!match) {
    throw new Error("expected a two-factor challenge cookie in the response");
  }
  cookieJar.set(match[1], match[2]);
}

describe("BAUTH-3/BAUTH-11: two-factor accounts stop short of a session", () => {
  it("BAUTH-3 (AUTH-7, carried over): a correct password alone resolves twoFactorRequired rather than signing in", async () => {
    vi.mocked(getClientIp).mockResolvedValue("203.0.113.1");
    const user = await createUser({ email: "ada@example.test", password: "$2b$12$storedhash" });
    // This file's `verifyPassword` mock makes any password other than the
    // literal string "wrong-password" correct.
    await enrolRealTwoFactorFor(user.id);

    const result = await signIn(formData({ email: "ada@example.test", password: "correct" }));

    expect(result).toEqual({ success: false, twoFactorRequired: true });
  });

  it("AUTH-9: verifySignInTotp finishes the sign-in with a valid code", async () => {
    vi.mocked(getClientIp).mockResolvedValue("203.0.113.2");
    const user = await createUser({ email: "beth@example.test", password: "$2b$12$storedhash" });
    const enabled = await enrolRealTwoFactorFor(user.id);
    if (!enabled.totpURI) throw new Error("expected a TOTP enrolment");

    await requestTwoFactorChallenge("beth@example.test", "correct");

    const result = await verifySignInTotp(
      formData({ email: "beth@example.test", code: deriveCodeFromUri(enabled.totpURI) }),
    );

    expect(result).toEqual({ success: true });
  });

  it("AUTH-10: verifySignInBackupCode accepts a recovery code, and only once", async () => {
    vi.mocked(getClientIp).mockResolvedValue("203.0.113.3");
    const user = await createUser({ email: "cora@example.test", password: "$2b$12$storedhash" });
    const enabled = await enrolRealTwoFactorFor(user.id);
    const recoveryCode = enabled.backupCodes[0];

    await requestTwoFactorChallenge("cora@example.test", "correct");
    const result = await verifySignInBackupCode(
      formData({ email: "cora@example.test", code: recoveryCode }),
    );
    expect(result).toEqual({ success: true });

    // A second sign-in, then the same recovery code must not work again.
    await requestTwoFactorChallenge("cora@example.test", "correct");
    const replay = await verifySignInBackupCode(
      formData({ email: "cora@example.test", code: recoveryCode }),
    );
    expect(replay).toEqual({ success: false, error: "totpInvalid" });
  });

  it("rejects an empty code without looking up the account", async () => {
    vi.mocked(getClientIp).mockResolvedValue("203.0.113.4");

    const result = await verifySignInTotp(formData({ email: "nobody@example.test", code: "" }));

    expect(result).toEqual({ success: false, error: "totpInvalid" });
  });

  it("surfaces the plugin's own lockout as rateLimited after five wrong codes on one challenge", async () => {
    vi.mocked(getClientIp).mockResolvedValue("203.0.113.5");
    const user = await createUser({ email: "dina@example.test", password: "$2b$12$storedhash" });
    await enrolRealTwoFactorFor(user.id);
    await requestTwoFactorChallenge("dina@example.test", "correct");

    // Better Auth's own `twoFactor` plugin invalidates a sign-in challenge
    // once 5 wrong attempts have been recorded against it
    // (verify-two-factor.mjs's `beginAttempt(5)`, checked before the 6th),
    // surfacing as `TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE` — mapped onto
    // `rateLimited`, not `totpInvalid`, so the UI tells the user to request a
    // fresh code rather than keep guessing against a cookie that is already dead.
    let last: Awaited<ReturnType<typeof verifySignInTotp>> | undefined;
    for (let attempt = 0; attempt < 6; attempt++) {
      last = await verifySignInTotp(formData({ email: "dina@example.test", code: "000000" }));
    }

    expect(last).toEqual({ success: false, error: "rateLimited" });
  });

  it("BAUTH-3: an unknown address and a registered address get identical responses after 11 attempts without a 2FA cookie", async () => {
    // Security review fix: verifySignInTotp/verifySignInBackupCode no longer
    // take or look up an email at all, so a real account and a nonexistent
    // one must be indistinguishable through this challenge — there is no
    // branch left that could tell them apart. Each loop uses its own IP so
    // the per-IP budget (20 per 15 min) from one does not bleed into the
    // other's results.
    vi.mocked(getClientIp).mockResolvedValue("203.0.113.30");
    await createUser({ email: "registered-victim@example.test", password: "$2b$12$storedhash" });

    const unknownResults: Awaited<ReturnType<typeof verifySignInTotp>>[] = [];
    for (let attempt = 0; attempt < 11; attempt++) {
      unknownResults.push(
        await verifySignInTotp(formData({ email: "unknown@example.test", code: "000000" })),
      );
    }

    vi.mocked(getClientIp).mockResolvedValue("203.0.113.31");
    const registeredResults: Awaited<ReturnType<typeof verifySignInTotp>>[] = [];
    for (let attempt = 0; attempt < 11; attempt++) {
      registeredResults.push(
        await verifySignInTotp(
          formData({ email: "registered-victim@example.test", code: "000000" }),
        ),
      );
    }

    expect(registeredResults).toEqual(unknownResults);
  });
});
