import { describe, expect, it, vi } from "vitest";
import type { Session, User, Awaitable } from "next-auth";
import type { CredentialsConfig } from "next-auth/providers/credentials";

// NextAuth v4 keeps the user-supplied options (our real authorize) under
// `.options`; the top-level `authorize` is a `() => null` default it merges
// over internally. So the wiring under test lives at `provider.options`.
type AuthorizeFn = (
  credentials: Record<"email" | "password", string> | undefined,
  req: { body: undefined; query: undefined; headers: undefined; method: string },
) => Awaitable<User | null>;

// Importing the route wires up NextAuth + the authorize logic (tested
// elsewhere); stub authorize so this file only exercises the wiring.
vi.mock("@/lib/auth/authorize", () => ({
  authorizeCredentials: vi.fn(),
}));

import { authorizeCredentials } from "@/lib/auth/authorize";
import { authOptions } from "./route";

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

describe("NextAuth callbacks", () => {
  it("jwt copies the authorized user's id onto the token", async () => {
    const jwt = authOptions.callbacks!.jwt!;

    const token = await jwt({
      token: { id: "" },
      user: {
        id: "user-123",
        email: "ada@example.com",
        name: "Ada",
        image: null,
      },
      account: null,
    });

    expect(token.id).toBe("user-123");
  });

  it("session exposes the token id as session.user.id", async () => {
    const session = authOptions.callbacks!.session!;

    const result = (await session({
      session: {
        user: { id: "", email: "ada@example.com" },
        expires: "2099-01-01T00:00:00.000Z",
      },
      token: { id: "user-123" },
      user: { id: "ignored", email: "ada@example.com", emailVerified: null },
      newSession: undefined,
      trigger: "update",
    })) as Session;

    expect(result.user.id).toBe("user-123");
  });
});
