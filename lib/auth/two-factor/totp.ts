import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { decodeBase32, encodeBase32 } from "./base32";

// RFC 6238 TOTP, implemented directly on node:crypto rather than pulled from a
// package — it is an HMAC, a counter and a modulo, and a dependency in the
// authentication path is a dependency that can be compromised.
//
// The parameters are not configurable because they are what Google
// Authenticator, Authy, 1Password and the rest assume by default. Changing any
// of them silently breaks enrolment for every real-world app.
const ALGORITHM = "sha1";
const DIGITS = 6;
export const STEP_SECONDS = 30;

// How many steps either side of "now" are accepted, to tolerate clock drift
// between the phone and the server. One step means codes stay valid for at
// most 90 seconds; more than that widens the window an intercepted code is
// useful in, for very little usability gain.
const DEFAULT_WINDOW = 1;

// 20 bytes is the RFC's recommendation for SHA-1 and what authenticator apps
// expect; it is also the HMAC-SHA1 block-adjacent size, so nothing is wasted.
const SECRET_BYTES = 20;

/** A fresh base32 secret, ready to hand to an authenticator app. */
export function generateTotpSecret(): string {
  return encodeBase32(randomBytes(SECRET_BYTES));
}

/** The counter value for a moment in time. */
export function stepForTime(atMs: number): number {
  return Math.floor(atMs / 1000 / STEP_SECONDS);
}

/**
 * The 6-digit code for a given counter step.
 *
 * This is the "dynamic truncation" of RFC 4226 §5.3: the low nibble of the
 * last byte selects a 4-byte window of the HMAC, the top bit is masked off to
 * dodge signed-integer issues across languages, and the result is reduced to
 * the digit count.
 */
export function deriveCode(secretBase32: string, step: number): string {
  const key = Buffer.from(decodeBase32(secretBase32));

  // The counter is a 64-bit big-endian integer. `writeBigUInt64BE` keeps this
  // correct past 2038, which a 32-bit write would not.
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));

  const digest = createHmac(ALGORITHM, key).update(counter).digest();

  const offset = digest[digest.length - 1] & 0x0f;
  const truncated =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return (truncated % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

/** Constant-time comparison, so a wrong code leaks nothing through timing. */
function codesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");

  // timingSafeEqual throws on a length mismatch, which would itself be a
  // timing signal — compare lengths first and keep the work constant after.
  if (left.length !== right.length) return false;

  return timingSafeEqual(left, right);
}

export interface TotpVerification {
  valid: boolean;
  /**
   * The counter step the code belonged to. Callers must persist this and
   * refuse anything less than or equal to it next time, otherwise a code
   * observed over someone's shoulder stays usable for its whole window.
   */
  step: number | null;
}

export function verifyTotp(
  secretBase32: string,
  code: string,
  options: { atMs?: number; window?: number } = {},
): TotpVerification {
  const normalized = code.replace(/\s/g, "");

  if (!/^\d{6}$/.test(normalized)) {
    return { valid: false, step: null };
  }

  const atMs = options.atMs ?? Date.now();
  const window = options.window ?? DEFAULT_WINDOW;
  const currentStep = stepForTime(atMs);

  for (let offset = -window; offset <= window; offset++) {
    const step = currentStep + offset;

    if (codesMatch(deriveCode(secretBase32, step), normalized)) {
      return { valid: true, step };
    }
  }

  return { valid: false, step: null };
}

/**
 * The `otpauth://` URI an authenticator app scans.
 *
 * The label carries the issuer twice — as a prefix and as a parameter —
 * because older apps read one and newer ones the other, and getting it wrong
 * means every account in the user's app shows up as an unlabelled entry.
 */
export function buildOtpAuthUri(
  secretBase32: string,
  accountEmail: string,
  issuer = "BuyCarMap",
): string {
  const label = encodeURIComponent(`${issuer}:${accountEmail}`);
  const params = new URLSearchParams({
    secret: secretBase32.replace(/=+$/, ""),
    issuer,
    algorithm: ALGORITHM.toUpperCase(),
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });

  return `otpauth://totp/${label}?${params.toString()}`;
}
