import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
// Imported before anything that might transitively import
// @/lib/platform/rate-limit (RATE_LIMITS below does) — the vi.mock factory
// just past this calls `createRatelimitFake()`, so its binding must already
// be initialized by the time that transitive import first resolves the
// mocked module.
import { createRatelimitFake } from "@/test/fakes/ratelimit";
import { createUser } from "@/test/factories/user";
import { hashPassword } from "@/lib/auth/hash";
import { prisma } from "@/lib/db/prisma";
import { RATE_LIMITS, consumeRateLimit } from "@/server/rate-limit/service";
import { loginEmailRateKey } from "@/server/auth/service";

// BAUTH-6 (docs/specs/core-better-auth.md), HTTP half, rewritten after the
// 2026-10-04 security review. app/api/auth/[...all]/route.ts forwards
// directly to lib/auth/auth.ts's real Better Auth instance — it is not the
// 501 stub this file used to describe.
//
// The in-memory limiter fake (test/fakes/ratelimit.ts) is injected the same
// way server/auth/sign-in.integration.test.ts does: the integration project
// runs with no Upstash configured, so lib/platform/rate-limit.ts's
// consume/peek/reset fail open and the lockout below would never trip
// without it.
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

const BASE_URL = "http://localhost:3000";

import { auth } from "@/lib/auth/auth";
import { GET, POST } from "./route";

function call(
  method: "GET" | "POST",
  path: string,
  // `unknown`, not `string`: BAUTH-9's idToken test below needs a nested
  // object (`idToken: { token }`), not just flat string fields.
  body?: Record<string, unknown>,
): Promise<Response> {
  const request = new NextRequest(`${BASE_URL}/api/auth${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return method === "GET" ? GET(request) : POST(request);
}

/**
 * A disabled path straight off `auth.options.disabledPaths` is a route
 * *pattern* (e.g. `/reset-password/:token`) — substituting a concrete value
 * for every `:param` segment is what actually makes it a requestable URL.
 */
function concreteUrl(pattern: string): string {
  return pattern.replace(/:[^/]+/g, "a-concrete-value");
}

describe("BAUTH-6: every disabled path is refused with 404", () => {
  const disabledPaths = [...auth.options.disabledPaths];

  // Sanity: the allowlist amendment disables far more than the original six
  // flows (session management, /two-factor/*, /link-social,
  // /change-password, …) — this would also catch the list collapsing back
  // to empty.
  it("BAUTH-6: the instance actually has paths to disable", () => {
    expect(disabledPaths.length).toBeGreaterThan(20);
  });

  it.each(disabledPaths)("BAUTH-6: GET %s is refused with 404", async (path) => {
    // GET regardless of the path's real method: when GET matches no
    // registered endpoint for a path, Better Auth's router 404s on its own,
    // before any hook runs. When it does match, lib/auth/auth.ts's
    // `hooks.before` catch-all still refuses it, but only runs *after* the
    // router has already matched the request's method and path to that
    // specific endpoint — not ahead of that matching — so either way the
    // method never changes the outcome for a disabled path.
    const response = await call("GET", concreteUrl(path));

    expect(response.status).toBe(404);
  });

  // The regression this amendment fixes: Better Auth's own `disabledPaths`
  // check compares the raw request URL against the disabled list as a
  // literal string, which never matches a parameterized route — a concrete
  // request like `/reset-password/<a-real-token>` used to sail straight past
  // `disabledPaths.includes("/reset-password/:token")` and reach the real
  // handler (confirmed against this same route before lib/auth/auth.ts's
  // `hooks.before` catch-all existed: it reached Better Auth's own token
  // lookup instead of being refused). The `it.each` above already covers
  // this path along with every other one, but it is named explicitly here
  // since it is the one disabled path this file specifically regresses on.
  it("BAUTH-6: GET /reset-password/:token with a concrete token is refused with 404, not processed", async () => {
    const response = await call(
      "GET",
      "/reset-password/a-concrete-value?callbackURL=%2Freset-password",
    );

    expect(response.status).toBe(404);
  });
});

describe("BAUTH-6: /sign-in/email keeps the per-account lockout", () => {
  it(`BAUTH-6 worked example: ${RATE_LIMITS.loginPerEmail.limit} wrong passwords lock out the 9th attempt even with the right password`, async () => {
    expect(RATE_LIMITS.loginPerEmail.limit).toBe(8);

    const realPasswordHash = await hashPassword("the-real-password");
    await createUser({ email: "ana@example.test", password: realPasswordHash });

    for (let attempt = 0; attempt < RATE_LIMITS.loginPerEmail.limit; attempt++) {
      await call("POST", "/sign-in/email", {
        email: "ana@example.test",
        password: "wrong-password",
      });
    }

    const ninthAttempt = await call("POST", "/sign-in/email", {
      email: "ana@example.test",
      password: "the-real-password",
    });

    // Locked out despite the correct password — Better Auth answers a
    // `hooks.before` refusal with 401.
    expect(ninthAttempt.status).toBe(401);
  });

  it("the same right password succeeds in a fresh setup, without the 8 prior failures", async () => {
    // Proves the 401 above is the lockout, not something inherent to this
    // endpoint, this hash, or this password — the only difference here is
    // that no failed attempt preceded it.
    const realPasswordHash = await hashPassword("the-real-password");
    await createUser({ email: "beatriz@example.test", password: realPasswordHash });

    const response = await call("POST", "/sign-in/email", {
      email: "beatriz@example.test",
      password: "the-real-password",
    });

    expect(response.status).toBe(200);
  });

  it("BAUTH-6: failures recorded through loginEmailRateKey lock out /sign-in/email for that address", async () => {
    // lib/auth/auth.ts's hooks.before/after hard-code `login:email:${email}`
    // rather than importing loginEmailRateKey (server/auth/service.ts) —
    // dependency-cruiser's auth-server-exception forbids that import from
    // lib/auth/auth.ts. This proves the hard-coded string still names the
    // same counter: every failure here is recorded directly through
    // loginEmailRateKey, never through this endpoint, yet it still locks.
    const email = "camila@example.test";
    const realPasswordHash = await hashPassword("the-real-password");
    await createUser({ email, password: realPasswordHash });

    for (let attempt = 0; attempt < RATE_LIMITS.loginPerEmail.limit; attempt++) {
      await consumeRateLimit(loginEmailRateKey(email), RATE_LIMITS.loginPerEmail);
    }

    const response = await call("POST", "/sign-in/email", {
      email,
      password: "the-real-password",
    });

    expect(response.status).toBe(401);
  });
});

describe("BAUTH-9: /sign-in/social refuses an idToken sign-in", () => {
  it("BAUTH-9: POST /sign-in/social with an idToken is refused, with no user and no session", async () => {
    const usersBefore = await prisma.user.count();

    const response = await call("POST", "/sign-in/social", {
      provider: "google",
      idToken: { token: "x" },
    });

    // disableIdTokenSignIn on the google provider (lib/auth/auth.ts) makes
    // supportsIdTokenSignIn (oauth2/verify-id-token.mjs) refuse the request
    // with ID_TOKEN_NOT_SUPPORTED before it ever verifies the token or
    // reaches handleOAuthUserInfo. APIError's "NOT_FOUND" is 404
    // (better-call/dist/error.mjs) — never a 2xx.
    expect(response.status).toBe(404);

    expect(await prisma.user.count()).toBe(usersBefore);
    expect(response.headers.get("set-cookie") ?? "").not.toContain("better-auth.session_token=");
  });
});
