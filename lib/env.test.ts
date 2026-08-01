import { describe, expect, it } from "vitest";
import { resolveAppUrl } from "./env";

// This value ends up inside emailed reset and confirmation links, where a wrong
// host is invisible until a real user clicks a dead link.

describe("resolveAppUrl", () => {
  it("prefers an explicit APP_URL", () => {
    expect(
      resolveAppUrl({
        APP_URL: "https://buycarmap.com",
        NEXTAUTH_URL: "https://other.example",
        VERCEL_URL: "deployment.vercel.app",
      }),
    ).toBe("https://buycarmap.com");
  });

  it("falls back to NEXTAUTH_URL", () => {
    expect(
      resolveAppUrl({
        NEXTAUTH_URL: "https://buycarmap.com",
        VERCEL_URL: "deployment.vercel.app",
      }),
    ).toBe("https://buycarmap.com");
  });

  it("derives an https URL from VERCEL_URL when nothing is configured", () => {
    // The failure this prevents: a Vercel deploy with neither variable set
    // emailing `http://localhost:3000/reset-password?token=…` to real users.
    expect(resolveAppUrl({ VERCEL_URL: "buycarmap-abc123.vercel.app" })).toBe(
      "https://buycarmap-abc123.vercel.app",
    );
  });

  it("adds the protocol, which VERCEL_URL omits", () => {
    const resolved = resolveAppUrl({ VERCEL_URL: "buycarmap.vercel.app" });

    expect(resolved.startsWith("https://")).toBe(true);
    // A bare host would produce a relative, broken link in an email client.
    expect(resolved).not.toBe("buycarmap.vercel.app");
  });

  it("uses the deployment host, so previews link to themselves", () => {
    expect(resolveAppUrl({ VERCEL_URL: "buycarmap-pr-42.vercel.app" })).toBe(
      "https://buycarmap-pr-42.vercel.app",
    );
  });

  it("falls back to localhost only when nothing at all is set", () => {
    expect(resolveAppUrl({})).toBe("http://localhost:3000");
  });

  it("ignores empty strings rather than treating them as configured", () => {
    // An env var declared but left blank is a common deploy mistake.
    expect(resolveAppUrl({ APP_URL: "", NEXTAUTH_URL: "" })).toBe(
      "http://localhost:3000",
    );
  });
});
