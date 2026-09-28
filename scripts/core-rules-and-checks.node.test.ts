import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// These tests read the repository itself: the migration's deliverables are
// files, and the way it fails is a file missing from a clone or a rule with no
// enforcer. See docs/specs/core-rules-and-checks.md.

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const COMMANDS = join(ROOT, ".claude/commands");
const CORE_CHECKS = new Set([
  "check-all.md",
  "check-changelog.md",
  "check-correctness.md",
  "check-data.md",
  "check-erp.md",
  "check-front.md",
  "check-good-practices.md",
  "check-impeccable.md",
  "check-pr.md",
  "check-process.md",
  "check-security.md",
  "check-stack.md",
  "check-tests.md",
  "check-verify.md",
  "check-visual.md",
]);
// Not reviews, so they don't follow the review protocol: the orchestrator, the
// two that run commands and take screenshots, and the two that write PR text.
const NOT_REVIEWS = new Set([
  "check-all.md",
  "check-verify.md",
  "check-visual.md",
  "check-changelog.md",
  "check-pr.md",
]);
// The 10 core checks that are reviews, plus check-docs and check-sources.
const MIN_REVIEWS = 12;

const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const checkFiles = () => readdirSync(COMMANDS).filter((name) => /^check-.*\.md$/.test(name));

/** The rows of the markdown table under `heading`, each split into trimmed cells. */
function tableRows(markdown: string, heading: string): string[][] {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start === -1) return [];
  const rows: string[][] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,6}\s/.test(line)) break;
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell))) continue;
    rows.push(cells);
  }
  return rows;
}

describe("core rules and checks", () => {
  it("RULESET-1: CLAUDE.md imports RULES.md and names STACK.md and the adoption ADR", () => {
    const claude = read("CLAUDE.md");

    expect(claude).toMatch(/^@RULES\.md$/m);
    expect(claude).toContain("`STACK.md`");
    expect(claude).toContain("docs/decisions/0007-adopt-core-rules.md");
  });

  it("RULESET-2: every review check tells the reviewer to follow the review protocol", () => {
    const reviews = checkFiles().filter((name) => !NOT_REVIEWS.has(name));
    const withoutProtocol = reviews.filter(
      (name) => !read(`.claude/commands/${name}`).includes("`.claude/review-protocol.md`"),
    );

    expect(reviews.length).toBeGreaterThanOrEqual(MIN_REVIEWS);
    expect(withoutProtocol).toEqual([]);
  });

  it.each([".claude/review-protocol.md", "RULES.md", "STACK.md"])(
    "RULESET-3: %s exists and git does not ignore it",
    (path) => {
      const ignored = spawnSync("git", ["check-ignore", "--quiet", "--no-index", path], {
        cwd: ROOT,
      });

      expect(existsSync(join(ROOT, path))).toBe(true);
      // `git check-ignore` exits 0 when the path is ignored and 1 when it is not.
      expect(ignored.status).toBe(1);
    },
  );

  it.each(["check.md", "check-claudemd.md"])(
    "RULESET-4: the legacy command %s does not exist",
    (name) => {
      expect(existsSync(join(COMMANDS, name))).toBe(false);
    },
  );

  it("RULESET-5: every project check appears in the coverage map of check-all.md", () => {
    const coverageMap = tableRows(read(".claude/commands/check-all.md"), "### Coverage map");
    const owners = coverageMap.map((cells) => cells[1] ?? "").join("\n");
    const projectChecks = checkFiles()
      .filter((name) => !CORE_CHECKS.has(name))
      .map((name) => name.replace(/\.md$/, ""));
    const unmapped = projectChecks.filter((check) => !owners.includes(`\`${check}\``));

    expect(projectChecks).toEqual(expect.arrayContaining(["check-docs", "check-sources"]));
    expect(unmapped).toEqual([]);
  });

  it("RULESET-6: every accepted deviation names the rule it breaks and when it is removed", () => {
    const adr = "docs/decisions/0007-adopt-core-rules.md";
    const rows = existsSync(join(ROOT, adr)) ? tableRows(read(adr), "## Accepted deviations") : [];
    const [header, ...deviations] = rows;
    const incomplete = deviations.filter(
      ([number, deviation, rule, removedIn]) =>
        !/^\d+$/.test(number ?? "") ||
        !deviation ||
        !/(RULES|STACK)\.md/.test(rule ?? "") ||
        !removedIn,
    );

    expect(header).toEqual(["#", "Deviation", "Rule it deviates from", "Removed in"]);
    expect(deviations.length).toBeGreaterThan(0);
    expect(incomplete).toEqual([]);
  });
});
