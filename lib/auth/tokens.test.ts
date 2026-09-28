import { describe, expect, it } from "vitest";
import { PASSWORD_RESET_TTL_MS, generateToken, hashToken, tokenExpiry } from "./tokens";

describe("generateToken", () => {
  it("produces a URL-safe token with 256 bits of entropy", () => {
    const token = generateToken();

    // 32 random bytes in base64url: 43 characters, no padding, no "+" or "/"
    // that would need escaping inside a reset link.
    expect(token).toHaveLength(43);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("never repeats across many draws", () => {
    const tokens = new Set(Array.from({ length: 500 }, generateToken));
    expect(tokens.size).toBe(500);
  });
});

describe("hashToken", () => {
  it("matches the known SHA-256 digest of a fixed input", () => {
    // Hand-derived: the SHA-256 of the ASCII string "abc" is a published test
    // vector, so this pins both the algorithm and the encoding.
    expect(hashToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("is deterministic, so a token can be looked up by its digest", () => {
    const token = generateToken();
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it("does not return the token itself", () => {
    const token = generateToken();

    // The digest is what gets stored; if these matched, a database leak would
    // hand over working reset links.
    expect(hashToken(token)).not.toBe(token);
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("gives different digests to different tokens", () => {
    expect(hashToken("token-a")).not.toBe(hashToken("token-b"));
  });
});

describe("tokenExpiry", () => {
  it("returns a moment the given TTL into the future", () => {
    const before = Date.now();
    const expiry = tokenExpiry(PASSWORD_RESET_TTL_MS).getTime();
    const after = Date.now();

    expect(expiry).toBeGreaterThanOrEqual(before + PASSWORD_RESET_TTL_MS);
    expect(expiry).toBeLessThanOrEqual(after + PASSWORD_RESET_TTL_MS);
  });

  it("keeps the password-reset window short", () => {
    // A long-lived reset link sitting in an inbox is the main risk here.
    expect(PASSWORD_RESET_TTL_MS).toBeLessThanOrEqual(60 * 60 * 1000);
  });
});
