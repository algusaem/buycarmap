import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

// TOTP secrets are encrypted at rest, not hashed: verifying a code requires
// recomputing the HMAC from the original secret, so it has to be recoverable.
// That makes the database alone insufficient — an attacker also needs
// TWO_FACTOR_ENCRYPTION_KEY, which lives in the environment.
//
// AES-256-GCM rather than CBC: it authenticates as well as encrypts, so a
// tampered ciphertext fails loudly instead of decrypting to garbage that then
// gets fed into an HMAC.

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12; // 96 bits, the size GCM is specified for.
const FORMAT_VERSION = "v1";

function loadKey(rawKey: string): Buffer {
  const key = Buffer.from(rawKey, "base64");

  if (key.length !== KEY_BYTES) {
    throw new Error(
      `TWO_FACTOR_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (got ${key.length}). Generate one with: openssl rand -base64 32`,
    );
  }

  return key;
}

/**
 * Encrypts a TOTP secret for storage.
 *
 * Output is `v1:<iv>:<authTag>:<ciphertext>`, all base64. The version prefix
 * is there so a future algorithm change can be rolled out without guessing at
 * what existing rows contain.
 */
export function encryptSecret(plaintext: string, rawKey: string): string {
  const key = loadKey(rawKey);
  // A fresh IV per encryption. Reusing one under the same key is the failure
  // that breaks GCM outright.
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return [
    FORMAT_VERSION,
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

/** Reverses `encryptSecret`. Throws if the payload was altered. */
export function decryptSecret(payload: string, rawKey: string): string {
  const key = loadKey(rawKey);
  const [version, iv, authTag, ciphertext] = payload.split(":");

  if (version !== FORMAT_VERSION || !iv || !authTag || !ciphertext) {
    throw new Error("Malformed encrypted secret");
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, "base64"),
  );
  // `final()` throws when the tag does not match, which is what turns silent
  // corruption into a detectable error.
  decipher.setAuthTag(Buffer.from(authTag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
