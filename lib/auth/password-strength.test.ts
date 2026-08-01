import { describe, expect, it } from "vitest";
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  evaluatePassword,
} from "./password-strength";

describe("evaluatePassword length rules", () => {
  it("reports an empty password as the bottom band", () => {
    expect(evaluatePassword("")).toEqual({ score: 0, issues: ["tooShort"] });
  });

  it("flags one character below the minimum", () => {
    const password = "Thunder-Rug1"; // 12 chars
    expect(password).toHaveLength(MIN_PASSWORD_LENGTH);

    const short = password.slice(0, MIN_PASSWORD_LENGTH - 1);
    expect(evaluatePassword(short).issues).toContain("tooShort");
    expect(evaluatePassword(password).issues).not.toContain("tooShort");
  });

  it("flags one character above the maximum", () => {
    // Past 72 bytes bcrypt silently truncates, so the extra characters would
    // give a false sense of strength.
    const atLimit = "a1B!".repeat(MAX_PASSWORD_LENGTH / 4);
    expect(atLimit).toHaveLength(MAX_PASSWORD_LENGTH);

    expect(evaluatePassword(atLimit).issues).not.toContain("tooLong");
    expect(evaluatePassword(`${atLimit}x`).issues).toContain("tooLong");
  });
});

describe("evaluatePassword blocklist", () => {
  it.each(["password", "1234567890", "qwertyuiop", "contrasena"])(
    "scores the common password %j at the bottom band",
    (password) => {
      const { score, issues } = evaluatePassword(password);
      expect(issues).toContain("common");
      expect(score).toBe(0);
    },
  );

  it("matches a numeric blocklist entry, which has no letters to canonicalize", () => {
    // Leetspeak canonicalization strips digits, so an all-numeric password can
    // only be caught by comparing the raw form as well.
    expect(evaluatePassword("1234567890").issues).toContain("common");
  });

  it("sees through leetspeak decoration", () => {
    // The whole point of a blocklist is that "P@ssw0rd" is not a new password.
    // It is also long enough to pass a length-only rule, which is what makes
    // the canonicalization worth having.
    const { score, issues } = evaluatePassword("P@ssw0rd123!");
    expect(issues).toContain("common");
    expect(score).toBe(0);
  });

  it("does not flag an ordinary passphrase as common", () => {
    expect(evaluatePassword("harbour-lentil-quilt").issues).not.toContain(
      "common",
    );
  });
});

describe("evaluatePassword pattern detection", () => {
  it("flags ascending and descending character runs", () => {
    expect(evaluatePassword("abcdefgh-xk9Q").issues).toContain("sequential");
    expect(evaluatePassword("9876-plumRx!z").issues).toContain("sequential");
  });

  it("does not flag a run shorter than four characters", () => {
    // "abc" appears constantly in ordinary words; only longer runs are signal.
    expect(evaluatePassword("abc-thunder-Rug9").issues).not.toContain(
      "sequential",
    );
  });

  it("flags keyboard rows in both directions", () => {
    expect(evaluatePassword("asdf-thunder9X").issues).toContain("sequential");
    expect(evaluatePassword("poiu-thunder9X").issues).toContain("sequential");
  });

  it("flags a character repeated three or more times", () => {
    expect(evaluatePassword("thunderrrRug99").issues).toContain("repeated");
    expect(evaluatePassword("thunderrRug99").issues).not.toContain("repeated");
  });
});

describe("evaluatePassword personal information", () => {
  it("flags a password containing the email's local part", () => {
    const { score, issues } = evaluatePassword("adalovelace-2026-quilt", [
      "adalovelace@example.com",
    ]);

    expect(issues).toContain("personal");
    // Collapses to the bottom band: length cannot rescue a password that is
    // the user's own identity, since that is an attacker's first guess.
    expect(score).toBe(0);
  });

  it("ignores the email's domain, which every user at that host shares", () => {
    expect(
      evaluatePassword("example-harbour-quilt", ["ada@example.com"]).issues,
    ).not.toContain("personal");
  });

  it("ignores user inputs shorter than three characters", () => {
    expect(evaluatePassword("harbour-lentil-quilt", ["ad"]).issues).not.toContain(
      "personal",
    );
  });
});

describe("evaluatePassword scoring bands", () => {
  it("ranks a long random passphrase above a short mixed-class password", () => {
    // Length beats composition — the NIST position this policy is built on.
    const longPassphrase = evaluatePassword("harbour lentil quilt zenith");
    const shortComplex = evaluatePassword("Xk9!qZ");

    expect(longPassphrase.score).toBeGreaterThan(shortComplex.score);
  });

  it("never rates a sub-minimum password above the second band", () => {
    // Even maximal character variety cannot buy a short password a passing
    // grade, because the server rejects it on length anyway.
    expect(evaluatePassword("Xk9!qZ@2v").score).toBeLessThanOrEqual(1);
  });

  it("rates a long, varied passphrase at the top band", () => {
    expect(evaluatePassword("harbour-lentil-quilt-97").score).toBe(4);
  });

  it("discounts a password whose length comes from a sequence", () => {
    // Same length, but one is padded with a predictable run.
    const padded = evaluatePassword("quilt-abcdefghij");
    const varied = evaluatePassword("quilt-harbour-97");

    expect(padded.score).toBeLessThan(varied.score);
  });
});
