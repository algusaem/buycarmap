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
// authorization `state`, then the real `GET /api/auth/callback/github`
// route handler — rather than calling
// `databaseHooks.account.create.before` by hand
// (lib/auth/account-link-hook.integration.test.ts, kept alongside this file
// for the hook's own internal shape, which still needs its own coverage).
//
// GitHub, not Google: its flow is token exchange plus two REST userinfo
// calls (better-auth's @better-auth/core/dist/social-providers/github.mjs),
// with no id-token JWT to fake a signature for. Google's flow verifies a
// signed id_token against Google's JWKS, which would need a second fake (a
// test keypair plus a faked JWKS endpoint) for no added coverage here — both
// providers run through the exact same `handleOAuthUserInfo`
// (better-auth/dist/oauth2/link-account.mjs) this file is actually testing.
//
// Better Auth's own default `storeStateStrategy` keeps the OAuth `state` in
// the database (the `Verification` table) *and* a signed `state` cookie that
// must match it — `startGithubSignIn` below carries both forward from
// `signInSocial`'s response to the callback request, the same way
// server/auth/sign-in.integration.test.ts's `requestTwoFactorChallenge`
// carries forward the two-factor challenge cookie.

let nextGithubId = 1;

function githubHandlers(opts: { email: string; verified: boolean; login: string }) {
  // A real id, not the email, is what ends up as `providerAccountId` — fixed
  // per call to `githubHandlers` (one per simulated GitHub user) rather than
  // per HTTP request, so a *second* sign-in for the same simulated user
  // resolves to the same `providerAccountId` and finds its existing account,
  // the way a real GitHub id would. Incremented, not hardcoded, so two
  // different simulated users in the same test file never collide.
  const githubId = nextGithubId++;

  return [
    http.post("https://github.com/login/oauth/access_token", async () =>
      HttpResponse.json({
        access_token: "test-github-access-token",
        token_type: "bearer",
        scope: "read:user,user:email",
      }),
    ),
    http.get("https://api.github.com/user", () =>
      HttpResponse.json({
        id: githubId,
        login: opts.login,
        name: "Test User",
        avatar_url: "https://example.test/avatar.png",
        // GitHub's own `/user` response can omit the email entirely when
        // it is private — `getUserInfo` (github.mjs) falls back to
        // `/user/emails` below for both the address and its verified flag.
        email: null,
      }),
    ),
    http.get("https://api.github.com/user/emails", () =>
      HttpResponse.json([{ email: opts.email, primary: true, verified: opts.verified }]),
    ),
  ];
}

/**
 * Starts a real GitHub sign-in through `signInSocial` and returns the two
 * values the callback needs: the `state` query parameter, and the signed
 * `state` cookie Better Auth set alongside it (`asResponse: true` is what
 * surfaces that `Set-Cookie` header on a direct `auth.api.*` call).
 */
async function startGithubSignIn(): Promise<{ state: string; stateCookie: string }> {
  const response = await auth.api.signInSocial({
    body: { provider: "github", callbackURL: "/", disableRedirect: true },
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
async function runGithubCallback(
  code: string,
  { state, stateCookie }: { state: string; stateCookie: string },
): Promise<Response> {
  const request = new NextRequest(
    `http://localhost:3000/api/auth/callback/github?code=${code}&state=${state}`,
    { headers: { cookie: stateCookie } },
  );
  return GET(request);
}

function hasSessionCookie(response: Response): boolean {
  return (response.headers.get("set-cookie") ?? "").includes("better-auth.session_token=");
}

describe("BAUTH-9: the real OAuth callback — a brand-new address", () => {
  it("BAUTH-9: creates a user and an accounts row, and a second sign-in works", async () => {
    const email = "brand-new-github-user@example.test";
    server.use(...githubHandlers({ email, verified: true, login: "brand-new-user" }));

    const first = await runGithubCallback("first-code", await startGithubSignIn());

    expect(first.status).toBe(302);
    expect(hasSessionCookie(first)).toBe(true);

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();
    expect(user?.password).toBeNull();
    // BLOCKER fix (item 1): before it, this hook refused the very account
    // creation above — a brand-new OAuth sign-up never got this far.
    expect(user?.emailConfirmed).toBe(true);

    const account = await prisma.account.findFirst({
      where: { userId: user?.id, provider: "github" },
    });
    expect(account).not.toBeNull();

    // A second sign-in with the same provider account is a plain sign-in,
    // not another link decision — `databaseHooks.account.create.before`
    // never runs again for it, since the account already exists.
    const second = await runGithubCallback("second-code", await startGithubSignIn());

    expect(second.status).toBe(302);
    expect(hasSessionCookie(second)).toBe(true);

    const accountsForUser = await prisma.account.count({
      where: { userId: user?.id, provider: "github" },
    });
    expect(accountsForUser).toBe(1);
  });
});

describe("BAUTH-9 (amended 2026-10-04, security review round 2): the real OAuth callback — a brand-new address with an unverified email", () => {
  it("BAUTH-9: an unverified primary email for an unknown address creates no user, no account and no session", async () => {
    const email = "brand-new-unverified-github-user@example.test";
    // `verified: false` with no local account for this address at all — the
    // amended brand-new-user bypass (lib/auth/auth.ts's
    // `databaseHooks.user.create.before`) must refuse the user creation
    // itself, not just the account link, or the address would be claimed by
    // a provider that never verified it.
    server.use(...githubHandlers({ email, verified: false, login: "brand-new-unverified" }));

    const response = await runGithubCallback("unverified-new-user-code", await startGithubSignIn());

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/error");
    expect(hasSessionCookie(response)).toBe(false);

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).toBeNull();

    const account = await prisma.account.findFirst({ where: { provider: "github" } });
    expect(account).toBeNull();
  });
});

describe("BAUTH-9: the real OAuth callback — linking onto an existing local account", () => {
  it("BAUTH-9: a verified local user with no two-factor and a provider-verified email gets linked and signed in", async () => {
    const email = "verified-no-2fa@example.test";
    await createUser({ email, emailConfirmed: true, twoFactorEnabled: false });
    server.use(...githubHandlers({ email, verified: true, login: "verified-no-2fa" }));

    const response = await runGithubCallback("link-code", await startGithubSignIn());

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/");
    expect(hasSessionCookie(response)).toBe(true);

    const account = await prisma.account.findFirst({ where: { provider: "github" } });
    expect(account).not.toBeNull();
  });

  it("BAUTH-9: an unverified provider email for an existing local user is not linked, with no session", async () => {
    const email = "local-user-unverified-provider@example.test";
    await createUser({ email, emailConfirmed: true, twoFactorEnabled: false });
    // email_verified: false — the exact claim `trustedProviders` used to let
    // Better Auth skip checking entirely (item 2's fix removed it).
    server.use(...githubHandlers({ email, verified: false, login: "unverified-provider" }));

    const response = await runGithubCallback("unverified-code", await startGithubSignIn());

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/error");
    expect(hasSessionCookie(response)).toBe(false);

    const account = await prisma.account.findFirst({ where: { provider: "github" } });
    expect(account).toBeNull();
  });

  it("BAUTH-9: a local user with two-factor on is not linked", async () => {
    const email = "local-user-two-factor@example.test";
    await createUser({ email, emailConfirmed: true, twoFactorEnabled: true });
    // The provider itself reports the email as verified — Better Auth's own
    // gate would allow this; only our own two-factor refusal
    // (`databaseHooks.account.create.before`) stops it.
    server.use(...githubHandlers({ email, verified: true, login: "two-factor-user" }));

    const response = await runGithubCallback("two-factor-code", await startGithubSignIn());

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/error");
    expect(hasSessionCookie(response)).toBe(false);

    const account = await prisma.account.findFirst({ where: { provider: "github" } });
    expect(account).toBeNull();
  });
});
