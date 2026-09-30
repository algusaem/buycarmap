import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { checkSpecs, criteriaIdsIn, main } from "./spec-check.mjs";
import type { SpecCheckTestInput } from "./spec-check.mjs";

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
    expect(criteriaIdsIn('it("FAV-1 and FAV-2: both hold", () => {})')).toEqual(["FAV-1", "FAV-2"]);
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
    expect(criteriaIdsIn('it("uses SHA-256 for the digest", () => {})')).toEqual(["SHA-256"]);
  });

  it("handles single quotes and template literals", () => {
    expect(criteriaIdsIn("it('FAV-5: single quoted', () => {})")).toEqual(["FAV-5"]);
    expect(criteriaIdsIn("it(`FAV-6: templated`, () => {})")).toEqual(["FAV-6"]);
  });

  it("returns nothing for a file with no tests", () => {
    expect(criteriaIdsIn("export const x = 1;")).toEqual([]);
  });
});

describe("checkSpecs", () => {
  const spec = (key: string, status: string, body: string) =>
    `# Feature\n\nKey: ${key}\nStatus: ${status}\n\n## Acceptance criteria\n\n${body}\n`;

  it("DOCS-2: a checklist item declares its criterion and a matching test satisfies it", () => {
    const specs = [
      { name: "favorites.md", source: spec("FAV", "Approved", "- [ ] FAV-3 · node — x") },
    ];
    const tests = [{ path: "a.test.ts", source: 'it("FAV-3: x", () => {})' }];

    expect(checkSpecs(specs, tests).problems).toEqual([]);
  });

  it("DOCS-2: a table row declares nothing, so the criterion its test names is unsatisfied", () => {
    const specs = [
      { name: "favorites.md", source: spec("FAV", "Approved", "| FAV-3 | x | node | — |") },
    ];
    const tests = [{ path: "a.test.ts", source: 'it("FAV-3: x", () => {})' }];

    const problems = checkSpecs(specs, tests).problems;
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("declares no acceptance criteria");
  });

  it("DOCS-2: a checklist item with no level is rejected, naming the criterion and the missing level", () => {
    const specs = [{ name: "favorites.md", source: spec("FAV", "Approved", "- [x] FAV-3 — x") }];
    const tests = [{ path: "a.test.ts", source: 'it("FAV-3: x", () => {})' }];

    const problems = checkSpecs(specs, tests).problems;
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("FAV-3");
    expect(problems[0]).toContain("has no level");
    expect(problems[0]).not.toContain("has no statement");
  });

  it.each(["unit", "node", "component", "contract", "e2e"])(
    "DOCS-2: accepts the %s level",
    (level) => {
      const specs = [
        { name: "favorites.md", source: spec("FAV", "Approved", `- [x] FAV-3 · ${level} — x`) },
      ];
      const tests = [{ path: "a.test.ts", source: 'it("FAV-3: x", () => {})' }];

      expect(checkSpecs(specs, tests).problems).toEqual([]);
    },
  );

  it("DOCS-2: a combined level joined by + declares the criterion", () => {
    const specs = [
      { name: "favorites.md", source: spec("FAV", "Approved", "- [x] FAV-3 · node + e2e — x") },
    ];
    const tests = [{ path: "a.test.ts", source: 'it("FAV-3: x", () => {})' }];

    expect(checkSpecs(specs, tests).problems).toEqual([]);
  });

  it("DOCS-2: an unknown level in a combination is rejected, naming the criterion", () => {
    const specs = [
      { name: "favorites.md", source: spec("FAV", "Approved", "- [x] FAV-3 · node + api — x") },
    ];
    const tests = [{ path: "a.test.ts", source: 'it("FAV-3: x", () => {})' }];

    const problems = checkSpecs(specs, tests).problems;
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("FAV-3");
    expect(problems[0]).toContain("has no level");
    expect(problems[0]).not.toContain("has no statement");
  });

  it("DOCS-2: a checklist item with a level but no statement is rejected, naming the criterion", () => {
    const specs = [
      { name: "favorites.md", source: spec("FAV", "Approved", "- [x] FAV-3 · node — ") },
    ];
    const tests = [{ path: "a.test.ts", source: 'it("FAV-3: x", () => {})' }];

    const problems = checkSpecs(specs, tests).problems;
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("FAV-3");
    expect(problems[0]).toContain("has no statement");
  });

  it("DOCS-2: a level followed by a bare dash is reported as a missing statement", () => {
    const specs = [
      { name: "favorites.md", source: spec("FAV", "Approved", "- [x] FAV-3 · node —") },
    ];
    const tests = [{ path: "a.test.ts", source: 'it("FAV-3: x", () => {})' }];

    const problems = checkSpecs(specs, tests).problems;
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("FAV-3");
    expect(problems[0]).toContain("has no statement");
  });

  it("DOCS-3: an Implemented spec with an unchecked criterion fails, naming it as unchecked", () => {
    const specs = [
      { name: "favorites.md", source: spec("FAV", "Implemented", "- [ ] FAV-3 · node — x") },
    ];
    const tests = [{ path: "a.test.ts", source: 'it("FAV-3: x", () => {})' }];

    const problems = checkSpecs(specs, tests).problems;
    expect(problems).toHaveLength(1);
    expect(problems.some((p) => p.includes("FAV-3") && p.includes("unchecked"))).toBe(true);
  });

  it("DOCS-3: the same unchecked item is accepted under Approved", () => {
    const specs = [
      { name: "favorites.md", source: spec("FAV", "Approved", "- [ ] FAV-3 · node — x") },
    ];
    const tests = [{ path: "a.test.ts", source: 'it("FAV-3: x", () => {})' }];

    expect(checkSpecs(specs, tests).problems).toEqual([]);
  });

  it("DOCS-3: a checked item is accepted under Implemented", () => {
    const specs = [
      { name: "favorites.md", source: spec("FAV", "Implemented", "- [x] FAV-3 · node — x") },
    ];
    const tests = [{ path: "a.test.ts", source: 'it("FAV-3: x", () => {})' }];

    expect(checkSpecs(specs, tests).problems).toEqual([]);
  });

  it("DOCS-4: a duplicate key across two specs is reported", () => {
    const specs = [
      { name: "a.md", source: spec("FAV", "Approved", "- [x] FAV-1 · unit — x") },
      { name: "b.md", source: spec("FAV", "Approved", "- [x] FAV-1 · unit — x") },
    ];
    const tests = [{ path: "a.test.ts", source: 'it("FAV-1: x", () => {})' }];

    const problems = checkSpecs(specs, tests).problems;
    expect(problems.some((p) => p.includes("Duplicate key FAV"))).toBe(true);
  });

  it("DOCS-4: an enforced spec with no criteria is reported", () => {
    const specs = [{ name: "favorites.md", source: spec("FAV", "Approved", "No criteria yet.") }];
    const tests: SpecCheckTestInput[] = [];

    const problems = checkSpecs(specs, tests).problems;
    expect(problems.some((p) => p.includes("declares no acceptance criteria"))).toBe(true);
  });

  it("DOCS-4: a criterion no test title names is reported", () => {
    const specs = [
      { name: "favorites.md", source: spec("FAV", "Approved", "- [x] FAV-1 · unit — x") },
    ];
    const tests: SpecCheckTestInput[] = [];

    const problems = checkSpecs(specs, tests).problems;
    expect(
      problems.some((p) => p.includes("FAV-1") && p.includes("is not named by any test title")),
    ).toBe(true);
  });

  it("DOCS-4: a test title naming an undeclared id of a known key is reported", () => {
    const specs = [
      { name: "favorites.md", source: spec("FAV", "Approved", "- [x] FAV-1 · unit — x") },
    ];
    const tests = [
      { path: "a.test.ts", source: 'it("FAV-1: x", () => {})' },
      { path: "b.test.ts", source: 'it("FAV-2: y", () => {})' },
    ];

    const problems = checkSpecs(specs, tests).problems;
    expect(problems.some((p) => p.includes("FAV-2") && p.includes("does not declare it"))).toBe(
      true,
    );
  });

  it("DOCS-3: a Draft spec with an unchecked criterion is accepted", () => {
    const specs = [
      { name: "favorites.md", source: spec("FAV", "Draft", "- [ ] FAV-1 · unit — x") },
    ];
    const tests: SpecCheckTestInput[] = [];

    expect(checkSpecs(specs, tests).problems).toEqual([]);
  });
});

// `main`, run in-process against a throwaway fixture directory (never this
// repository) with `cwd`/`log`/`error`/`exit` injected — the real spec:check,
// reading real files from disk, rather than `checkSpecs` fed crafted input.
describe("main", () => {
  let repo: string;

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), "spec-check-main-"));
    mkdirSync(join(repo, "docs", "specs"), { recursive: true });
    mkdirSync(join(repo, "app"), { recursive: true });
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  function writeSpec(key: string, status: string, body: string) {
    writeFileSync(
      join(repo, "docs", "specs", "favorites.md"),
      `# Feature\n\nKey: ${key}\nStatus: ${status}\n\n## Acceptance criteria\n\n${body}\n`,
    );
  }

  it("DOCS-4: passes and reports the criteria and enforced-spec counts when every criterion has a test", async () => {
    writeSpec("FAV", "Approved", "- [ ] FAV-1 · unit — removes a listing");
    writeFileSync(
      join(repo, "app", "favorites.test.ts"),
      'it("FAV-1: removes a listing", () => {})',
    );
    const log = vi.fn();
    const error = vi.fn();
    const exit = vi.fn();

    await main({ cwd: repo, log, error, exit });

    expect(log).toHaveBeenCalledWith("spec:check passed - 1 criteria across 1 enforced spec(s).");
    expect(error).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  it("DOCS-4: fails and exits 1 when a declared criterion has no test naming it", async () => {
    writeSpec("FAV", "Approved", "- [ ] FAV-1 · unit — removes a listing");
    const log = vi.fn();
    const error = vi.fn();
    const exit = vi.fn();

    await main({ cwd: repo, log, error, exit });

    expect(error.mock.calls.flat().join("\n")).toContain(
      "FAV-1 (docs/specs/favorites.md) is not named by any test title",
    );
    expect(exit).toHaveBeenCalledWith(1);
    expect(log).not.toHaveBeenCalled();
  });

  it("skips the _template.md and README.md files under docs/specs", async () => {
    writeFileSync(join(repo, "docs", "specs", "_template.md"), "# Template\n\nKey: TPL\n");
    writeFileSync(join(repo, "docs", "specs", "README.md"), "# Specs index\n");
    const log = vi.fn();
    const exit = vi.fn();

    await main({ cwd: repo, log, exit });

    // Neither file declares a Key/Status pair `checkSpecs` would enforce, so
    // this only proves they were never read as specs at all — 0 enforced.
    expect(log).toHaveBeenCalledWith("spec:check passed - 0 criteria across 0 enforced spec(s).");
    expect(exit).not.toHaveBeenCalled();
  });

  it("DOCS-4: reports a skipped spec (no Key: header) by name and reason, alongside a passing enforced one", async () => {
    writeSpec("FAV", "Approved", "- [ ] FAV-1 · unit — removes a listing");
    writeFileSync(
      join(repo, "app", "favorites.test.ts"),
      'it("FAV-1: removes a listing", () => {})',
    );
    writeFileSync(join(repo, "docs", "specs", "legacy.md"), "# Legacy\n\nNo Key header here.\n");
    const log = vi.fn();
    const error = vi.fn();
    const exit = vi.fn();

    await main({ cwd: repo, log, error, exit });

    expect(error).not.toHaveBeenCalled();
    const messages = log.mock.calls.flat().join("\n");
    expect(messages).toContain("spec:check passed - 1 criteria across 1 enforced spec(s).");
    expect(messages).toContain("skipped docs/specs/legacy.md (no Key: header (legacy format))");
  });

  it("does not walk into a dotdirectory for test files", async () => {
    writeSpec("FAV", "Approved", "- [ ] FAV-1 · unit — removes a listing");
    mkdirSync(join(repo, ".hidden"), { recursive: true });
    // If this were read, it alone would satisfy FAV-1 and the check would
    // wrongly pass — proving the dotdirectory was actually excluded.
    writeFileSync(
      join(repo, ".hidden", "fixture.test.ts"),
      'it("FAV-1: removes a listing", () => {})',
    );
    const log = vi.fn();
    const error = vi.fn();
    const exit = vi.fn();

    await main({ cwd: repo, log, error, exit });

    expect(error.mock.calls.flat().join("\n")).toContain("FAV-1");
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("does not walk into node_modules for test files, so a criterion named only there stays unsatisfied", async () => {
    writeSpec("FAV", "Approved", "- [ ] FAV-1 · unit — removes a listing");
    mkdirSync(join(repo, "node_modules", "somepkg"), { recursive: true });
    // If this were read, it alone would satisfy FAV-1 and the check would
    // wrongly pass — proving node_modules was actually excluded from the walk.
    writeFileSync(
      join(repo, "node_modules", "somepkg", "fixture.test.ts"),
      'it("FAV-1: removes a listing", () => {})',
    );
    const log = vi.fn();
    const error = vi.fn();
    const exit = vi.fn();

    await main({ cwd: repo, log, error, exit });

    expect(error.mock.calls.flat().join("\n")).toContain("FAV-1");
    expect(exit).toHaveBeenCalledWith(1);
  });
});
