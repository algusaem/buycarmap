import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  extractLinks,
  extractSourcePaths,
  globToRegExp,
  headingSlugs,
  INDEX,
  isDatedRecord,
  isGap,
  isUnbuiltSpec,
  main,
  ownableFiles,
  parseOwnership,
  slugify,
  stripFences,
  testSubject,
  unreachableDocs,
  unresolvedOwnershipDocs,
} from "./docs-check.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (path: string) => readFileSync(join(ROOT, path), "utf8").replace(/\r\n/g, "\n");

describe("stripFences", () => {
  it("drops fenced blocks so directory trees are not read as path references", () => {
    // The reason this exists: CLAUDE.md's tree diagrams write paths relative to
    // their parent (`wallapop/search/route.ts`), so scanning inside a fence
    // produces nothing but false positives.
    const source = ["before", "```", "app/", "  wallapop/search/route.ts", "```", "after"].join(
      "\n",
    );

    expect(extractSourcePaths(stripFences(source)).size).toBe(0);
    expect(stripFences(source)).toContain("before");
    expect(stripFences(source)).toContain("after");
  });

  it("handles tilde fences as well as backtick fences", () => {
    expect(stripFences(["~~~", "`lib/gone.ts`", "~~~"].join("\n")).trim()).toBe("");
  });
});

describe("slugify", () => {
  it.each([
    ["Getting started", "getting-started"],
    ["Data & contracts", "data--contracts"],
    ["1. Problem", "1-problem"],
  ])("turns %s into %s", (heading, slug) => {
    expect(slugify(heading)).toBe(slug);
  });
});

describe("headingSlugs", () => {
  it("collects every heading level", () => {
    const slugs = headingSlugs("# One\n\n### Three deep\n");

    expect(slugs).toEqual(new Set(["one", "three-deep"]));
  });

  it("suffixes repeated headings the way GitHub does", () => {
    // Two "## Notes" headings produce #notes and #notes-1; without this a valid
    // link to the second one would be reported as broken.
    const slugs = headingSlugs("## Notes\n\n## Notes\n\n## Notes\n");

    expect(slugs).toEqual(new Set(["notes", "notes-1", "notes-2"]));
  });

  it("ignores headings inside fenced blocks", () => {
    expect(headingSlugs("```\n# Not a heading\n```\n")).toEqual(new Set());
  });
});

describe("extractLinks", () => {
  it("returns internal targets, with the anchor attached", () => {
    expect(extractLinks("See [the model](data-model.md#migrations).")).toEqual([
      "data-model.md#migrations",
    ]);
  });

  it("ignores external schemes and bare anchors", () => {
    const source = "[web](https://example.com) [mail](mailto:a@b.c) [top](#intro) [real](x.md)";

    expect(extractLinks(source)).toEqual(["x.md"]);
  });

  it("ignores a link written inside a fenced example", () => {
    expect(extractLinks("```\n[broken](nope.md)\n```")).toEqual([]);
  });

  it("strips a title suffix from the target", () => {
    expect(extractLinks('[x](guide.md "A title")')).toEqual(["guide.md"]);
  });
});

describe("extractSourcePaths", () => {
  it("collects backticked paths under a source root", () => {
    const paths = extractSourcePaths("`lib/wallapop/client.ts` and `app/actions/`.");

    expect(paths).toEqual(new Set(["lib/wallapop/client.ts", "app/actions"]));
  });

  it("ignores patterns rather than treating them as missing files", () => {
    // Every one of these appears in CLAUDE.md today. Flagging them would make
    // the check noise, and a noisy check gets switched off.
    const paths = extractSourcePaths(
      "`components/ui/*` `lib/i18n/locales/{en,es}.ts` `docs/specs/<area>.md` `lib/**/*.ts`",
    );

    expect(paths).toEqual(new Set());
  });

  it("ignores paths outside the source roots", () => {
    // An upstream API path is not a file in this repo.
    const paths = extractSourcePaths(
      "`/api/v3/search/section` `https://web.gw.coches.net/search/listing`",
    );

    expect(paths).toEqual(new Set());
  });

  it("ignores a backticked value that is not a path at all", () => {
    expect(extractSourcePaths("`category_id=100` `next_page` `DATABASE_URL`")).toEqual(new Set());
  });

  it("ignores a source-root file with no recognised extension", () => {
    expect(extractSourcePaths("`lib/auth/README` `scripts/thing.exe`")).toEqual(new Set());
  });

  it("trims trailing sentence punctuation", () => {
    expect(extractSourcePaths("See `lib/env.ts`.")).toEqual(new Set(["lib/env.ts"]));
  });
});

describe("globToRegExp", () => {
  it("matches a single segment with * but does not cross a slash", () => {
    const pattern = globToRegExp("lib/*/client.ts");

    expect(pattern.test("lib/wallapop/client.ts")).toBe(true);
    expect(pattern.test("lib/a/b/client.ts")).toBe(false);
  });

  it("crosses directories with **", () => {
    const pattern = globToRegExp("components/map/**");

    expect(pattern.test("components/map/MapView.tsx")).toBe(true);
    expect(pattern.test("components/map/nested/Deep.tsx")).toBe(true);
    expect(pattern.test("components/auth/LoginForm.tsx")).toBe(false);
  });

  it("escapes regex metacharacters in the literal parts", () => {
    const pattern = globToRegExp("app/api/**/route.ts");

    expect(pattern.test("app/api/wallapop/search/route.ts")).toBe(true);
    // The dot is a literal, so it must not match an arbitrary character.
    expect(pattern.test("app/api/wallapop/search/routeXts")).toBe(false);
  });
});

describe("parseOwnership", () => {
  const index = [
    "# Docs",
    "",
    "## Something else",
    "",
    "| Doc | Purpose |",
    "| --- | --- |",
    "| `not/a/map.md` | decoy |",
    "",
    "## Ownership map",
    "",
    "| Source | Governing doc |",
    "| --- | --- |",
    "| `lib/wallapop/**` | [integrations/wallapop.md](integrations/wallapop.md) |",
    "| `prisma/**` | [data-model.md](data-model.md) |",
    "",
    "## After",
    "",
    "| `lib/late/**` | [late.md](late.md) |",
  ].join("\n");

  it("reads only the rows under the ownership heading", () => {
    // The decoy table above and the row after the section both have the same
    // shape; scoping is the only thing that keeps them out.
    expect(parseOwnership(index)).toEqual([
      { glob: "lib/wallapop/**", doc: "integrations/wallapop.md" },
      { glob: "prisma/**", doc: "data-model.md" },
    ]);
  });

  it("returns nothing when there is no ownership section", () => {
    expect(parseOwnership("# Docs\n\nNo map here.\n")).toEqual([]);
  });

  it("accepts a plain backticked doc path instead of a link", () => {
    const source = ["## Ownership", "", "| `lib/geo/**` | `geo.md` |"].join("\n");

    expect(parseOwnership(source)).toEqual([{ glob: "lib/geo/**", doc: "geo.md" }]);
  });

  it("DOCS-7: the ownership map is parsed from the root README's Ownership map section", () => {
    const entries = parseOwnership(read("README.md"));

    expect(entries.length).toBeGreaterThan(0);
    expect(entries).toContainEqual({
      glob: "lib/wallapop/**",
      doc: "docs/specs/data-sources.md",
    });
  });
});

describe("isGap", () => {
  it.each(["—", "-", "--", "TBD", "tbd", "none"])("treats %s as a declared gap", (doc) => {
    expect(isGap(doc)).toBe(true);
  });

  it("does not treat a real doc path as a gap", () => {
    expect(isGap("data-model.md")).toBe(false);
    expect(isGap("integrations/wallapop.md")).toBe(false);
  });
});

describe("isDatedRecord", () => {
  it("LAYOUT-4: an ADR is a dated record whose paths are not checked; other docs are", () => {
    expect(isDatedRecord("docs/decisions/0007-adopt-core-rules.md")).toBe(true);
    expect(isDatedRecord("docs/ARCHITECTURE.md")).toBe(false);
    expect(isDatedRecord("docs/specs/alerts.md")).toBe(false);
  });
});

describe("isUnbuiltSpec", () => {
  const header = (status: string) =>
    `# Spec: Alerts\n\nKey: ALERT\nStatus: ${status}\nLast updated: 2026-08-03.\n`;

  it.each(["Draft", "Approved", "Superseded"])(
    "skips a %s spec, whose paths describe code that does not exist yet",
    (status) => {
      expect(isUnbuiltSpec("docs/specs/alerts.md", header(status))).toBe(true);
    },
  );

  it("checks an Implemented spec, where an unresolvable path is a real error", () => {
    expect(isUnbuiltSpec("docs/specs/alerts.md", header("Implemented"))).toBe(false);
  });

  it("skips Approved, which is the status that looks safe to check and is not", () => {
    // Approved means the failing tests have landed and the code has not — the
    // one moment every path in Data model and Contracts is guaranteed absent.
    expect(isUnbuiltSpec("docs/specs/alerts.md", header("Approved"))).toBe(true);
  });

  it("does not exempt a guide that merely contains the word Draft", () => {
    // Only specs declare a Status line, and only under docs/specs/. A guide
    // discussing drafts must not silently stop having its paths checked.
    expect(isUnbuiltSpec("docs/architecture.md", header("Draft"))).toBe(false);
  });

  it("accepts a Windows path separator, since the walk produces them", () => {
    expect(isUnbuiltSpec("docs\\specs\\alerts.md", header("Draft"))).toBe(true);
  });
});

describe("testSubject", () => {
  it.each([
    ["lib/env.test.ts", "lib/env.ts"],
    ["proxy.node.test.ts", "proxy.ts"],
    ["components/map/MapView.test.tsx", "components/map/MapView.tsx"],
    ["lib/rate-limit.node.test.ts", "lib/rate-limit.ts"],
  ])("maps %s back to %s", (file, subject) => {
    expect(testSubject(file)).toBe(subject);
  });

  it("returns null for a file that is not a test", () => {
    // Otherwise a source file would be checked against a subject that does not
    // exist, and silently count as claimed.
    expect(testSubject("lib/env.ts")).toBeNull();
    expect(testSubject("scripts/docs-check.mjs")).toBeNull();
  });

  it("does not mistake a filename merely containing 'test'", () => {
    expect(testSubject("lib/contest.ts")).toBeNull();
  });
});

describe("ownableFiles", () => {
  it("keeps source under a governed root and at the repo root", () => {
    // proxy.ts is route protection and the configs decide how the app builds —
    // checking only directories is what let 38 files go unclaimed unnoticed.
    expect(ownableFiles(["lib/env.ts", "proxy.ts", "next.config.ts", "e2e/map.spec.ts"])).toEqual([
      "lib/env.ts",
      "proxy.ts",
      "next.config.ts",
      "e2e/map.spec.ts",
    ]);
  });

  it("keeps committed tooling that changes how the project behaves", () => {
    // All three ship with a clone: CI decides what is enforced, the slash
    // commands define the workflow, and .env.example is what every deployment
    // copies from. Excluding them was the earlier, weaker rule.
    expect(
      ownableFiles([".github/workflows/test.yml", ".claude/commands/spec.md", ".env.example"]),
    ).toEqual([".github/workflows/test.yml", ".claude/commands/spec.md", ".env.example"]);
  });

  it("drops assets, generated output, and docs", () => {
    expect(
      ownableFiles([
        "app/favicon.ico",
        "docs/images/map.png",
        "app/generated/prisma/client.ts",
        "README.md",
        "pnpm-lock.yaml",
      ]),
    ).toEqual([]);
  });
});

describe("INDEX", () => {
  it("DOCS-7: the index is the root README", () => {
    expect(INDEX).toBe("README.md");
  });
});

describe("unreachableDocs", () => {
  it("DOCS-7: a docs/ file linked from nowhere is reported, naming it", () => {
    const linkGraph = new Map([
      ["README.md", ["docs/ARCHITECTURE.md"]],
      ["docs/ARCHITECTURE.md", ["docs/specs/a.md"]],
    ]);
    const roots = ["README.md"];
    const docs = ["docs/ARCHITECTURE.md", "docs/specs/a.md", "docs/specs/orphan.md"];

    expect(unreachableDocs(linkGraph, roots, docs)).toEqual(["docs/specs/orphan.md"]);
  });

  it("DOCS-7: reachability terminates on a link cycle and still reports the orphan", () => {
    const linkGraph = new Map([
      ["README.md", ["docs/a.md"]],
      ["docs/a.md", ["docs/b.md"]],
      ["docs/b.md", ["docs/a.md"]],
    ]);
    const roots = ["README.md"];
    const docs = ["docs/a.md", "docs/b.md", "docs/c.md"];

    expect(unreachableDocs(linkGraph, roots, docs)).toEqual(["docs/c.md"]);
  });
});

describe("unresolvedOwnershipDocs", () => {
  it("DOCS-7: a map row whose doc does not exist is reported", () => {
    const entries = [
      { glob: "lib/**", doc: "docs/ARCHITECTURE.md" },
      { glob: "app/**", doc: "docs/missing.md" },
    ];
    const existing = new Set(["docs/ARCHITECTURE.md"]);

    const problems = unresolvedOwnershipDocs(entries, "README.md", existing);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("docs/missing.md");
  });

  it("DOCS-7: a declared gap row in the ownership map is not reported as a missing doc", () => {
    const entries = [{ glob: "lib/**", doc: "—" }];

    expect(unresolvedOwnershipDocs(entries, "README.md", new Set())).toEqual([]);
  });
});

// `main`, run in-process against a throwaway fixture repository (never this
// one) with `cwd`/`log`/`error`/`exit` injected — the real docs:check, all
// four mechanical checks together, reading real files from disk.
describe("main", () => {
  let repo: string;

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), "docs-check-main-"));
    mkdirSync(join(repo, "docs"), { recursive: true });
    mkdirSync(join(repo, "lib"), { recursive: true });
    const run = (...args: string[]) => execFileSync("git", args, { cwd: repo });
    run("init", "-q");
    run("config", "user.email", "guard@example.test");
    run("config", "user.name", "Guard");
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  /**
   * A minimal, consistent README.md: an index link (with an anchor, so the
   * heading-slug lookup in `createSlugsFor`/`checkLink` runs on every test
   * that uses this) plus one ownership row.
   */
  function writeReadme() {
    writeFileSync(
      join(repo, "README.md"),
      [
        "# Project",
        "",
        "## Docs",
        "",
        "- [Foo](docs/foo.md#foo)",
        "",
        "## Ownership map",
        "",
        "| Source | Doc |",
        "| --- | --- |",
        "| `lib/**` | [docs/foo.md](docs/foo.md) |",
        "",
      ].join("\n"),
    );
  }

  function addAndTrack(relPath: string, contents: string) {
    const full = join(repo, relPath);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, contents);
    execFileSync("git", ["add", relPath], { cwd: repo });
  }

  it("DOCS-7: passes when every link resolves, every source path exists and every tracked file is claimed", async () => {
    writeReadme();
    execFileSync("git", ["add", "README.md"], { cwd: repo });
    writeFileSync(join(repo, "docs", "foo.md"), "# Foo\n");
    addAndTrack("lib/bar.ts", "export {};\n");
    // Nested under lib/, so listRepoFiles' walk has to recurse into a
    // subdirectory rather than stopping at lib/'s own top level.
    addAndTrack("lib/sub/nested.ts", "export {};\n");
    const log = vi.fn();
    const error = vi.fn();
    const exit = vi.fn();

    await main({ cwd: repo, log, error, exit });

    expect(error).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
    expect(log.mock.calls.flat().join("\n")).toContain("docs:check passed");
  });

  it("DOCS-7: fails when an index link's anchor names a heading the target doc does not have", async () => {
    writeFileSync(
      join(repo, "README.md"),
      ["# Project", "", "- [Foo](docs/foo.md#does-not-exist)", ""].join("\n"),
    );
    execFileSync("git", ["add", "README.md"], { cwd: repo });
    writeFileSync(join(repo, "docs", "foo.md"), "# Foo\n");
    const log = vi.fn();
    const error = vi.fn();
    const exit = vi.fn();

    await main({ cwd: repo, log, error, exit });

    expect(error.mock.calls.flat().join("\n")).toContain(
      'docs/foo.md has no heading "#does-not-exist"',
    );
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("DOCS-7: a Draft spec, a decisions/ record and app/generated/ are all exempt from the backticked-source-path check", async () => {
    writeReadme();
    execFileSync("git", ["add", "README.md"], { cwd: repo });
    writeFileSync(join(repo, "docs", "foo.md"), "# Foo\n");
    mkdirSync(join(repo, "docs", "specs"), { recursive: true });
    mkdirSync(join(repo, "docs", "decisions"), { recursive: true });
    writeFileSync(
      join(repo, "docs", "specs", "draft.md"),
      "# Draft\n\nStatus: Draft\n\nSee `lib/missing-in-draft.ts`.\n",
    );
    writeFileSync(
      join(repo, "docs", "decisions", "0001-x.md"),
      "# Decision\n\nSee `lib/missing-in-decision.ts`.\n",
    );
    writeFileSync(
      join(repo, "docs", "generated-ref.md"),
      "# Generated\n\nSee `app/generated/prisma/client.ts`.\n",
    );
    addAndTrack("lib/bar.ts", "export {};\n");
    const error = vi.fn();
    const exit = vi.fn();

    await main({ cwd: repo, log: vi.fn(), error, exit });

    const messages = error.mock.calls.flat().join("\n");
    expect(messages).not.toContain("lib/missing-in-draft.ts");
    expect(messages).not.toContain("lib/missing-in-decision.ts");
    expect(messages).not.toContain("app/generated/prisma/client.ts");
  });

  it("DOCS-7: reports the missing index and does not crash the ownership-map check when README.md is entirely absent", async () => {
    // No README.md at all — checkOrphanedDocs' own "INDEX missing" branch,
    // and checkOwnershipMap returning early because `sources.get(INDEX)` is
    // undefined rather than throwing.
    const log = vi.fn();
    const error = vi.fn();
    const exit = vi.fn();

    await main({ cwd: repo, log, error, exit });

    expect(error.mock.calls.flat().join("\n")).toContain(
      "README.md is missing — it is the documentation index.",
    );
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("DOCS-7: a declared gap row is skipped by ownership checks and listed under the pass message", async () => {
    writeFileSync(
      join(repo, "README.md"),
      [
        "# Project",
        "",
        "- [Foo](docs/foo.md#foo)",
        "",
        "## Ownership map",
        "",
        "| Source | Doc |",
        "| --- | --- |",
        "| `lib/**` | [docs/foo.md](docs/foo.md) |",
        "| `app/**` | — |",
        "",
      ].join("\n"),
    );
    execFileSync("git", ["add", "README.md"], { cwd: repo });
    writeFileSync(join(repo, "docs", "foo.md"), "# Foo\n");
    addAndTrack("lib/bar.ts", "export {};\n");
    // Matches the gap row's glob, so processOwnershipEntry does not also
    // report "matches no file" for it.
    addAndTrack("app/page.tsx", "export {};\n");
    const log = vi.fn();
    const error = vi.fn();
    const exit = vi.fn();

    await main({ cwd: repo, log, error, exit });

    expect(error).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
    const messages = log.mock.calls.flat().join("\n");
    expect(messages).toContain("docs:check passed");
    expect(messages).toContain("area(s) declared undocumented");
    expect(messages).toContain("app/**");
  });

  it("DOCS-7: fails and exits 1 when README.md links to a doc that does not exist", async () => {
    writeFileSync(
      join(repo, "README.md"),
      ["# Project", "", "- [Missing](docs/missing.md)", ""].join("\n"),
    );
    execFileSync("git", ["add", "README.md"], { cwd: repo });
    const log = vi.fn();
    const error = vi.fn();
    const exit = vi.fn();

    await main({ cwd: repo, log, error, exit });

    expect(error.mock.calls.flat().join("\n")).toContain(
      "README.md links to docs/missing.md, which does not exist.",
    );
    expect(exit).toHaveBeenCalledWith(1);
    expect(log).not.toHaveBeenCalled();
  });

  it("DOCS-7: fails when a tracked source file matches no ownership map entry", async () => {
    writeReadme();
    execFileSync("git", ["add", "README.md"], { cwd: repo });
    writeFileSync(join(repo, "docs", "foo.md"), "# Foo\n");
    // Tracked under a root the ownership map's one row ("lib/**") never names.
    mkdirSync(join(repo, "app"), { recursive: true });
    addAndTrack("app/page.tsx", "export {};\n");
    const log = vi.fn();
    const error = vi.fn();
    const exit = vi.fn();

    await main({ cwd: repo, log, error, exit });

    expect(error.mock.calls.flat().join("\n")).toContain(
      "tracked source file(s) are covered by no entry",
    );
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("DOCS-7: fails when a doc refers to a backticked source path that does not exist", async () => {
    writeReadme();
    execFileSync("git", ["add", "README.md"], { cwd: repo });
    writeFileSync(join(repo, "docs", "foo.md"), "# Foo\n\nSee `lib/missing.ts`.\n");
    addAndTrack("lib/bar.ts", "export {};\n");
    const log = vi.fn();
    const error = vi.fn();
    const exit = vi.fn();

    await main({ cwd: repo, log, error, exit });

    expect(error.mock.calls.flat().join("\n")).toContain(
      "docs/foo.md refers to `lib/missing.ts`, which does not exist.",
    );
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("DOCS-7: fails when a doc under docs/ is not reachable from the README index", async () => {
    // README's ownership row still links to docs/foo.md, but docs/orphan.md
    // is reachable from nowhere.
    writeReadme();
    execFileSync("git", ["add", "README.md"], { cwd: repo });
    writeFileSync(join(repo, "docs", "foo.md"), "# Foo\n");
    writeFileSync(join(repo, "docs", "orphan.md"), "# Orphan\n");
    addAndTrack("lib/bar.ts", "export {};\n");
    const log = vi.fn();
    const error = vi.fn();
    const exit = vi.fn();

    await main({ cwd: repo, log, error, exit });

    expect(error.mock.calls.flat().join("\n")).toContain(
      "docs/orphan.md is not reachable by links from README.md",
    );
    expect(exit).toHaveBeenCalledWith(1);
  });
});
