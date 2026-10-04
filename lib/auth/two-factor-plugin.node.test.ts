import { describe, expect, it } from "vitest";
import { auth } from "./auth";

// BAUTH-11 (docs/specs/core-better-auth.md): two-factor has moved onto
// Better Auth's own `twoFactor` plugin, with AUTH-9's TOTP parameters (SHA-1,
// 6 digits, 30s step, ±1 step drift — the algorithm and drift window are the
// plugin's fixed defaults, not configured here). lib/auth/auth.ts now
// registers the plugin, so both cases below are green.

// `auth.options.plugins` is currently just `[nextCookies()]` (phase 11, part
// 1) — its inferred element type has no "two-factor" id and no
// `totpOptions`, so both lines below widen to the shape phase 12 is meant to
// add, the same shape lib/auth/auth.ts's pre-phase-11 stub declared. The
// `as` cast is a type widening, not an `any`/`unknown` escape: both
// assertions below still run against the real `auth.options.plugins` array
// and stay red until that plugin is actually there.
interface StubTwoFactorPlugin {
  id: string;
  totpOptions?: { digits: number; period: number };
}

describe("BAUTH-11: the twoFactor plugin", () => {
  it('BAUTH-11: auth.options.plugins includes an entry with id "two-factor"', () => {
    const plugins = auth.options.plugins as StubTwoFactorPlugin[];
    expect(plugins.some((plugin) => plugin.id === "two-factor")).toBe(true);
  });

  it("BAUTH-11: its totpOptions match AUTH-9 (6 digits, 30s step)", () => {
    const plugins = auth.options.plugins as StubTwoFactorPlugin[];
    const twoFactorPlugin = plugins.find((plugin) => plugin.id === "two-factor");

    expect(twoFactorPlugin?.totpOptions).toEqual({ digits: 6, period: 30 });
  });
});
