import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret } from "./encryption";

const KEY = randomBytes(32).toString("base64");
const OTHER_KEY = randomBytes(32).toString("base64");
const SECRET = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";

describe("encryptSecret / decryptSecret", () => {
  it("round-trips a secret", () => {
    expect(decryptSecret(encryptSecret(SECRET, KEY), KEY)).toBe(SECRET);
  });

  it("never emits the plaintext", () => {
    const payload = encryptSecret(SECRET, KEY);

    // The whole point: a database dump must not contain usable secrets.
    expect(payload).not.toContain(SECRET);
    expect(payload).not.toContain(SECRET.slice(0, 8));
  });

  it("produces a different payload every time for the same input", () => {
    // A fresh IV per encryption. Reuse under one key is what breaks GCM.
    const first = encryptSecret(SECRET, KEY);
    const second = encryptSecret(SECRET, KEY);

    expect(first).not.toBe(second);
    expect(decryptSecret(first, KEY)).toBe(decryptSecret(second, KEY));
  });

  it("carries a version prefix so the format can change later", () => {
    expect(encryptSecret(SECRET, KEY).startsWith("v1:")).toBe(true);
  });
});

describe("decryptSecret rejects what it should", () => {
  it("refuses a payload encrypted under a different key", () => {
    expect(() => decryptSecret(encryptSecret(SECRET, KEY), OTHER_KEY)).toThrow();
  });

  it("refuses a tampered ciphertext instead of returning garbage", () => {
    const [version, iv, tag, ciphertext] = encryptSecret(SECRET, KEY).split(":");
    const flipped = Buffer.from(ciphertext, "base64");
    flipped[0] ^= 0xff;

    // This is why GCM and not CBC: corrupted input fails loudly rather than
    // decrypting to nonsense that would then be fed into an HMAC.
    expect(() =>
      decryptSecret([version, iv, tag, flipped.toString("base64")].join(":"), KEY),
    ).toThrow();
  });

  it("refuses a tampered auth tag", () => {
    const [version, iv, tag, ciphertext] = encryptSecret(SECRET, KEY).split(":");
    const flipped = Buffer.from(tag, "base64");
    flipped[0] ^= 0xff;

    expect(() =>
      decryptSecret([version, iv, flipped.toString("base64"), ciphertext].join(":"), KEY),
    ).toThrow();
  });

  it.each([
    ["empty", ""],
    ["not delimited", "nonsense"],
    ["missing parts", "v1:abc"],
    ["unknown version", "v2:a:b:c"],
  ])("refuses a %s payload", (_label, payload) => {
    expect(() => decryptSecret(payload, KEY)).toThrow();
  });
});

describe("key validation", () => {
  it.each([
    ["too short", randomBytes(16).toString("base64")],
    ["too long", randomBytes(64).toString("base64")],
    ["empty", ""],
  ])("rejects a %s key with an actionable message", (_label, key) => {
    // A wrong-sized key is a deploy mistake; the error should say how to fix
    // it rather than surfacing a generic crypto failure.
    expect(() => encryptSecret(SECRET, key)).toThrow(/32 bytes/);
  });
});
