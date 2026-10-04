import { describe, expect, it } from "vitest";
import { auth } from "./auth";

// BAUTH-8 (docs/specs/core-better-auth.md): Google and GitHub keep working
// through Better Auth's social providers, on the callback paths their
// consoles already have registered, so nothing needs to change there.
// lib/auth/auth.ts now wires both the real baseURL and the configured
// providers, so both cases below are green.

describe("BAUTH-8: configured social providers", () => {
  it("BAUTH-8: includes both google and github", () => {
    expect(Object.keys(auth.options.socialProviders).sort()).toEqual(["github", "google"]);
  });

  it("BAUTH-8: the Google callback path is the one already registered in the console today", () => {
    // Today's path, from lib/auth/options.ts's NextAuth config, reusing the
    // test env's APP_URL (vitest.config.ts) the same way resolveAppUrl() does.
    expect(`${auth.options.baseURL}/api/auth/callback/google`).toBe(
      "http://localhost:3000/api/auth/callback/google",
    );
  });

  it("BAUTH-8: the GitHub callback path is the one already registered in the console today", () => {
    expect(`${auth.options.baseURL}/api/auth/callback/github`).toBe(
      "http://localhost:3000/api/auth/callback/github",
    );
  });
});
