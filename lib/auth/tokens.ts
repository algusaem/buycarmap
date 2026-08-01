import { createHash, randomBytes } from "node:crypto";

// Single-use tokens for password reset and email verification.
//
// Only the SHA-256 digest is ever persisted. The raw token exists in the
// emailed link and nowhere else, so a database leak yields no working links.
// SHA-256 (not bcrypt) is correct here: the input is 256 bits of CSPRNG output,
// so there is nothing to brute-force and a slow hash would only add latency.

const TOKEN_BYTES = 32;

export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
// Longer than a password reset: nothing exists to protect yet (the account is
// not created until this is redeemed), and a signup abandoned overnight should
// still be completable in the morning.
export const REGISTRATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Cryptographically random, URL-safe token to put in an emailed link. */
export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/** Digest to store and to look up by. Deterministic, so lookup is an index hit. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function tokenExpiry(ttlMs: number): Date {
  return new Date(Date.now() + ttlMs);
}
