import { describe, expect, it } from "vitest";
import { createUser } from "@/test/factories/user";
import { mayAutoLink } from "./linking";

// BAUTH-9 (docs/specs/core-better-auth.md): `mayAutoLink` only refuses an
// implicit auto-link for a local account with two-factor on, or with an
// unconfirmed email (`emailConfirmed`, Better Auth's own boolean —
// `lib/auth/auth.ts` maps its `emailVerified` onto this column, not onto the
// legacy `emailVerified` DateTime, which these tests used to read). The
// "both sides verified" half of BAUTH-9 is enforced upstream by Better Auth
// itself now that `account.accountLinking` carries no `trustedProviders`
// (`lib/auth/auth.ts`), so this function no longer takes a
// `providerEmailVerified` flag at all — see this file's git history.

describe("BAUTH-9 worked example: auto-linking refuses two-factor or an unconfirmed email", () => {
  it("BAUTH-9 (AUTH-12, carried over): refuses when the local account has two-factor enabled", async () => {
    const user = await createUser({
      email: "ana@example.test",
      emailConfirmed: true,
      twoFactorEnabled: true,
    });

    expect(
      mayAutoLink({
        localUser: {
          twoFactorEnabled: user.twoFactorEnabled,
          emailConfirmed: user.emailConfirmed,
        },
      }),
    ).toBe(false);
  });

  it("BAUTH-9: refuses when the local account's email is unconfirmed", async () => {
    const user = await createUser({
      email: "bob@example.test",
      emailConfirmed: false,
      twoFactorEnabled: false,
    });

    expect(
      mayAutoLink({
        localUser: {
          twoFactorEnabled: user.twoFactorEnabled,
          emailConfirmed: user.emailConfirmed,
        },
      }),
    ).toBe(false);
  });

  it("BAUTH-9: allows when the local email is confirmed and there is no two-factor", async () => {
    const user = await createUser({
      email: "carol@example.test",
      emailConfirmed: true,
      twoFactorEnabled: false,
    });

    expect(
      mayAutoLink({
        localUser: {
          twoFactorEnabled: user.twoFactorEnabled,
          emailConfirmed: user.emailConfirmed,
        },
      }),
    ).toBe(true);
  });
});
