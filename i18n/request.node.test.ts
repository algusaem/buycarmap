import { describe, expect, it } from "vitest";
import { resolveLocale } from "./request";

// FRONT-9 (docs/specs/core-frontend.md) worked examples, verbatim:
//   - cookie `locale=en` → English;
//   - no cookie, `Accept-Language: fr-FR,en;q=0.8` → English;
//   - no cookie, `Accept-Language: fr-FR` → Spanish.
// Plus the edge case the spec names explicitly: an unknown cookie value is
// treated as absent, so it falls through to Accept-Language rather than
// resolving to itself or throwing.

describe("resolveLocale", () => {
  it("FRONT-9: a known cookie value wins over Accept-Language", () => {
    expect(resolveLocale("en", "fr-FR")).toBe("en");
  });

  it("FRONT-9: with no cookie, an Accept-Language listing English falls back to it", () => {
    expect(resolveLocale(undefined, "fr-FR,en;q=0.8")).toBe("en");
  });

  it("FRONT-9: with no cookie and no English in Accept-Language, the default is Spanish", () => {
    expect(resolveLocale(undefined, "fr-FR")).toBe("es");
  });

  it("FRONT-9: an unknown cookie value is treated as absent, not as itself", () => {
    expect(resolveLocale("de", "fr-FR,en;q=0.8")).toBe("en");
  });

  it("FRONT-9: no cookie and no Accept-Language header defaults to Spanish", () => {
    expect(resolveLocale(undefined, null)).toBe("es");
  });
});

// docs/specs/cross-cutting.md CORE-1..4, retargeted from the deleted
// lib/i18n/server.ts's `getLocale()` (FRONT-8/FRONT-9, docs/specs/core-frontend.md)
// onto `resolveLocale`, the pure function `getRequestConfig` above now calls.
// Same ids and expected values as before; what moved is the module under
// test and, with it, the need to mock `next/headers` at all — `resolveLocale`
// takes the cookie value and the Accept-Language header as plain arguments.
describe("resolveLocale (docs/specs/cross-cutting.md CORE-1..4)", () => {
  it("CORE-1: prefers an explicit choice over the browser's preference", () => {
    expect(resolveLocale("en", "es-ES,es;q=0.9")).toBe("en");
  });

  it("CORE-2: falls back to the browser's preferred language when it is supported", () => {
    expect(resolveLocale(undefined, "en-GB,en;q=0.9,fr;q=0.8")).toBe("en");
  });

  it("CORE-2: finds English wherever it appears in the header, not only first", () => {
    // `resolveLocale` checks for any entry starting with "en", not a
    // q-value-weighted rank — fr listed first no longer implies fr wins.
    expect(resolveLocale(undefined, "fr;q=0.2,en;q=0.9")).toBe("en");
  });

  it("CORE-3: defaults to Spanish when nothing else applies", () => {
    expect(resolveLocale(undefined, null)).toBe("es");
  });

  it("CORE-3: defaults to Spanish when no supported language is requested", () => {
    expect(resolveLocale(undefined, "ja-JP,ja;q=0.9")).toBe("es");
  });

  it("CORE-4: ignores a cookie holding an unsupported locale", () => {
    // The cookie is user-writable. Using it as a key straight into the
    // messages tree is how an undefined lookup becomes blank UI.
    expect(resolveLocale("de", "en-GB,en;q=0.9")).toBe("en");
  });

  it("CORE-4: ignores a cookie holding a malformed value", () => {
    expect(resolveLocale("../../etc/passwd", null)).toBe("es");
  });
});
