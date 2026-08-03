import { describe, expect, it } from "vitest";
import { encodeBase32 } from "./base32";
import {
  STEP_SECONDS,
  buildOtpAuthUri,
  deriveCode,
  generateTotpSecret,
  stepForTime,
  verifyTotp,
} from "./totp";

// RFC 6238 Appendix B uses the ASCII seed "12345678901234567890" for SHA-1.
const RFC_SECRET = encodeBase32(
  new TextEncoder().encode("12345678901234567890"),
);

// A secret unrelated to the RFC, for the behavioural tests.
const SECRET = encodeBase32(
  Uint8Array.from({ length: 20 }, (_, i) => (i * 11) % 256),
);

describe("deriveCode against RFC 6238 vectors", () => {
  // The RFC tabulates 8-digit codes. A 6-digit code is the same dynamic
  // truncation reduced mod 10^6 instead of 10^8, i.e. the last six digits —
  // so these expectations come from the published standard, not from running
  // this implementation and writing down whatever it produced.
  it.each([
    [59, "94287082", "287082"],
    [1111111109, "07081804", "081804"],
    [1111111111, "14050471", "050471"],
    [1234567890, "89005924", "005924"],
    [2000000000, "69279037", "279037"],
    [20000000000, "65353130", "353130"],
  ])(
    "at unix time %i the RFC's %s yields %s",
    (unixSeconds, _rfcEightDigits, expectedSixDigits) => {
      const step = stepForTime(unixSeconds * 1000);

      expect(deriveCode(RFC_SECRET, step)).toBe(expectedSixDigits);
    },
  );

  it("matches the RFC's counter values", () => {
    // RFC 6238 Appendix B lists T=1 for 59s and T=0x23523EC for 1111111109s.
    expect(stepForTime(59 * 1000)).toBe(1);
    expect(stepForTime(1111111109 * 1000)).toBe(0x23523ec);
  });
});

describe("stepForTime", () => {
  it("advances once per 30-second period", () => {
    expect(STEP_SECONDS).toBe(30);
    expect(stepForTime(0)).toBe(0);
    expect(stepForTime(29_999)).toBe(0);
    expect(stepForTime(30_000)).toBe(1);
    expect(stepForTime(59_999)).toBe(1);
    expect(stepForTime(60_000)).toBe(2);
  });
});

describe("verifyTotp", () => {
  const now = 1_700_000_000_000;

  it("accepts the code for the current step", () => {
    const code = deriveCode(SECRET, stepForTime(now));

    expect(verifyTotp(SECRET, code, { atMs: now })).toEqual({
      valid: true,
      step: stepForTime(now),
    });
  });

  it("rejects a code derived from a different secret", () => {
    const otherSecret = encodeBase32(new Uint8Array(20).fill(9));
    const code = deriveCode(otherSecret, stepForTime(now));

    expect(verifyTotp(SECRET, code, { atMs: now }).valid).toBe(false);
  });

  it("AUTH-9: accepts the previous step, for a phone running slow", () => {
    const code = deriveCode(SECRET, stepForTime(now) - 1);
    const result = verifyTotp(SECRET, code, { atMs: now });

    expect(result.valid).toBe(true);
    // The step returned is the one the code belonged to, not "now" — that is
    // what makes replay rejection work across the drift window.
    expect(result.step).toBe(stepForTime(now) - 1);
  });

  it("AUTH-9: accepts the next step, for a phone running fast", () => {
    const code = deriveCode(SECRET, stepForTime(now) + 1);

    expect(verifyTotp(SECRET, code, { atMs: now }).valid).toBe(true);
  });

  it("rejects a code two steps old", () => {
    // Beyond ±1 the window would keep an observed code alive for minutes.
    const code = deriveCode(SECRET, stepForTime(now) - 2);

    expect(verifyTotp(SECRET, code, { atMs: now }).valid).toBe(false);
  });

  it("rejects a code two steps ahead", () => {
    const code = deriveCode(SECRET, stepForTime(now) + 2);

    expect(verifyTotp(SECRET, code, { atMs: now }).valid).toBe(false);
  });

  it("ignores the spaces authenticator apps display between digit groups", () => {
    const code = deriveCode(SECRET, stepForTime(now));
    const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;

    expect(verifyTotp(SECRET, spaced, { atMs: now }).valid).toBe(true);
  });

  it.each(["", "12345", "1234567", "abcdef", "12 34", "12345a"])(
    "rejects malformed input %j without attempting verification",
    (input) => {
      expect(verifyTotp(SECRET, input, { atMs: now })).toEqual({
        valid: false,
        step: null,
      });
    },
  );
});

describe("generateTotpSecret", () => {
  it("produces a base32 secret an authenticator app can read", () => {
    const secret = generateTotpSecret();

    // 20 bytes -> 32 base32 characters, and only alphabet characters.
    expect(secret.replace(/=/g, "")).toMatch(/^[A-Z2-7]{32}$/);
  });

  it("never repeats", () => {
    const secrets = new Set(Array.from({ length: 200 }, generateTotpSecret));

    expect(secrets.size).toBe(200);
  });

  it("produces secrets that verify against their own codes", () => {
    const secret = generateTotpSecret();
    const now = Date.now();

    expect(
      verifyTotp(secret, deriveCode(secret, stepForTime(now)), { atMs: now })
        .valid,
    ).toBe(true);
  });
});

describe("buildOtpAuthUri", () => {
  const uri = buildOtpAuthUri("JBSWY3DPEHPK3PXP", "ada@example.com");

  it("uses the otpauth scheme apps register for", () => {
    expect(uri.startsWith("otpauth://totp/")).toBe(true);
  });

  it("labels the entry with issuer and account", () => {
    // Both the "Issuer:account" label prefix and the issuer parameter — older
    // and newer apps read different ones, and missing either shows the entry
    // unlabelled in the user's app.
    expect(decodeURIComponent(uri)).toContain("BuyCarMap:ada@example.com");
    expect(uri).toContain("issuer=BuyCarMap");
  });

  it("declares the parameters this implementation actually uses", () => {
    expect(uri).toContain("algorithm=SHA1");
    expect(uri).toContain("digits=6");
    expect(uri).toContain("period=30");
  });

  it("strips base32 padding, which some apps reject", () => {
    const padded = buildOtpAuthUri("MZXW6===", "ada@example.com");

    expect(padded).toContain("secret=MZXW6");
    expect(padded).not.toContain("%3D");
  });
});
