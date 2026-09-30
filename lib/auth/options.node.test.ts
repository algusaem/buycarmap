import { describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import type { CredentialsConfig } from "next-auth/providers/credentials";
import type { Awaitable, User } from "next-auth";

// TEST-7 (docs/specs/core-testing.md): the jwt callback's revalidation and
// revocation paths, and the signIn callback's OAuth linking guard, moved to
// ./options.integration.test.ts, which reads real User rows. The three
// blocks below never touch Prisma at all — authorize's own branching is
// covered in server/auth/authorize.integration.test.ts, the session
// configuration checks are static properties on authOptions, and the session
// callback is a pure function of its arguments — so this file no longer
// mocks @/lib/db/prisma.

type AuthorizeFn = (
  credentials: Record<"email" | "password", string> | undefined,
  req: { body: undefined; query: undefined; headers: undefined; method: string },
) => Awaitable<User | null>;

vi.mock("@/server/auth/service", () => ({
  authorizeCredentials: vi.fn(),
}));

import { authorizeCredentials } from "@/server/auth/service";
import { authOptions } from "./options";

const authCallbacks = authOptions.callbacks;
if (!authCallbacks) throw new Error("expected authOptions.callbacks to be configured");

const sessionCallback = authCallbacks.session;
if (!sessionCallback) throw new Error("expected authOptions.callbacks.session to be configured");

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
