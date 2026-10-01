import { describe, expect, it } from "vitest";
import type { AuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { authOptions } from "./options";

// DATA-4 (docs/specs/core-data-model.md): every signed-in user is signed out
// once when the migration ships — their JWT carries the old (cuid) id,
// `getCurrentUser()` finds no user with it, and that is treated as a revoked
// session.
//
// Exercises the real revocation path directly through `authOptions.callbacks.jwt`,
// the way lib/auth/options.integration.test.ts's "throws when the account no
// longer exists" case does, rather than through `getCurrentUser()` /
// `getServerSession`: that path calls the real `next/headers`, which failed
// here for reasons unrelated to DATA-4 itself (decided 2026-10-01).

const authCallbacks = authOptions.callbacks;
if (!authCallbacks) throw new Error("expected authOptions.callbacks to be configured");

const jwtCallback = authCallbacks.jwt;
if (!jwtCallback) throw new Error("expected authOptions.callbacks.jwt to be configured");

type JwtCallbackParams = Parameters<NonNullable<NonNullable<AuthOptions["callbacks"]>["jwt"]>>[0];

function jwtParams(token: JWT): JwtCallbackParams {
  return { token, account: null } as JwtCallbackParams;
}

describe("getCurrentUser", () => {
  it("DATA-4: a JWT whose id matches no row is treated as a revoked session", async () => {
    // A cuid that matches no `User` row, exactly the shape of a session minted
    // before the migration re-keys every id to a UUIDv7. `checkedAt: 0` forces
    // the revalidation path to actually hit the database, as
    // options.integration.test.ts's "throws when the account no longer exists"
    // case does.
    await expect(
      jwtCallback(
        jwtParams({
          id: "clx0000000000000000000000",
          pwdAt: Date.now(),
          checkedAt: 0,
        } as JWT),
      ),
    ).rejects.toThrow("SessionRevoked");
  });
});
