// RFC 4648 base32. Authenticator apps exchange TOTP secrets in this encoding —
// it is what goes in the `otpauth://` URI and what a user types by hand when a
// QR scan is not an option, which is why the alphabet excludes the characters
// people confuse (no 0/O, no 1/I/L).

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const BITS_PER_CHAR = 5;
const BITS_PER_BYTE = 8;

export function encodeBase32(bytes: Uint8Array): string {
  let output = "";
  let buffer = 0;
  let bitsInBuffer = 0;

  for (const byte of bytes) {
    buffer = (buffer << BITS_PER_BYTE) | byte;
    bitsInBuffer += BITS_PER_BYTE;

    while (bitsInBuffer >= BITS_PER_CHAR) {
      bitsInBuffer -= BITS_PER_CHAR;
      output += ALPHABET[(buffer >> bitsInBuffer) & 0b11111];
    }
  }

  // Whatever is left over is padded with zero bits to fill a final character.
  if (bitsInBuffer > 0) {
    output += ALPHABET[(buffer << (BITS_PER_CHAR - bitsInBuffer)) & 0b11111];
  }

  // Pad to a multiple of 8 characters, as the RFC requires.
  while (output.length % 8 !== 0) {
    output += "=";
  }

  return output;
}

export function decodeBase32(input: string): Uint8Array {
  // Tolerant of what a human actually types: lowercase, spaces between groups,
  // and the padding they may or may not have copied.
  const normalized = input.toUpperCase().replace(/[\s-]/g, "").replace(/=+$/, "");

  const bytes: number[] = [];
  let buffer = 0;
  let bitsInBuffer = 0;

  for (const char of normalized) {
    const value = ALPHABET.indexOf(char);

    if (value === -1) {
      throw new Error(`Invalid base32 character: ${char}`);
    }

    buffer = (buffer << BITS_PER_CHAR) | value;
    bitsInBuffer += BITS_PER_CHAR;

    if (bitsInBuffer >= BITS_PER_BYTE) {
      bitsInBuffer -= BITS_PER_BYTE;
      bytes.push((buffer >> bitsInBuffer) & 0xff);
    }
  }

  // Any remaining bits are the zero padding added on encode, so they are
  // dropped rather than emitted as a partial byte.
  return Uint8Array.from(bytes);
}
