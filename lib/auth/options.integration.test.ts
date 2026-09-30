import { describe, expect, it, vi } from "vitest";
import type { AuthOptions, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { prisma } from "@/lib/db/prisma";
import { createUser } from "@/test/factories/user";
import { authOptions } from "./options";

// TEST-7 (docs/specs/core-testing.md): the jwt callback's revalidation and
// revocation paths, and the signIn callback's OAuth linking guard, moved here
// from lib/auth/options.node.test.ts — both read real User rows. The
// credentials-provider delegation, the session configuration and the
// (pure) session callback stay in the .node.test.ts file, since none of them
// touch Prisma.

const authCallbacks = authOptions.callbacks;
if (!authCallbacks) throw new Error("expected authOptions.callbacks to be configured");

const jwtCallback = authCallbacks.jwt;
if (!jwtCallback) throw new Error("expected authOptions.callbacks.jwt to be configured");

const signInCallback = authCallbacks.signIn;
if (!signInCallback) throw new Error("expected authOptions.callbacks.signIn to be configured");

type JwtCallbackParams = Parameters<NonNullable<NonNullable<AuthOptions["callbacks"]>["jwt"]>>[0];

interface JwtCallbackFixture {
  token: JWT;
  user?: User;
  account?: null;
  trigger?: "signIn" | "signUp" | "update";
}

function jwtParams(fixture: JwtCallbackFixture): JwtCallbackParams {
  return fixture as JwtCallbackParams;
}

const HOUR = 60 * 60 * 1000;

describe("jwt callback on sign-in", () => {
  it("stamps the user id and issue time, without a database round-trip", async () => {
    const spy = vi.spyOn(prisma.user, "findUnique");

    const token = await jwtCallback(
      jwtParams({
        token: {} as JWT,
        user: {
          id: "user-123",
          email: "ada@example.com",
          name: "Ada",
          image: null,
        },
        account: null,
      }),
    );

    expect(token.id).toBe("user-123");
    expect(typeof token.pwdAt).toBe("number");
    // The sign-in itself just read the row; re-reading it would be waste.
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("jwt callback revalidation", () => {
  it("skips the database while the last check is recent", async () => {
    const user = await createUser();
    const token = {
      id: user.id,
      pwdAt: Date.now() - HOUR,
      checkedAt: Date.now(),
    } as JWT;

    const result = await jwtCallback(jwtParams({ token, account: null }));

    // One query per request on every authenticated page load would be a real
    // cost; the check is interval-bounded instead.
    expect(result.id).toBe(user.id);
  });

  it("re-reads the row once the interval has elapsed", async () => {
    const user = await createUser({ passwordChangedAt: new Date(Date.now() - HOUR) });
    const token = {
      id: user.id,
      pwdAt: Date.now() - HOUR,
      checkedAt: Date.now() - 10 * 60 * 1000,
    } as JWT;

    const result = await jwtCallback(jwtParams({ token, account: null }));

    if (token.pwdAt === undefined) throw new Error("expected pwdAt to be set on the token");
    expect(result.checkedAt).toBeGreaterThan(token.pwdAt);
  });

  it("picks up a profile rename without requiring a re-login", async () => {
    const user = await createUser({
      name: "Ada",
      passwordChangedAt: new Date(Date.now() - HOUR),
    });

    const result = await jwtCallback(
      jwtParams({
        token: { id: user.id, pwdAt: Date.now(), checkedAt: 0 } as JWT,
        account: null,
      }),
    );

    expect(result.name).toBe("Ada");
  });
});

describe("jwt callback revocation", () => {
  it("throws when the password changed after the session was issued", async () => {
    const signedInAt = Date.now() - HOUR;
    const user = await createUser({
      // Password changed half an hour after this session started.
      passwordChangedAt: new Date(signedInAt + 30 * 60 * 1000),
    });

    // NextAuth's session route catches this, clears the cookie and returns a
    // null session — the only way to revoke a stateless JWT server-side.
    await expect(
      jwtCallback(
        jwtParams({
          token: { id: user.id, pwdAt: signedInAt, checkedAt: 0 } as JWT,
          account: null,
        }),
      ),
    ).rejects.toThrow("SessionRevoked");
  });

  it("keeps a session issued after the last password change", async () => {
    const changedAt = Date.now() - 2 * HOUR;
    const user = await createUser({ passwordChangedAt: new Date(changedAt) });

    const result = await jwtCallback(
      jwtParams({
        token: { id: user.id, pwdAt: Date.now() - HOUR, checkedAt: 0 } as JWT,
        account: null,
      }),
    );

    expect(result.id).toBe(user.id);
  });

  it("throws when the account no longer exists", async () => {
    await expect(
      jwtCallback(
        jwtParams({
          token: { id: "deleted-user", pwdAt: Date.now(), checkedAt: 0 } as JWT,
          account: null,
        }),
      ),
    ).rejects.toThrow("SessionRevoked");
  });

  it("adopts a stamp for legacy tokens instead of revoking them", async () => {
    // Tokens minted before `pwdAt` existed must not all be invalidated at
    // once — but they must become revocable from here on.
    const user = await createUser({ passwordChangedAt: new Date(Date.now() - HOUR) });

    const result = await jwtCallback(jwtParams({ token: { id: user.id } as JWT, account: null }));

    expect(typeof result.pwdAt).toBe("number");
  });
});

describe("signIn callback: OAuth linking guard", () => {
  const call = (params: { email?: string | null; provider?: string; type?: string }) =>
    signInCallback({
      // `??` would turn an explicit null back into the default, which is how
      // the no-email case silently tested the wrong thing.
      user: {
        id: "u1",
        email: "email" in params ? params.email : "ada@example.com",
      },
      account:
        params.type === "none"
          ? null
          : ({
              type: params.type ?? "oauth",
              provider: params.provider ?? "google",
              providerAccountId: "g-1",
            } as never),
    } as never);

  it("allows credentials sign-in, which authorize already guards", async () => {
    await expect(call({ type: "credentials" })).resolves.toBe(true);
  });

  it("signIn lets a sign-in with no account through without a lookup", async () => {
    await expect(call({ type: "none" })).resolves.toBe(true);
  });

  it("AUTH-12: allows a brand-new account created through the provider", async () => {
    await expect(call({ email: "brand-new@example.com" })).resolves.toBe(true);
  });

  it("allows linking when the account has no two-factor", async () => {
    // The existing behaviour is preserved for everyone not using 2FA.
    await createUser({ email: "ada@example.com", twoFactorEnabledAt: null });

    await expect(call({})).resolves.toBe(true);
  });

  it("allows a provider that is already linked to a two-factor account", async () => {
    const user = await createUser({ email: "ada@example.com", twoFactorEnabledAt: new Date() });
    await prisma.account.create({
      data: {
        user: { connect: { id: user.id } },
        type: "oauth",
        provider: "google",
        providerAccountId: "g-existing",
      },
    });

    await expect(call({ provider: "google" })).resolves.toBe(true);
  });

  it("AUTH-12: blocks a NEW provider on a two-factor account", async () => {
    // The attack this closes: someone who controls the mailbox creates a
    // Google account on that address and signs in, skipping the second factor.
    await createUser({ email: "ada@example.com", twoFactorEnabledAt: new Date() });

    await expect(call({ provider: "google" })).resolves.toBe(false);
  });

  it("blocks a second provider even when another is already linked", async () => {
    const user = await createUser({ email: "ada@example.com", twoFactorEnabledAt: new Date() });
    await prisma.account.create({
      data: {
        user: { connect: { id: user.id } },
        type: "oauth",
        provider: "github",
        providerAccountId: "gh-existing",
      },
    });

    await expect(call({ provider: "google" })).resolves.toBe(false);
  });

  it("allows through when the provider gives no email to match on", async () => {
    await expect(call({ email: null })).resolves.toBe(true);
  });
});
