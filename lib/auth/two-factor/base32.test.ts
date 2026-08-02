import { describe, expect, it } from "vitest";
import { decodeBase32, encodeBase32 } from "./base32";

const encode = (text: string) => encodeBase32(new TextEncoder().encode(text));
const decodeToText = (value: string) =>
  new TextDecoder().decode(decodeBase32(value));

// The expectations below are the published RFC 4648 §10 test vectors, not
// values produced by this implementation — so a bug here cannot make the test
// agree with it.
describe("encodeBase32 against RFC 4648 vectors", () => {
  it.each([
    ["", ""],
    ["f", "MY======"],
    ["fo", "MZXQ===="],
    ["foo", "MZXW6==="],
    ["foob", "MZXW6YQ="],
    ["fooba", "MZXW6YTB"],
    ["foobar", "MZXW6YTBOI======"],
  ])("encodes %j as %j", (input, expected) => {
    expect(encode(input)).toBe(expected);
  });
});

describe("decodeBase32 against RFC 4648 vectors", () => {
  it.each([
    ["MY======", "f"],
    ["MZXQ====", "fo"],
    ["MZXW6===", "foo"],
    ["MZXW6YQ=", "foob"],
    ["MZXW6YTB", "fooba"],
    ["MZXW6YTBOI======", "foobar"],
  ])("decodes %j back to %j", (input, expected) => {
    expect(decodeToText(input)).toBe(expected);
  });
});

describe("decodeBase32 input tolerance", () => {
  it("accepts the lowercase a user might type", () => {
    expect(decodeToText("mzxw6ytboi======")).toBe("foobar");
  });

  it("accepts missing padding", () => {
    // Authenticator apps routinely display secrets without the trailing "=".
    expect(decodeToText("MZXW6YTBOI")).toBe("foobar");
  });

  it("ignores the spaces and dashes used to group digits for readability", () => {
    expect(decodeToText("MZXW 6YTB-OI")).toBe("foobar");
  });

  it("rejects a character outside the alphabet", () => {
    // 0, 1, 8 and 9 are deliberately absent, so they signal a typo rather than
    // silently decoding to something else.
    expect(() => decodeBase32("MZXW0YTB")).toThrow(/Invalid base32/);
  });
});

describe("base32 round trip", () => {
  it("preserves arbitrary binary data", () => {
    const original = Uint8Array.from({ length: 40 }, (_, i) => (i * 7) % 256);

    expect(decodeBase32(encodeBase32(original))).toEqual(original);
  });

  it("preserves a 20-byte secret, the length TOTP uses", () => {
    const secret = Uint8Array.from({ length: 20 }, (_, i) => i + 1);
    const encoded = encodeBase32(secret);

    expect(encoded).toMatch(/^[A-Z2-7]+=*$/);
    expect(decodeBase32(encoded)).toEqual(secret);
  });
});
