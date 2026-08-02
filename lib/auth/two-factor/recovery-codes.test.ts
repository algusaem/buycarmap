import { describe, expect, it } from "vitest";
import {
  RECOVERY_CODE_COUNT,
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeRecoveryCode,
} from "./recovery-codes";

describe("generateRecoveryCodes", () => {
  it("produces the configured number of codes", () => {
    expect(generateRecoveryCodes().plain).toHaveLength(RECOVERY_CODE_COUNT);
  });

  it("formats codes in readable groups", () => {
    for (const code of generateRecoveryCodes().plain) {
      expect(code).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}$/);
    }
  });

  it("omits the characters people misread", () => {
    // No O/0 or I/1: these get read off a screen and typed by hand.
    const joined = generateRecoveryCodes(50).plain.join("");

    expect(joined).not.toMatch(/[O0I1L]/);
  });

  it("never repeats a code within a set", () => {
    const { plain } = generateRecoveryCodes(RECOVERY_CODE_COUNT);

    expect(new Set(plain).size).toBe(RECOVERY_CODE_COUNT);
  });

  it("never repeats across sets", () => {
    const all = Array.from({ length: 20 }, () =>
      generateRecoveryCodes().plain,
    ).flat();

    expect(new Set(all).size).toBe(all.length);
  });

  it("returns a hash for each code, and never the code itself", () => {
    const { plain, hashes } = generateRecoveryCodes();

    expect(hashes).toHaveLength(plain.length);
    for (const [index, hash] of hashes.entries()) {
      expect(hash).toBe(hashRecoveryCode(plain[index]));
      expect(hash).not.toContain(normalizeRecoveryCode(plain[index]));
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

describe("normalizeRecoveryCode", () => {
  it("accepts the code as displayed", () => {
    expect(normalizeRecoveryCode("ABCDE-FGHJK-MNPQR")).toBe(
      "ABCDEFGHJKMNPQR",
    );
  });

  it("accepts lowercase and missing dashes", () => {
    // Someone retyping from paper will not reproduce the formatting exactly.
    expect(normalizeRecoveryCode("abcdefghjkmnpqr")).toBe("ABCDEFGHJKMNPQR");
  });

  it("ignores stray whitespace from a copy-paste", () => {
    expect(normalizeRecoveryCode(" ABCDE FGHJK\tMNPQR \n")).toBe(
      "ABCDEFGHJKMNPQR",
    );
  });
});

describe("hashRecoveryCode", () => {
  it("is stable, so a code can be looked up by its digest", () => {
    expect(hashRecoveryCode("ABCDE-FGHJK-MNPQR")).toBe(
      hashRecoveryCode("ABCDE-FGHJK-MNPQR"),
    );
  });

  it("treats formatting variants of one code as the same code", () => {
    const canonical = hashRecoveryCode("ABCDE-FGHJK-MNPQR");

    expect(hashRecoveryCode("abcde-fghjk-mnpqr")).toBe(canonical);
    expect(hashRecoveryCode("ABCDEFGHJKMNPQR")).toBe(canonical);
    expect(hashRecoveryCode(" abcde fghjk mnpqr ")).toBe(canonical);
  });

  it("gives different codes different digests", () => {
    expect(hashRecoveryCode("ABCDE-FGHJK-MNPQR")).not.toBe(
      hashRecoveryCode("ABCDE-FGHJK-MNPQS"),
    );
  });

  it("matches the known SHA-256 of the normalized input", () => {
    // "a-b-c" normalizes to "ABC" — uppercased, punctuation stripped — so the
    // expectation is SHA-256("ABC"), not SHA-256("abc"). Pinning it this way
    // catches both a change of algorithm and a change to normalization: if
    // uppercasing were dropped, this would produce the "abc" digest instead
    // (ba7816bf…) and fail.
    expect(hashRecoveryCode("a-b-c")).toBe(
      "b5d4045c3f466fa91fe2cc6abe79232a1a57cdf104f7a26e716e0a1e2789df78",
    );
  });
});
