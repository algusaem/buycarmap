import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { NextRequest } from "next/server";
import { server } from "@/test/msw/server";
import { createUser } from "@/test/factories/user";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth/auth";
import { GET } from "@/app/api/auth/[...all]/route";

// BAUTH-9 (docs/specs/core-better-auth.md), security review fix: drives
// Better Auth's real OAuth flow end to end — `auth.api.signInSocial` for the
// authorization `state`, then the real `GET /api/auth/callback/google`
// route handler — rather than calling
// `databaseHooks.account.create.before` by hand
// (lib/auth/account-link-hook.integration.test.ts, kept alongside this file
// for the hook's own internal shape, which still needs its own coverage).
//
// Google is the only social provider (docs/specs/redesign-entry.md). Its
// callback flow is one token exchange: the token endpoint answers with an
// `id_token`, and `getUserInfo` (@better-auth/core's
// social-providers/google.mjs) only *decodes* it (`decodeJwt`) — the token
// came straight from Google's token endpoint, so the callback never checks its
// signature against Google's JWKS. (The JWKS check belongs to the
// `POST /sign-in/social` with `{ idToken }` path, which lib/auth/auth.ts turns
// off with `disableIdTokenSignIn`.) The fake id_token below therefore carries
// a placeholder signature, and no JWKS endpoint is faked: nothing fetches it.
//
// Better Auth's own default `storeStateStrategy` keeps the OAuth `state` in
// the database (the `Verification` table) *and* a signed `state` cookie that
// must match it — `startGoogleSignIn` below carries both forward from
// `signInSocial`'s response to the callback request, the same way
// server/auth/sign-in.integration.test.ts's `requestTwoFactorChallenge`
// carries forward the two-factor challenge cookie.

// vitest.config.ts's dummy GOOGLE_CLIENT_ID, the id_token's audience.
const GOOGLE_CLIENT_ID = "test-google-client-id";

let nextGoogleSub = 1;

function base64UrlJson(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function googleHandlers(opts: { email: string; verified: boolean }) {
  // A stable `sub`, not the email, is what ends up as `providerAccountId` —
  // fixed per call to `googleHandlers` (one per simulated Google user) rather
  // than per HTTP request, so a *second* sign-in for the same simulated user
  // resolves to the same `providerAccountId` and finds its existing account,
  // the way a real Google `sub` would. Incremented, not hardcoded, so two
  // different simulated users in the same test file never collide.
  const sub = `google-test-sub-${nextGoogleSub++}`;

  return [
    http.post("https://oauth2.googleapis.com/token", () => {
      const now = Math.floor(Date.now() / 1000);
      const idToken = [
        base64UrlJson({ alg: "RS256", kid: "test-key", typ: "JWT" }),
        base64UrlJson({
          iss: "https://accounts.google.com",
          aud: GOOGLE_CLIENT_ID,
          sub,
          email: opts.email,
          email_verified: opts.verified,
          name: "Test User",
          picture: "https://example.test/avatar.png",
          iat: now,
          exp: now + 3600,
        }),
        "placeholder-signature",
      ].join(".");

      return HttpResponse.json({
        access_token: "test-google-access-token",
        id_token: idToken,
        token_type: "Bearer",
        expires_in: 3600,
        scope: "openid email profile",
      });
    }),
  ];
}

/**
 * Starts a real Google sign-in through `signInSocial` and returns the two
 * values the callback needs: the `state` query parameter, and the signed
 * `state` cookie Better Auth set alongside it (`asResponse: true` is what
 * surfaces that `Set-Cookie` header on a direct `auth.api.*` call).
 */
async function startGoogleSignIn(): Promise<{ state: string; stateCookie: string }> {
  const response = await auth.api.signInSocial({
    body: { provider: "google", callbackURL: "/", disableRedirect: true },
    headers: new Headers(),
    asResponse: true,
  });
  const body = (await response.json()) as { url: string };
  const state = new URL(body.url).searchParams.get("state");
  if (!state)
    throw new Error("expected signInSocial to return an authorization URL carrying a state");

  const setCookie = response.headers.get("set-cookie") ?? "";
  const stateCookie = setCookie.split(";")[0];
  if (!stateCookie.startsWith("better-auth.state=")) {
    throw new Error("expected signInSocial to set the signed state cookie");
  }

  return { state, stateCookie };
}

/** The real callback route, carrying a sign-in's state cookie back to it. */
async function runGoogleCallback(
  code: string,
  { state, stateCookie }: { state: string; stateCookie: string },
): Promise<Response> {
  const request = new NextRequest(
    `http://localhost:3000/api/auth/callback/google?code=${code}&state=${state}`,
    { headers: { cookie: stateCookie } },
  );
  return GET(request);
}

function hasSessionCookie(response: Response): boolean {
  return (response.headers.get("set-cookie") ?? "").includes("better-auth.session_token=");
}

describe("BAUTH-9: the real OAuth callback — a brand-new address", () => {
  it("BAUTH-9: creates a user and an accounts row, and a second sign-in works", async () => {
    const email = "brand-new-google-user@example.test";
    server.use(...googleHandlers({ email, verified: true }));

    const first = await runGoogleCallback("first-code", await startGoogleSignIn());

    expect(first.status).toBe(302);
    expect(hasSessionCookie(first)).toBe(true);

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();
    // BAUTH-19: no password, so no "credential" account.
    expect(
      await prisma.account.count({ where: { userId: user?.id, provider: "credential" } }),
    ).toBe(0);
    // BLOCKER fix (item 1): before it, this hook refused the very account
    // creation above — a brand-new OAuth sign-up never got this far.
    expect(user?.emailConfirmed).toBe(true);

    const account = await prisma.account.findFirst({
      where: { userId: user?.id, provider: "google" },
    });
    expect(account).not.toBeNull();

    // A second sign-in with the same provider account is a plain sign-in,
    // not another link decision — `databaseHooks.account.create.before`
    // never runs again for it, since the account already exists.
    const second = await runGoogleCallback("second-code", await startGoogleSignIn());

    expect(second.status).toBe(302);
    expect(hasSessionCookie(second)).toBe(true);

    const accountsForUser = await prisma.account.count({
      where: { userId: user?.id, provider: "google" },
    });
    expect(accountsForUser).toBe(1);
  });
});

describe("BAUTH-9 (amended 2026-10-04, security review round 2): the real OAuth callback — a brand-new address with an unverified email", () => {
  it("BAUTH-9: an unverified primary email for an unknown address creates no user, no account and no session", async () => {
    const email = "brand-new-unverified-google-user@example.test";
    // `verified: false` with no local account for this address at all — the
    // amended brand-new-user bypass (lib/auth/auth.ts's
    // `databaseHooks.user.create.before`) must refuse the user creation
    // itself, not just the account link, or the address would be claimed by
    // a provider that never verified it.
    server.use(...googleHandlers({ email, verified: false }));

    const response = await runGoogleCallback("unverified-new-user-code", await startGoogleSignIn());

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/error");
    expect(hasSessionCookie(response)).toBe(false);

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).toBeNull();

    const account = await prisma.account.findFirst({ where: { provider: "google" } });
    expect(account).toBeNull();
  });
});

describe("BAUTH-9: the real OAuth callback — linking onto an existing local account", () => {
  it("BAUTH-9: a verified local user with no two-factor and a provider-verified email gets linked and signed in", async () => {
    const email = "verified-no-2fa@example.test";
    await createUser({ email, emailConfirmed: true, twoFactorEnabled: false });
    server.use(...googleHandlers({ email, verified: true }));

    const response = await runGoogleCallback("link-code", await startGoogleSignIn());

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/");
    expect(hasSessionCookie(response)).toBe(true);

    const account = await prisma.account.findFirst({ where: { provider: "google" } });
    expect(account).not.toBeNull();
  });

  it("BAUTH-9: an unverified provider email for an existing local user is not linked, with no session", async () => {
    const email = "local-user-unverified-provider@example.test";
    await createUser({ email, emailConfirmed: true, twoFactorEnabled: false });
    // email_verified: false — the exact claim `trustedProviders` used to let
    // Better Auth skip checking entirely (item 2's fix removed it).
    server.use(...googleHandlers({ email, verified: false }));

    const response = await runGoogleCallback("unverified-code", await startGoogleSignIn());

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/error");
    expect(hasSessionCookie(response)).toBe(false);

    const account = await prisma.account.findFirst({ where: { provider: "google" } });
    expect(account).toBeNull();
  });

  it("BAUTH-9: a local user with two-factor on is not linked", async () => {
    const email = "local-user-two-factor@example.test";
    await createUser({ email, emailConfirmed: true, twoFactorEnabled: true });
    // The provider itself reports the email as verified — Better Auth's own
    // gate would allow this; only our own two-factor refusal
    // (`databaseHooks.account.create.before`) stops it.
    server.use(...googleHandlers({ email, verified: true }));

    const response = await runGoogleCallback("two-factor-code", await startGoogleSignIn());

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/error");
    expect(hasSessionCookie(response)).toBe(false);

    const account = await prisma.account.findFirst({ where: { provider: "google" } });
    expect(account).toBeNull();
  });
});
