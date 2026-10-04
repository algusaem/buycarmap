import { createHmac } from "node:crypto";

// Test-only (BAUTH-11, docs/specs/core-better-auth.md): derives the code
// Better Auth's `twoFactor` plugin itself would produce for a given
// `otpauth://` URI, so tests never need to see the plugin's raw secret.
//
// The URI's `secret` query parameter is base32 only for scanning/display —
// `@better-auth/utils`' `createOTP` signs the secret string's own UTF-8
// bytes directly (`createHMAC(...).sign(secret, counter)`, where `secret` is
// never base32-decoded first). Base32-*decoding* that same query parameter
// recovers exactly those bytes, because encoding and decoding are inverses:
// what the plugin signs and what this derives the key from are the same
// bytes, just reached from opposite directions.

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function decodeBase32(input: string): Buffer {
  const bytes: number[] = [];
  let buffer = 0;
  let bitsCollected = 0;

  for (const char of input.toUpperCase()) {
    if (char === "=") continue;
    const value = BASE32_ALPHABET.indexOf(char);
    if (value === -1) continue;
    buffer = (buffer << 5) | value;
    bitsCollected += 5;
    if (bitsCollected >= 8) {
      bitsCollected -= 8;
      bytes.push((buffer >> bitsCollected) & 0xff);
    }
  }

  return Buffer.from(bytes);
}

/** The counter step for a moment in time, at the plugin's fixed 30s period. */
export function stepForTime(atMs: number, periodSeconds = 30): number {
  return Math.floor(atMs / 1000 / periodSeconds);
}

/** The 6-digit TOTP code for a given counter step (RFC 4226 §5.3 dynamic truncation). */
export function deriveCodeForStep(secretParam: string, step: number, digits = 6): string {
  const key = decodeBase32(secretParam);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));

  const digest = createHmac("sha1", key).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const truncated =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return (truncated % 10 ** digits).toString().padStart(digits, "0");
}

/** Parses the `secret` query parameter straight off an `otpauth://` URI. */
function secretFromOtpauthUri(otpauthUri: string): string {
  const query = otpauthUri.split("?")[1] ?? "";
  return new URLSearchParams(query).get("secret") ?? "";
}

/** The current TOTP code for an `otpauth://` URI, at `atMs` (default now). */
export function deriveCodeFromUri(otpauthUri: string, atMs: number = Date.now()): string {
  return deriveCodeForStep(secretFromOtpauthUri(otpauthUri), stepForTime(atMs));
}
