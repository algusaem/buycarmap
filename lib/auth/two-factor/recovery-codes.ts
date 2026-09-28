import { createHash, randomBytes } from "node:crypto";

// The way back in when the phone is lost. Without these, losing the
// authenticator means losing the account outright — password reset must not
// bypass 2FA, or the second factor would be worth nothing.

export const RECOVERY_CODE_COUNT = 10;

// Crockford-ish alphabet: no O/0, no I/1, so a code read off a screen and typed
// by hand does not fail on ambiguity.
const ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
const GROUP_LENGTH = 5;
const GROUPS = 3;

// 15 characters from a 30-symbol alphabet is a little over 73 bits. That is
// far beyond guessing, which is what lets these be stored as a plain SHA-256
// digest rather than a slow hash: there is no dictionary to grind, and login
// has to check a submitted code against the stored set on every attempt.
function generateCode(): string {
  const bytes = randomBytes(GROUP_LENGTH * GROUPS);
  const characters = Array.from(
    bytes,
    // Modulo bias here is negligible (256 % 30 = 16 of 256 values slightly
    // favoured) and costs well under a bit of the 73.
    (byte) => ALPHABET[byte % ALPHABET.length],
  );

  return Array.from({ length: GROUPS }, (_, group) =>
    characters.slice(group * GROUP_LENGTH, (group + 1) * GROUP_LENGTH).join(""),
  ).join("-");
}

/** Strips formatting so "abcde-fghij" and "ABCDEFGHIJ" are the same code. */
export function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Digest to store and to look up by. Normalized first, so input style is irrelevant. */
export function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(normalizeRecoveryCode(code), "utf8").digest("hex");
}

export interface GeneratedRecoveryCodes {
  /** Shown to the user exactly once, at generation time. */
  plain: string[];
  /** What gets persisted. */
  hashes: string[];
}

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): GeneratedRecoveryCodes {
  const plain = Array.from({ length: count }, generateCode);

  return { plain, hashes: plain.map(hashRecoveryCode) };
}
