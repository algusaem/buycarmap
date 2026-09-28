import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, DUMMY_PASSWORD_HASH } from "./hash";

// Real bcrypt (no mocks): every other suite mocks these, so this is the only
// place the actual hash/verify round-trip is exercised.
describe("password hashing", () => {
  it("produces a bcrypt hash that verifies against the original", async () => {
    const hash = await hashPassword("correct horse battery staple");

    expect(hash).not.toBe("correct horse battery staple");
    expect(hash).toMatch(/^\$2[aby]\$/); // bcrypt hash prefix
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
  });

  it("rejects a wrong password against a real hash", async () => {
    const hash = await hashPassword("right-password");
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("exposes a valid dummy hash that no password matches", async () => {
    // Used by the authorize flow to equalize timing for unknown accounts; it
    // must be a real, runnable bcrypt hash so the comparison does real work.
    expect(DUMMY_PASSWORD_HASH).toMatch(/^\$2[aby]\$/);
    expect(await verifyPassword("anything at all", DUMMY_PASSWORD_HASH)).toBe(false);
  });
});
