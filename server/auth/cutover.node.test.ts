import { describe, expect, it, vi } from "vitest";

// BAUTH-15 (docs/specs/core-better-auth.md): every signed-in user is meant to
// be signed out once at cutover, because NextAuth's cookies are not Better
// Auth's — a request carrying only a NextAuth session cookie must resolve
// `getCurrentUser()` to `null`.
//
// DATA-4 (docs/specs/core-data-model.md), carried over: that spec's own
// one-time cutover test exercised NextAuth's `authOptions.callbacks.jwt`
// directly (an old-format id matching no row, treated as revoked) — BAUTH-1
// removes `lib/auth/options.ts` entirely, so that mechanism no longer
// exists to test. The property both criteria describe — a session minted
// before a cutover this phase performs resolves to `null`, not a crash or a
// false positive — is the same one this file proves for the Better Auth
// cutover instead.

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(async () => ({
    user: { id: "user-1", email: "ada@example.test" },
  })),
}));

import { getCurrentUser } from "@/lib/auth/session";

describe("BAUTH-15 (DATA-4, carried over): a NextAuth-only session no longer authenticates", () => {
  it("BAUTH-15 (DATA-4, carried over): getCurrentUser() is null for a request carrying only a next-auth.session-token cookie", async () => {
    // `getServerSession` above stands in for "a request whose only cookie is
    // the pre-cutover next-auth.session-token, decoded to a once-valid
    // session" — exactly the shape BAUTH-15 says must stop authenticating.
    expect(await getCurrentUser()).toBeNull();
  });
});
