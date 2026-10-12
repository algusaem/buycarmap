import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// docs/specs/redesign-navigation.md (HEAD). Dependency-free, like every other
// scripts/*.node.test.ts (docs/ARCHITECTURE.md › Directory map).

const ROOT = join(__dirname, "..");

function gitLsFiles(...pathspecs: string[]): string[] {
  const output = execFileSync("git", ["ls-files", "--", ...pathspecs], {
    cwd: ROOT,
    encoding: "utf8",
  }).trim();
  return output === "" ? [] : output.split("\n");
}

describe("HEAD-17: the root layout's viewport opts into the safe area", () => {
  it("HEAD-17: app/layout.tsx's viewport export sets viewportFit to cover", () => {
    const content = readFileSync(join(ROOT, "app/layout.tsx"), "utf-8");

    expect(content).toContain('viewportFit: "cover"');
  });
});

describe("HEAD-13: the account page offers sign-out", () => {
  it("HEAD-13: app/account/page.tsx imports and renders SignOutButton", () => {
    const content = readFileSync(join(ROOT, "app/account/page.tsx"), "utf-8");

    expect(content).toMatch(
      /import\s*\{\s*SignOutButton\s*\}\s*from\s*["']@\/components\/account\/SignOutButton["']/,
    );
    expect(content).toContain("<SignOutButton");
  });
});

// docs/specs/navbar.md: the menu sheet and the account dropdown are gone, so
// NAV-1, 3, 4, 5, 6, 12, 13, 14, 16, 17 and 18 are withdrawn. Imitates the
// CORE-10/LOOK-5 convention in scripts/core-frontend.node.test.ts: `spec:check`
// only needs some test title to mention each id and the id to stay declared,
// which these two checks satisfy without re-adding a behavioural test for a
// control that no longer exists. Titled under HEAD-14 (the governing id)
// rather than any withdrawn id, so this file does not match its own search.
describe("HEAD-14: the withdrawn NAV ids are retired", () => {
  const WITHDRAWN_NAV_IDS = [
    "NAV-1",
    "NAV-3",
    "NAV-4",
    "NAV-5",
    "NAV-6",
    "NAV-12",
    "NAV-13",
    "NAV-14",
    "NAV-16",
    "NAV-17",
    "NAV-18",
  ];

  function lineFor(id: string): string {
    const spec = readFileSync(join(ROOT, "docs/specs/navbar.md"), "utf-8");
    const lines = spec.split("\n");
    return lines.find((entry) => entry.includes(`${id} ·`)) ?? "";
  }

  // spec:check's checkDeclaredCriteria statically greps each test title's
  // source text for an id, so the id has to appear in the literal string
  // `it(...)` is called with — an `it.each` placeholder does not satisfy it.
  // One explicit `it` per id, imitating the CORE-10/LOOK-5 convention.
  it("HEAD-14: the navbar spec's NAV-1 line says Withdrawn", () => {
    expect(lineFor("NAV-1"), "NAV-1 line not found in navbar.md").toContain("Withdrawn");
  });
  it("HEAD-14: the navbar spec's NAV-3 line says Withdrawn", () => {
    expect(lineFor("NAV-3"), "NAV-3 line not found in navbar.md").toContain("Withdrawn");
  });
  it("HEAD-14: the navbar spec's NAV-4 line says Withdrawn", () => {
    expect(lineFor("NAV-4"), "NAV-4 line not found in navbar.md").toContain("Withdrawn");
  });
  it("HEAD-14: the navbar spec's NAV-5 line says Withdrawn", () => {
    expect(lineFor("NAV-5"), "NAV-5 line not found in navbar.md").toContain("Withdrawn");
  });
  it("HEAD-14: the navbar spec's NAV-6 line says Withdrawn", () => {
    expect(lineFor("NAV-6"), "NAV-6 line not found in navbar.md").toContain("Withdrawn");
  });
  it("HEAD-14: the navbar spec's NAV-12 line says Withdrawn", () => {
    expect(lineFor("NAV-12"), "NAV-12 line not found in navbar.md").toContain("Withdrawn");
  });
  it("HEAD-14: the navbar spec's NAV-13 line says Withdrawn", () => {
    expect(lineFor("NAV-13"), "NAV-13 line not found in navbar.md").toContain("Withdrawn");
  });
  it("HEAD-14: the navbar spec's NAV-14 line says Withdrawn", () => {
    expect(lineFor("NAV-14"), "NAV-14 line not found in navbar.md").toContain("Withdrawn");
  });
  it("HEAD-14: the navbar spec's NAV-16 line says Withdrawn", () => {
    expect(lineFor("NAV-16"), "NAV-16 line not found in navbar.md").toContain("Withdrawn");
  });
  it("HEAD-14: the navbar spec's NAV-17 line says Withdrawn", () => {
    expect(lineFor("NAV-17"), "NAV-17 line not found in navbar.md").toContain("Withdrawn");
  });
  it("HEAD-14: the navbar spec's NAV-18 line says Withdrawn", () => {
    expect(lineFor("NAV-18"), "NAV-18 line not found in navbar.md").toContain("Withdrawn");
  });

  it("HEAD-14: no test title in the repo still claims a withdrawn NAV id", () => {
    const testFiles = gitLsFiles("*.test.ts", "*.test.tsx", "*.spec.ts").filter((path) =>
      existsSync(join(ROOT, path)),
    );

    const offenders: string[] = [];
    for (const path of testFiles) {
      const content = readFileSync(join(ROOT, path), "utf-8");
      for (const id of WITHDRAWN_NAV_IDS) {
        // Built from parts so this file's own id list never matches the search.
        const marker = [`"${id}`, `:`].join("");
        if (content.includes(marker)) offenders.push(`${path}: ${id}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
