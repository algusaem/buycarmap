import { describe, expect, it } from "vitest";
import { safeRedirectTarget } from "./safe-redirect";

// docs/specs/redesign-entry.md (ENTRY-17), worked example table verbatim.
// ENTRY-17's security fix: the sign-in flow only ever follows a `callbackUrl`
// that resolves to this site's own origin — checked by actually resolving it
// against `origin` with `new URL`, not by pattern-matching the string (which
// is how the backslash row below slipped through LoginForm.tsx's old
// `startsWith("/") && !startsWith("//")` check).
const ORIGIN = "http://localhost:3000";

describe("ENTRY-17: safeRedirectTarget — the worked example table", () => {
  it.each([
    ["/favorites", "/favorites"],
    ["/map?make=Toyota&radius=50", "/map?make=Toyota&radius=50"],
    ["https://evil.example", "/"],
    ["//evil.example", "/"],
    // The literal backslash a decoded "?callbackUrl=%2F%5Cevil.example" query
    // param becomes once searchParams.get() auto-decodes it. A browser reads
    // "/\evil.example" as "//evil.example" (backslash normalised to slash
    // before the "//" protocol-relative check), resolving to evil.example's
    // origin — the bug `safeRedirectTarget`'s backslash check rejects below.
    ["/\\evil.example", "/"],
    ["javascript:alert(1)", "/"],
    // A dot-segment path normalises to a pathname starting with "//", which
    // a browser reads as protocol-relative even though the resolved origin
    // still matches `ORIGIN` — caught by the pathname check, not the origin
    // check.
    ["/.//evil.example", "/"],
    ["/..//evil.example", "/"],
    ["/%2e//evil.example", "/"],
    ["/a/..//evil.example", "/"],
    // A control character (here, a tab) between the slashes — rejected
    // outright, before the value ever reaches `new URL`.
    ["/\t/evil.example", "/"],
    // F4 review round 2: the raw strings from the bug report, caught by the
    // pre-`new URL` regex (the string itself starts with "/%5c"/"/%2f").
    ["/%5Cevil.example", "/"],
    ["/%2Fevil.example", "/"],
    // Caught only by the new post-resolution check: the raw string starts
    // with "/a" and "/.", not "/%2f" or "/%5c" — it is the *resolved*
    // pathname, after the URL parser's own dot-segment removal (which treats
    // "%2e%2e" as ".." and drops the "a" segment it pops), that begins with
    // "/%2fevil.example".
    ["/a/%2e%2e/%2fevil.example", "/"],
    ["/./%2fevil", "/"],
  ])("ENTRY-17: %j resolves to %j", (callbackUrl, expected) => {
    expect(safeRedirectTarget(callbackUrl, ORIGIN)).toBe(expected);
  });

  it("ENTRY-17: a missing callbackUrl (null) resolves to /", () => {
    expect(safeRedirectTarget(null, ORIGIN)).toBe("/");
  });
});
