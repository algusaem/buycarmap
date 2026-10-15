import { describe, expect, it } from "vitest";
import { auth } from "./auth";

// BAUTH-8 (docs/specs/core-better-auth.md), amended by
// docs/specs/redesign-entry.md (ENTRY-18): Google is the only social provider
// Better Auth wires up — GitHub sign-in is removed, not kept "if configured".

describe("BAUTH-8: configured social providers", () => {
  it("BAUTH-8: includes google and no other provider", () => {
    expect(Object.keys(auth.options.socialProviders).sort()).toEqual(["google"]);
  });

  it("BAUTH-8: the Google callback path is the one already registered in the console today", () => {
    // Today's path, from lib/auth/options.ts's NextAuth config, reusing the
    // test env's APP_URL (vitest.config.ts) the same way resolveAppUrl() does.
    expect(`${auth.options.baseURL}/api/auth/callback/google`).toBe(
      "http://localhost:3000/api/auth/callback/google",
    );
  });
});
