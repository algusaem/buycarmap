import { describe, expect, it } from "vitest";

import * as check from "./docs-check.mjs";

const {
  extractLinks,
  extractSourcePaths,
  globToRegExp,
  headingSlugs,
  isGap,
  isUnbuiltSpec,
  ownableFiles,
  parseOwnership,
  slugify,
  stripFences,
  testSubject,
} = check as unknown as {
  extractLinks: (markdown: string) => string[];
  extractSourcePaths: (markdown: string) => Set<string>;
  globToRegExp: (glob: string) => RegExp;
  headingSlugs: (markdown: string) => Set<string>;
  isGap: (doc: string) => boolean;
  isUnbuiltSpec: (file: string, text: string) => boolean;
  ownableFiles: (tracked: string[]) => string[];
  parseOwnership: (markdown: string) => { glob: string; doc: string }[];
  slugify: (heading: string) => string;
  stripFences: (markdown: string) => string;
  testSubject: (file: string) => string | null;
};

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
    const source =
      "[web](https://example.com) [mail](mailto:a@b.c) [top](#intro) [real](x.md)";

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
    expect(extractSourcePaths("`category_id=100` `next_page` `DATABASE_URL`")).toEqual(
      new Set(),
    );
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
});

describe("isGap", () => {
  it.each(["—", "-", "--", "TBD", "tbd", "none"])(
    "treats %s as a declared gap",
    (doc) => {
      expect(isGap(doc)).toBe(true);
    },
  );

  it("does not treat a real doc path as a gap", () => {
    expect(isGap("data-model.md")).toBe(false);
    expect(isGap("integrations/wallapop.md")).toBe(false);
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
    expect(isUnbuiltSpec("docs/specs/alerts.md", header("Implemented"))).toBe(
      false,
    );
  });

  it("skips Approved, which is the status that looks safe to check and is not", () => {
    // Approved means the failing tests have landed and the code has not — the
    // one moment every path in §5 is guaranteed absent.
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
    expect(
      ownableFiles(["lib/env.ts", "proxy.ts", "next.config.ts", "e2e/map.spec.ts"]),
    ).toEqual(["lib/env.ts", "proxy.ts", "next.config.ts", "e2e/map.spec.ts"]);
  });

  it("keeps committed tooling that changes how the project behaves", () => {
    // All three ship with a clone: CI decides what is enforced, the slash
    // commands define the workflow, and .env.example is what every deployment
    // copies from. Excluding them was the earlier, weaker rule.
    expect(
      ownableFiles([
        ".github/workflows/test.yml",
        ".claude/commands/spec.md",
        ".env.example",
      ]),
    ).toEqual([
      ".github/workflows/test.yml",
      ".claude/commands/spec.md",
      ".env.example",
    ]);
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
