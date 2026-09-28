import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session, User, Awaitable } from "next-auth";
import type { JWT } from "next-auth/jwt";
import type { CredentialsConfig } from "next-auth/providers/credentials";

// NextAuth v4 keeps the user-supplied options (our real authorize) under
// `.options`; the top-level `authorize` is a `() => null` default it merges
// over internally. So the wiring under test lives at `provider.options`.
type AuthorizeFn = (
  credentials: Record<"email" | "password", string> | undefined,
  req: { body: undefined; query: undefined; headers: undefined; method: string },
) => Awaitable<User | null>;

// authorize's own branching is covered in authorize.test.ts; stub it so this
// file only exercises the NextAuth wiring and the session callbacks.
vi.mock("@/lib/auth/authorize", () => ({
  authorizeCredentials: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

import { authorizeCredentials } from "@/lib/auth/authorize";
import { prisma } from "@/lib/prisma";
import { authOptions } from "./options";

const sessionCallback = authOptions.callbacks!.session!;

// NextAuth 4's types declare `user` as always present on the jwt callback, but
// at runtime it is set only on the sign-in call — every later invocation (the
// revalidation path this file exercises) passes undefined. Calling through this
// signature models the real shape without loosening the production types.
interface JwtCallbackParams {
  token: JWT;
  user?: User;
  account?: null;
  trigger?: "signIn" | "signUp" | "update";
}

const jwtCallback = authOptions.callbacks!.jwt! as unknown as (
  params: JwtCallbackParams,
) => Promise<JWT>;

const HOUR = 60 * 60 * 1000;

function dbUser(passwordChangedAt: Date) {
  return {
    email: "ada@example.com",
    name: "Ada",
    image: null,
    passwordChangedAt,
  };
}

describe("credentials provider", () => {
  it("delegates authorize to authorizeCredentials and returns its result", async () => {
    const provider = authOptions.providers[0] as CredentialsConfig & {
      options: { authorize: AuthorizeFn };
    };
    const user = {
      id: "u1",
      email: "ada@example.com",
      name: null,
      image: null,
    };
    vi.mocked(authorizeCredentials).mockResolvedValue(user);

    const credentials = { email: "ada@example.com", password: "pw" };
    const result = await provider.options.authorize(credentials, {
      body: undefined,
      query: undefined,
      headers: undefined,
      method: "POST",
    });

    expect(authorizeCredentials).toHaveBeenCalledWith(credentials);
    expect(result).toEqual(user);
  });
});

describe("session configuration", () => {
  it("expires sessions well inside NextAuth's 30-day default", () => {
    // A JWT stays valid until it expires and there is no server-side record to
    // delete, so the expiry window is the blast radius of a stolen token.
    expect(authOptions.session?.maxAge).toBe(7 * 24 * 60 * 60);
  });

  it("pins the secret explicitly rather than relying on auto-generation", () => {
    // NextAuth 4 silently invents a secret in development, which makes a
    // missing NEXTAUTH_SECRET a production-only failure.
    expect(authOptions.secret).toBeTruthy();
  });
});

describe("jwt callback on sign-in", () => {
  beforeEach(() => {
    vi.mocked(prisma.user.findUnique).mockReset();
  });

  it("stamps the user id and issue time, without a database round-trip", async () => {
    const token = await jwtCallback({
      token: {} as JWT,
      user: {
        id: "user-123",
        email: "ada@example.com",
        name: "Ada",
        image: null,
      },
      account: null,
    });

    expect(token.id).toBe("user-123");
    expect(typeof token.pwdAt).toBe("number");
    // The sign-in itself just read the row; re-reading it would be waste.
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});

describe("jwt callback revalidation", () => {
  beforeEach(() => {
    vi.mocked(prisma.user.findUnique).mockReset();
  });

  it("skips the database while the last check is recent", async () => {
    const token = {
      id: "user-123",
      pwdAt: Date.now() - HOUR,
      checkedAt: Date.now(),
    } as JWT;

    await jwtCallback({ token, user: undefined, account: null });

    // One query per request on every authenticated page load would be a real
    // cost; the check is interval-bounded instead.
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("re-reads the row once the interval has elapsed", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      dbUser(new Date(Date.now() - HOUR)) as never,
    );

    const token = {
      id: "user-123",
      pwdAt: Date.now() - HOUR,
      checkedAt: Date.now() - 10 * 60 * 1000,
    } as JWT;

    const result = await jwtCallback({ token, user: undefined, account: null });

    expect(prisma.user.findUnique).toHaveBeenCalled();
    expect(result.checkedAt).toBeGreaterThan(token.pwdAt!);
  });

  it("picks up a profile rename without requiring a re-login", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      dbUser(new Date(Date.now() - HOUR)) as never,
    );

    const result = await jwtCallback({
      token: { id: "user-123", pwdAt: Date.now(), checkedAt: 0 } as JWT,
      user: undefined,
      account: null,
    });

    expect(result.name).toBe("Ada");
  });
});

describe("jwt callback revocation", () => {
  beforeEach(() => {
    vi.mocked(prisma.user.findUnique).mockReset();
  });

  it("throws when the password changed after the session was issued", async () => {
    const signedInAt = Date.now() - HOUR;
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      // Password changed half an hour after this session started.
      dbUser(new Date(signedInAt + 30 * 60 * 1000)) as never,
    );

    // NextAuth's session route catches this, clears the cookie and returns a
    // null session — the only way to revoke a stateless JWT server-side.
    await expect(
      jwtCallback({
        token: { id: "user-123", pwdAt: signedInAt, checkedAt: 0 } as JWT,
        user: undefined,
        account: null,
      }),
    ).rejects.toThrow("SessionRevoked");
  });

  it("keeps a session issued after the last password change", async () => {
    const changedAt = Date.now() - 2 * HOUR;
    vi.mocked(prisma.user.findUnique).mockResolvedValue(dbUser(new Date(changedAt)) as never);

    const result = await jwtCallback({
      token: { id: "user-123", pwdAt: Date.now() - HOUR, checkedAt: 0 } as JWT,
      user: undefined,
      account: null,
    });

    expect(result.id).toBe("user-123");
  });

  it("throws when the account no longer exists", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    await expect(
      jwtCallback({
        token: { id: "deleted-user", pwdAt: Date.now(), checkedAt: 0 } as JWT,
        user: undefined,
        account: null,
      }),
    ).rejects.toThrow("SessionRevoked");
  });

  it("adopts a stamp for legacy tokens instead of revoking them", async () => {
    // Tokens minted before `pwdAt` existed must not all be invalidated at
    // once — but they must become revocable from here on.
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      dbUser(new Date(Date.now() - HOUR)) as never,
    );

    const result = await jwtCallback({
      token: { id: "user-123" } as JWT,
      user: undefined,
      account: null,
    });

    expect(typeof result.pwdAt).toBe("number");
  });
});

describe("session callback", () => {
  it("exposes the token id and profile on session.user", async () => {
    const result = (await sessionCallback({
      session: {
        user: { id: "", email: "" },
        expires: "2099-01-01T00:00:00.000Z",
      },
      token: {
        id: "user-123",
        email: "ada@example.com",
        name: "Ada",
        picture: null,
      } as JWT,
      user: { id: "ignored", email: "ada@example.com", emailVerified: null },
      newSession: undefined,
      trigger: "update",
    })) as Session;

    expect(result.user.id).toBe("user-123");
    expect(result.user.email).toBe("ada@example.com");
    expect(result.user.name).toBe("Ada");
  });
});

describe("signIn callback: OAuth linking guard", () => {
  const signInCallback = authOptions.callbacks!.signIn!;

  // NextAuth's types demand a full User/Account; only the fields the callback
  // reads matter here.
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

  beforeEach(() => {
    vi.mocked(prisma.user.findUnique).mockReset();
  });

  it("allows credentials sign-in, which authorize already guards", async () => {
    await expect(call({ type: "credentials" })).resolves.toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("AUTH-12: allows a brand-new account created through the provider", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    await expect(call({})).resolves.toBe(true);
  });

  it("allows linking when the account has no two-factor", async () => {
    // The existing behaviour is preserved for everyone not using 2FA.
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      twoFactorEnabledAt: null,
      accounts: [],
    } as never);

    await expect(call({})).resolves.toBe(true);
  });

  it("allows a provider that is already linked to a two-factor account", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      twoFactorEnabledAt: new Date(),
      accounts: [{ provider: "google" }],
    } as never);

    await expect(call({ provider: "google" })).resolves.toBe(true);
  });

  it("AUTH-12: blocks a NEW provider on a two-factor account", async () => {
    // The attack this closes: someone who controls the mailbox creates a
    // Google account on that address and signs in, skipping the second factor.
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      twoFactorEnabledAt: new Date(),
      accounts: [],
    } as never);

    await expect(call({ provider: "google" })).resolves.toBe(false);
  });

  it("blocks a second provider even when another is already linked", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      twoFactorEnabledAt: new Date(),
      accounts: [{ provider: "github" }],
    } as never);

    await expect(call({ provider: "google" })).resolves.toBe(false);
  });

  it("allows through when the provider gives no email to match on", async () => {
    await expect(call({ email: null })).resolves.toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
