import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createUser } from "@/test/factories/user";
import { deriveCodeFromUri } from "@/test/two-factor-totp";
import { auth, createSessionCookie } from "./auth";

// The real plaintext behind test/factories/user.ts's default password hash
// (also used by server/two-factor/actions.integration.test.ts) — enrolling
// through the real plugin flow below needs the actual password, not just a
// hash to compare against.
const FACTORY_PASSWORD = "buycarmap-factory-password";

// BAUTH-9 (docs/specs/core-better-auth.md): lib/auth/auth.ts's
// `databaseHooks.account.create.before` is the second-factor and
// stranding-prevention gate every OAuth account link goes through. Better
// Auth calls this hook as `(accountData, context)` from inside
// `runWithEndpointContext` (better-auth/dist/db/with-hooks.mjs's
// `createWithHooks`), where `context` is the `AuthEndpointContext` —
// `Partial<InputContext & EndpointContext> & { context: AuthContext }`
// (@better-auth/core/src/context/endpoint-context.ts). This test builds that
// shape by hand rather than driving the real OAuth callback, since reaching
// this hook through the HTTP router needs a live provider (see
// lib/auth/oauth-callback.integration.test.ts, which does exactly that).
//
// `hookContext` still takes a `session` value and nests it under
// `context.session`: item 3 (security review round 2) deleted this file's
// own `hasExistingSession` bypass from the hook, since explicit linking from
// /account is not offered (BAUTH-9) — but a live session on the request is
// no longer special, which is precisely what the "allows an explicit link"
// test below now proves, by keeping the same shape and showing it is refused
// exactly like the no-session case.

function hookContext(session: unknown) {
  return { context: { session } };
}

describe("BAUTH-9: databaseHooks.account.create.before", () => {
  it("BAUTH-9: refuses an implicit link (no session) for a local user with two-factor on", async () => {
    const user = await createUser({
      email: "two-factor-user@example.test",
      emailConfirmed: true,
      twoFactorEnabled: true,
    });

    const result = await auth.options.databaseHooks?.account?.create?.before?.(
      {
        id: "account-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        providerId: "google",
        accountId: "google-account-id",
        userId: user.id,
      },
      // No session on the request: the shape the sign-in callback's implicit
      // auto-link runs with.
      hookContext(undefined) as never,
    );

    expect(result).toBe(false);
  });

  it("BAUTH-9 (item 3, security review round 2): a live session on the request no longer exempts a two-factor account, now that explicit linking from /account is not offered", async () => {
    const user = await createUser({
      email: "two-factor-user-explicit@example.test",
      emailConfirmed: true,
      twoFactorEnabled: true,
    });

    const result = await auth.options.databaseHooks?.account?.create?.before?.(
      {
        id: "account-2",
        createdAt: new Date(),
        updatedAt: new Date(),
        providerId: "google",
        accountId: "google-account-id-2",
        userId: user.id,
      },
      // Previously this shape — a live session on the request, the one
      // `authClient.linkSocial()` from /account would have run with — hit
      // this file's own `hasExistingSession` bypass and was let through
      // unconditionally. That dead branch is now deleted: `/link-social` is
      // not in `ALLOWED_HTTP_PATHS`, so no real request ever carries this
      // shape, and the hook no longer treats it specially either.
      hookContext({
        session: { id: "session-1", userId: user.id },
        user: { id: user.id, email: user.email },
      }) as never,
    );

    expect(result).toBe(false);
  });

  it("BAUTH-9: a user who enabled two-factor through the plugin is not auto-linked", async () => {
    const user = await createUser({
      email: "two-factor-plugin-user@example.test",
      emailConfirmed: true,
    });

    // Enrols for real through Better Auth's own `twoFactor` plugin, the same
    // way server/two-factor/actions.integration.test.ts's `enrolRealTwoFactor`
    // does, so `users.two_factor_enabled` is set by the plugin itself rather
    // than by the factory — this is the regression BAUTH-9 covers: the hook
    // used to read the old, now-dead `twoFactorEnabledAt` column, so a user
    // enrolled this way was never refused.
    const cookie = await createSessionCookie(user.id);
    const headers = new Headers({ cookie: `${cookie.name}=${cookie.value}` });

    const enabled = await auth.api.enableTwoFactor({
      body: { password: FACTORY_PASSWORD },
      headers,
    });
    if (enabled.method !== "totp" || !enabled.totpURI) {
      throw new Error("expected a TOTP enrolment");
    }
    await auth.api.verifyTOTP({
      body: { code: deriveCodeFromUri(enabled.totpURI) },
      headers,
    });

    const enrolled = await prisma.user.findUnique({ where: { id: user.id } });
    expect(enrolled?.twoFactorEnabled).toBe(true);

    const result = await auth.options.databaseHooks?.account?.create?.before?.(
      {
        id: "account-3",
        createdAt: new Date(),
        updatedAt: new Date(),
        providerId: "google",
        accountId: "google-account-id-3",
        userId: user.id,
      },
      // No session on the request: the shape the sign-in callback's implicit
      // auto-link runs with.
      hookContext(undefined) as never,
    );

    expect(result).toBe(false);
  });

  it("BAUTH-9: refuses an implicit link for a local user with no two-factor but an unconfirmed email", async () => {
    // `emailConfirmed` defaults to false; this is the regression item 1
    // covers — the hook used to read the legacy `emailVerified` DateTime
    // (always null for a Better-Auth-created row) instead of this field.
    const user = await createUser({ email: "unconfirmed-user@example.test" });

    const result = await auth.options.databaseHooks?.account?.create?.before?.(
      {
        id: "account-4",
        createdAt: new Date(),
        updatedAt: new Date(),
        providerId: "google",
        accountId: "google-account-id-4",
        userId: user.id,
      },
      hookContext(undefined) as never,
    );

    expect(result).toBe(false);
  });

  it("BAUTH-9: allows an implicit link for a verified local user with no two-factor", async () => {
    const user = await createUser({
      email: "confirmed-user@example.test",
      emailConfirmed: true,
    });

    const result = await auth.options.databaseHooks?.account?.create?.before?.(
      {
        id: "account-5",
        createdAt: new Date(),
        updatedAt: new Date(),
        providerId: "google",
        accountId: "google-account-id-5",
        userId: user.id,
      },
      hookContext(undefined) as never,
    );

    expect(result).not.toBe(false);
  });

  it("BAUTH-9 (amended 2026-10-04, security review round 2): refuses a brand-new provider sign-up with no password and no other accounts when the email is unconfirmed", async () => {
    // Amended expectation (item 2): BAUTH-9 now requires the provider itself
    // to report the email as verified before a brand-new user is created at
    // all — `databaseHooks.user.create.before` (lib/auth/auth.ts) refuses
    // that earlier, before Better Auth's adapter ever writes the `User` row,
    // so this exact shape (a `User` already committed, no password, no other
    // `accounts` row, unconfirmed email) should no longer occur in practice.
    // This hook's own `isBrandNewProviderSignUp` bypass is gone (security
    // review round 2, item 4): the account hook now always defers to
    // `mayAutoLink`, which refuses this shape on `emailConfirmed` alone —
    // this test was the BLOCKER fix's "allows" case before the amendment; it
    // now proves the opposite.
    const user = await createUser({
      email: "brand-new-oauth-user@example.test",
      password: null,
    });

    const result = await auth.options.databaseHooks?.account?.create?.before?.(
      {
        id: "account-6",
        createdAt: new Date(),
        updatedAt: new Date(),
        providerId: "google",
        accountId: "google-account-id-6",
        userId: user.id,
      },
      hookContext(undefined) as never,
    );

    expect(result).toBe(false);
  });
});
