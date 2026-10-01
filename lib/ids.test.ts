import { describe, expect, expectTypeOf, it } from "vitest";
import type { AlertId, UserId } from "./ids";
import { userIdSchema } from "./ids";

// DATA-3 (docs/specs/core-data-model.md): branded ids. The type-level case
// proves the compiler rejects passing one model's id where another's is
// expected; the schema cases prove a v7 UUID round-trips and a non-UUID value
// is rejected. lib/ids.ts is a stub (`z.string()`, not `z.uuid()`) until
// DATA-1 lands, so the rejection case is the one expected to fail here.

describe("branded id types", () => {
  it("DATA-3: an AlertId is not assignable where a UserId is expected", () => {
    expectTypeOf<AlertId>().not.toMatchTypeOf<UserId>();
  });

  it("DATA-3: a plain string is not assignable to UserId", () => {
    expectTypeOf<string>().not.toMatchTypeOf<UserId>();
  });
});

describe("userIdSchema", () => {
  it("DATA-3: accepts a v7 UUID and returns it unchanged", () => {
    const id = "018f2a3e-7b4c-7000-8abc-1234567890ab";

    const result = userIdSchema.parse(id);

    expect(result).toBe(id);
  });

  it("DATA-3: rejects a cuid", () => {
    expect(() => userIdSchema.parse("clx123")).toThrow();
  });
});
