import { describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createUser } from "@/test/factories/user";
import { hashPassword, verifyPassword } from "@/lib/auth/hash";
import { auth, signSessionToken } from "./auth";
import { getCurrentUser } from "./session";

// BAUTH-2's cookie mock below replaces next/headers' real `cookies()` with a
// store this file controls, so a single test file can simulate "browser A's
// cookie jar" and "browser B's cookie jar" without a real HTTP round trip.
const cookieStore = { get: vi.fn() };
vi.mock("next/headers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/headers")>()),
  cookies: vi.fn(async () => cookieStore),
}));
// changePassword emails a confirmation; both are side effects this file does
// not assert on, same mocks server/account/actions.integration.test.ts uses.
vi.mock("@/lib/platform/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("next-intl/server", () => ({ getLocale: vi.fn(async () => "en") }));

// The former DATA-4 case here exercised NextAuth's `authOptions.callbacks.jwt`
// directly (a cuid-shaped JWT id matching no row, treated as revoked). BAUTH-1
// removes `lib/auth/options.ts` entirely, and BAUTH-15 covers the equivalent
// cutover property for Better Auth (server/auth/cutover.node.test.ts); this
// file's own worked example below is the Better Auth session-revocation case
// in the same spirit, so the NextAuth-specific one is deleted rather than
// ported.

// BAUTH-2 (docs/specs/core-better-auth.md): revoking a session — here, by
// changing the password on one device — must end it on the very next
// request from any OTHER device.
describe("BAUTH-2 worked example: changing the password signs other sessions out", () => {
  it("BAUTH-2: the other browser's next getCurrentUser() call returns null", async () => {
    // A real bcrypt hash, not a placeholder: `auth.api.signInEmail` below
    // verifies it for real (Better Auth's own `verify`, configured in
    // lib/auth/auth.ts, is our real `verifyPassword`), as does
    // `changePassword`'s own current-password check.
    const user = await createUser({ password: await hashPassword("the-old-password") });

    // Two sessions for U, created through Better Auth itself — "browser A"
    // and "browser B".
    const sessionA = await auth.api.signInEmail({
      body: { email: user.email, password: "the-old-password" },
    });
    const sessionB = await auth.api.signInEmail({
      body: { email: user.email, password: "the-old-password" },
    });

    // Browser A changes the password. The cookie store holds the SIGNED
    // value `auth.api.getSession` actually verifies (what a real
    // `Set-Cookie` would have carried), not the raw token `signInEmail`
    // returns.
    const cookieA = await signSessionToken(sessionA.token);
    cookieStore.get.mockImplementation((name: string) =>
      name === cookieA.name ? { value: cookieA.value } : undefined,
    );

    const { changePassword } = await import("@/server/account/actions");
    const formData = new FormData();
    formData.set("currentPassword", "the-old-password");
    formData.set("password", "harbour-lentil-quilt");
    formData.set("confirmPassword", "harbour-lentil-quilt");
    formData.set("version", "1");

    expect(await changePassword(formData)).toEqual({ success: true });

    // Only A's own session survives — AUTH-5's "every other session" rule.
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(1);

    // Browser B's cookie is now for a deleted session row.
    const cookieB = await signSessionToken(sessionB.token);
    cookieStore.get.mockImplementation((name: string) =>
      name === cookieB.name ? { value: cookieB.value } : undefined,
    );

    expect(await getCurrentUser()).toBeNull();
  });
});

// BAUTH-19 (docs/specs/core-better-auth.md), worked example (b): a password
// change writes only the credential `accounts` row. `users.password` is no
// longer a Prisma field, so it is read back with a raw select.
describe("BAUTH-19 worked example: changing the password writes only the credential account", () => {
  it("BAUTH-19: the credential account holds the new hash, users.password is untouched, and the new password signs in", async () => {
    const user = await createUser({ password: await hashPassword("the-old-password") });
    const readLegacyPassword = async () =>
      (
        await prisma.$queryRaw<{ password: string | null }[]>`
          SELECT password FROM users WHERE id = ${user.id}::uuid`
      )[0]?.password;
    const legacyBefore = await readLegacyPassword();

    const session = await auth.api.signInEmail({
      body: { email: user.email, password: "the-old-password" },
    });
    const cookie = await signSessionToken(session.token);
    cookieStore.get.mockImplementation((name: string) =>
      name === cookie.name ? { value: cookie.value } : undefined,
    );

    const { changePassword } = await import("@/server/account/actions");
    const formData = new FormData();
    formData.set("currentPassword", "the-old-password");
    formData.set("password", "harbour-lentil-quilt");
    formData.set("confirmPassword", "harbour-lentil-quilt");
    formData.set("version", "1");

    expect(await changePassword(formData)).toEqual({ success: true });

    const credential = await prisma.account.findFirst({
      where: { userId: user.id, provider: "credential" },
      select: { password: true },
    });
    expect(await verifyPassword("harbour-lentil-quilt", credential?.password ?? "")).toBe(true);
    expect(await readLegacyPassword()).toBe(legacyBefore);

    const signedIn = await auth.api.signInEmail({
      body: { email: user.email, password: "harbour-lentil-quilt" },
    });
    expect(signedIn.token).toEqual(expect.any(String));
  });
});
