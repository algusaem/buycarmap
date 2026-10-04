import { describe, expect, it } from "vitest";
import { can, ownedBy } from "./permissions";

// BAUTH-16 (docs/specs/core-better-auth.md). `can` and `ownedBy` are the
// real ownership check lib/auth/permissions.ts declares — `can` compares
// the resource's owner against the caller and `ownedBy` returns the
// matching `{ userId }` filter — so every case below is green.

const ana = { id: "ana-1" };
const bob = { id: "bob-1" };

describe("BAUTH-16 worked examples: can()", () => {
  it('BAUTH-16: can(ana, "delete", { type: "favorite", userId: ana.id }) is true', () => {
    expect(can(ana, "delete", { type: "favorite", userId: ana.id })).toBe(true);
  });

  it('BAUTH-16: can(ana, "delete", { type: "favorite", userId: bob.id }) is false', () => {
    expect(can(ana, "delete", { type: "favorite", userId: bob.id })).toBe(false);
  });

  it('BAUTH-16: can(ana, "read", { type: "user", id: ana.id }) is true', () => {
    expect(can(ana, "read", { type: "user", id: ana.id })).toBe(true);
  });

  it('BAUTH-16: can(ana, "read", { type: "user", id: bob.id }) is false', () => {
    expect(can(ana, "read", { type: "user", id: bob.id })).toBe(false);
  });
});

describe("BAUTH-16: ownedBy()", () => {
  it("BAUTH-16: ownedBy(ana) deep-equals { userId: ana.id }", () => {
    expect(ownedBy(ana)).toEqual({ userId: ana.id });
  });
});
