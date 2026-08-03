import { describe, expect, it } from "vitest";

import * as check from "./spec-check.mjs";

const { criteriaIdsIn } = check as unknown as {
  criteriaIdsIn: (source: string) => string[];
};

describe("criteriaIdsIn", () => {
  it.each([
    ['it("FAV-3: removes a listing", () => {})', ["FAV-3"]],
    ['test("MAP-12: pans the map", () => {})', ["MAP-12"]],
    ['it.each([1])("SRC-7: falls back", () => {})', ["SRC-7"]],
    ['test.skip("AUTH-9: refuses", () => {})', ["AUTH-9"]],
  ])("reads the id out of %s", (source, expected) => {
    expect(criteriaIdsIn(source)).toEqual(expected);
  });

  it("reads a dbTest title, which is how e2e-only criteria are declared", () => {
    // `e2e/*.spec.ts` gate the database-backed suite with
    // `const dbTest = process.env.E2E_DB ? test : test.skip`. A criterion whose
    // truth is a Postgres behaviour can be proven nowhere else, so missing this
    // alias would report it as untested with no way to satisfy the check.
    const source = 'dbTest("ALERT-13: two workers never claim the same job", async () => {})';

    expect(criteriaIdsIn(source)).toEqual(["ALERT-13"]);
  });

  it("collects every id across a whole file", () => {
    const source = [
      'it("FAV-1: saves", () => {})',
      'it("FAV-2: is idempotent", () => {})',
      'dbTest("FAV-8: orders newest first", () => {})',
    ].join("\n");

    expect(criteriaIdsIn(source)).toEqual(["FAV-1", "FAV-2", "FAV-8"]);
  });

  it("reads several ids named by one title", () => {
    expect(criteriaIdsIn('it("FAV-1 and FAV-2: both hold", () => {})')).toEqual([
      "FAV-1",
      "FAV-2",
    ]);
  });

  it("ignores an id outside a test title", () => {
    // A criterion mentioned only in a comment is not a test for it — counting
    // it would let a criterion pass with nothing actually asserting it.
    const source = [
      "// FAV-9 is covered elsewhere",
      'const label = "FAV-10";',
      'it("FAV-11: the real one", () => {})',
    ].join("\n");

    expect(criteriaIdsIn(source)).toEqual(["FAV-11"]);
  });

  it("ignores a describe block's title", () => {
    // Only `it`/`test` titles count; a describe naming a criterion would let
    // one describe stand in for tests that were never written.
    expect(criteriaIdsIn('describe("FAV-4: removing", () => {})')).toEqual([]);
  });

  it("does not treat an arbitrary hyphenated token as a criterion", () => {
    expect(criteriaIdsIn('it("uses SHA-256 for the digest", () => {})')).toEqual([
      "SHA-256",
    ]);
  });

  it("handles single quotes and template literals", () => {
    expect(criteriaIdsIn("it('FAV-5: single quoted', () => {})")).toEqual([
      "FAV-5",
    ]);
    expect(criteriaIdsIn("it(`FAV-6: templated`, () => {})")).toEqual(["FAV-6"]);
  });

  it("returns nothing for a file with no tests", () => {
    expect(criteriaIdsIn("export const x = 1;")).toEqual([]);
  });
});
