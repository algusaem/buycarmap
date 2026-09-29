import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  copyFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { cruise } from "dependency-cruiser";
import extractTSConfig from "dependency-cruiser/config-utl/extract-ts-config";
import type { IFlattenedRuleSet, IViolation } from "dependency-cruiser";
import { describe, expect, it } from "vitest";

// Reads the working tree directly against docs/specs/core-layout.md (LAYOUT-1..10,
// except LAYOUT-4 which is covered by docs-check.node.test.ts since it tests
// docs-check's isDatedRecord, not the tree). These fail against today's root
// app/ / components/ / lib/ layout with no server/ tree, and pass once phase 5
// lands: the server layer, the dependency-cruiser config and the plop
// scaffold. The move itself is a later change.

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (path: string) => readFileSync(join(ROOT, path), "utf8").replace(/\r\n/g, "\n");
const exists = (path: string) => existsSync(join(ROOT, path));
const readIfExists = (path: string) => (exists(path) ? read(path) : "");

// The pure merge-logic functions LAYOUT-3 moves out of the hook and into
// lib/listings/.
const MERGE_FUNCTION_NAMES = [
  "interleave",
  "filterByModel",
  "applyResultFilters",
  "hasMorePages",
  "collectRoundResults",
  "nextWallapopPage",
  "nextPageState",
  "advancePageState",
];

// The server/<feature> directories LAYOUT-5 requires.
const FEATURES = [
  "account",
  "alerts",
  "auth",
  "email-verification",
  "favorites",
  "locale",
  "password-reset",
  "rate-limit",
  "registration",
  "search",
  "two-factor",
];

describe("source layout", () => {
  it("LAYOUT-1: the root layout stays, no tracked file sits under src/, and ADR 0012 records the deviation", () => {
    const trackedOldOutput = execFileSync(
      "git",
      ["ls-files", "--", "app/page.tsx", "proxy.ts", "e2e/map.spec.ts"],
      { cwd: ROOT, encoding: "utf8" },
    ).trim();
    expect(trackedOldOutput.split("\n").filter(Boolean).sort()).toEqual(
      ["app/page.tsx", "e2e/map.spec.ts", "proxy.ts"].sort(),
    );

    const trackedSrcOutput = execFileSync("git", ["ls-files", "--", "src"], {
      cwd: ROOT,
      encoding: "utf8",
    }).trim();
    expect(trackedSrcOutput).toBe("");

    const decisionFiles = existsSync(join(ROOT, "docs/decisions"))
      ? readdirSync(join(ROOT, "docs/decisions"))
      : [];
    const adrFiles = decisionFiles.filter((name) => /^0012-.*\.md$/.test(name));
    expect(adrFiles.length).toBe(1);

    const adrText = read(`docs/decisions/${adrFiles[0]}`);
    expect(adrText).toContain("STACK.md §6");
  });

  it("LAYOUT-2: Vitest's coverage include covers proxy.ts, and the thresholds are unchanged", () => {
    const vitestConfig = read("vitest.config.ts");
    expect(vitestConfig).toMatch(/include:\s*\[[^\]]*"proxy\.ts"[^\]]*\]/);

    expect(vitestConfig).toMatch(
      /thresholds:\s*\{[^}]*statements:\s*89[^}]*branches:\s*85[^}]*functions:\s*84[^}]*lines:\s*89/,
    );
  });

  it("LAYOUT-3: the hook holds only the request lifecycle, and imports the merge logic from lib/listings/", () => {
    // Gated first so the check cannot pass vacuously against the hook's
    // current, pre-move content.
    expect(exists("lib/listings")).toBe(true);

    const hookSource = readIfExists("lib/hooks/useListingsSearch.ts");
    const stillDefined = MERGE_FUNCTION_NAMES.filter((name) => {
      const pattern = new RegExp(`\\bfunction\\s+${name}\\b|\\bconst\\s+${name}\\s*=`);
      return pattern.test(hookSource);
    });
    expect(stillDefined).toEqual([]);

    expect(hookSource).toContain('from "@/lib/listings/');
  });

  it("LAYOUT-5: server/<feature> holds the server layer, the old locations are gone, and only the allowed files reach lib/db or Prisma directly", () => {
    const missingFeatureDirs = FEATURES.filter((feature) => !exists(`server/${feature}`));
    expect(missingFeatureDirs).toEqual([]);

    expect(exists("app/actions")).toBe(false);
    expect(exists("lib/validations")).toBe(false);
    expect(exists("lib/prisma.ts")).toBe(false);
    expect(exists("lib/db/prisma.ts")).toBe(true);

    expect(gitGrepDbOffenders()).toEqual([]);
  });

  it("LAYOUT-6: dependency-cruiser is wired into lint, and the config enforces the app/component/lib boundaries with 0 violations on the real tree", async () => {
    // Gated first: cruising against a config that does not exist yet would
    // throw deep inside dependency-cruiser rather than fail a clean assertion.
    expect(exists(".dependency-cruiser.cjs")).toBe(true);

    const packageJson = JSON.parse(read("package.json")) as { scripts?: Record<string, string> };
    expect(packageJson.scripts?.lint ?? "").toContain("depcruise");

    const rows: ImportRow[] = [
      { from: "app/x/page.tsx", specifier: "@/server/favorites/service", verdict: "reported" },
      { from: "app/x/page.tsx", specifier: "@/server/favorites/queries", verdict: "clean" },
      { from: "components/X.tsx", specifier: "@/server/favorites/service", verdict: "reported" },
      { from: "components/X.tsx", specifier: "@/server/favorites/schema", verdict: "clean" },
      { from: "components/X.tsx", specifier: "@/server/favorites/actions", verdict: "clean" },
      {
        from: "server/alerts/service.ts",
        specifier: "@/server/rate-limit/service",
        verdict: "clean",
      },
      {
        from: "server/alerts/service.ts",
        specifier: "@/server/rate-limit/helpers",
        verdict: "reported",
      },
      { from: "server/favorites/actions.ts", specifier: "@/lib/db/prisma", verdict: "reported" },
      {
        from: "lib/geo/x.ts",
        specifier: "@/app/generated/prisma/client",
        verdict: "reported",
      },
      { from: "lib/geo/x.ts", specifier: "@/server/favorites/service", verdict: "reported" },
    ];

    const ruleSet = loadRuleSet();
    const dir = buildCruiseFixture(rows);
    writeFixtureFile(dir, "lib/geo/cycle-a.ts", 'import "@/lib/geo/cycle-b";\nexport {};\n');
    writeFixtureFile(dir, "lib/geo/cycle-b.ts", 'import "@/lib/geo/cycle-a";\nexport {};\n');

    const violations = await cruiseFixture(dir, ruleSet);
    assertRows(rows, violations);
    expect(violations.some(isCycleViolation)).toBe(true);

    const realTreeViolations = await cruiseFixture(ROOT, ruleSet, REAL_TREE_EXCLUDE);
    expect(realTreeViolations).toEqual([]);
    // Cruising the whole real tree takes about 6s when the full suite runs in
    // parallel with coverage, past Vitest's 5s default.
  }, 30_000);

  it("LAYOUT-7: the NextAuth exception is scoped to lib/auth/options.ts importing only lib/db and server/auth/service", async () => {
    expect(exists(".dependency-cruiser.cjs")).toBe(true);

    const rows: ImportRow[] = [
      { from: "lib/auth/options.ts", specifier: "@/lib/db/prisma", verdict: "clean" },
      { from: "lib/auth/options.ts", specifier: "@/server/auth/service", verdict: "clean" },
      { from: "lib/auth/session.ts", specifier: "@/lib/db/prisma", verdict: "reported" },
      {
        from: "lib/auth/options.ts",
        specifier: "@/server/favorites/service",
        verdict: "reported",
      },
    ];

    const ruleSet = loadRuleSet();
    const dir = buildCruiseFixture(rows);
    const violations = await cruiseFixture(dir, ruleSet);
    assertRows(rows, violations);
  });

  it("LAYOUT-8: a route.ts under app/api/** may import a feature's service, every other app/** file stays bound by LAYOUT-6", async () => {
    expect(exists(".dependency-cruiser.cjs")).toBe(true);

    const rows: ImportRow[] = [
      { from: "app/api/x/route.ts", specifier: "@/server/alerts/service", verdict: "clean" },
      { from: "app/x/page.tsx", specifier: "@/server/alerts/service", verdict: "reported" },
      {
        from: "app/api/x/helpers.ts",
        specifier: "@/server/alerts/service",
        verdict: "reported",
      },
    ];

    const ruleSet = loadRuleSet();
    const dir = buildCruiseFixture(rows);
    const violations = await cruiseFixture(dir, ruleSet);
    assertRows(rows, violations);
  });

  it("LAYOUT-10: a hook under lib/hooks/** may import a feature's actions.ts or schema.ts, every other lib/** file stays bound by LAYOUT-6", async () => {
    expect(exists(".dependency-cruiser.cjs")).toBe(true);

    const rows: ImportRow[] = [
      { from: "lib/hooks/useX.ts", specifier: "@/server/favorites/actions", verdict: "clean" },
      { from: "lib/hooks/useX.ts", specifier: "@/server/favorites/schema", verdict: "clean" },
      { from: "lib/hooks/useX.ts", specifier: "@/server/favorites/service", verdict: "reported" },
      { from: "lib/geo/x.ts", specifier: "@/server/favorites/actions", verdict: "reported" },
    ];

    const ruleSet = loadRuleSet();
    const dir = buildCruiseFixture(rows);
    const violations = await cruiseFixture(dir, ruleSet);
    assertRows(rows, violations);
  });

  it("LAYOUT-9: pnpm gen feature scaffolds the four server files and the spec, and refuses to redo an existing feature", async () => {
    // Gated first: node-plop is only reachable as a dependency of the
    // installed `plop` package (pnpm does not hoist it on its own), so the
    // import below must never run before we know plopfile.mjs exists.
    expect(exists("plopfile.mjs")).toBe(true);

    const nodePlop = await loadNodePlop();

    const dir = mkdtempSync(join(tmpdir(), "layout9-"));
    mkdirSync(join(dir, "docs", "specs"), { recursive: true });
    copyFileSync(join(ROOT, "docs/specs/_template.md"), join(dir, "docs/specs/_template.md"));
    const plopfilePath = join(dir, "plopfile.mjs");
    copyFileSync(join(ROOT, "plopfile.mjs"), plopfilePath);

    const EXPECTED_FILES = [
      "server/widgets/queries.ts",
      "server/widgets/actions.ts",
      "server/widgets/service.ts",
      "server/widgets/schema.ts",
      "docs/specs/widgets.md",
    ];

    const plop = await nodePlop(plopfilePath, { destBasePath: dir });
    const firstRun = await plop.getGenerator("feature").runActions({ name: "widgets" });

    expect(firstRun.failures).toEqual([]);
    const created = EXPECTED_FILES.filter((file) => existsSync(join(dir, file)));
    expect(created.slice().sort()).toEqual(EXPECTED_FILES.slice().sort());

    const before = snapshotFiles(dir, EXPECTED_FILES);

    const secondPlop = await nodePlop(plopfilePath, { destBasePath: dir });
    const secondRun = await secondPlop.getGenerator("feature").runActions({ name: "widgets" });

    expect(secondRun.failures.length).toBeGreaterThan(0);
    const failureText = secondRun.failures
      .map((failure) => `${failure.path} ${failure.error}`)
      .join("\n");
    expect(failureText).toMatch(/server[\\/]widgets/);

    expect(snapshotFiles(dir, EXPECTED_FILES)).toEqual(before);
  });
});

// --- LAYOUT-5 helper --------------------------------------------------------

/**
 * Tracked *.ts/*.tsx files that import lib/db, lib/prisma or the generated
 * Prisma client directly, outside the files the spec allows
 * (server/<feature>/service.ts, lib/db/**, lib/auth/options.ts, and tests,
 * which mock it).
 */
function gitGrepDbOffenders(): string[] {
  let output = "";
  try {
    output = execFileSync(
      "git",
      [
        "grep",
        "-l",
        "-I",
        "-E",
        "@/lib/db/|@/lib/prisma|app/generated/prisma",
        "--",
        "*.ts",
        "*.tsx",
      ],
      { cwd: ROOT, encoding: "utf8" },
    );
  } catch (error) {
    if (gitGrepStatus(error) === 1) return [];
    throw error;
  }

  const files = output.trim() === "" ? [] : output.trim().split("\n");
  const ALLOWED = [
    /^server\/[^/]+\/service\.ts$/,
    /^lib\/db\//,
    /^lib\/auth\/options\.ts$/,
    /\.test\.tsx?$/,
  ];
  return files.filter((file) => !ALLOWED.some((pattern) => pattern.test(file)));
}

function gitGrepStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
}

// --- LAYOUT-6..8 dependency-cruiser fixture helpers -------------------------

interface ImportRow {
  from: string;
  specifier: string;
  verdict: "reported" | "clean";
}

const REAL_TREE_EXCLUDE =
  "node_modules|\\.next|\\.git|coverage|playwright-report|test-results|blob-report|\\.claude/worktrees|app/generated";

function targetPath(row: ImportRow): string {
  return `${row.specifier.replace(/^@\//, "")}.ts`;
}

function writeFixtureFile(dir: string, rel: string, content: string): void {
  const full = join(dir, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, "utf8");
}

/** Loads the real, committed dependency-cruiser config — never a rule set invented for the test. */
function loadRuleSet(): IFlattenedRuleSet {
  const require = createRequire(import.meta.url);
  return require(join(ROOT, ".dependency-cruiser.cjs")) as IFlattenedRuleSet;
}

/**
 * Builds a fixture tree: one importer file per distinct `from` (importing
 * every specifier the rows give it), plus a stub target file for every
 * specifier so dependency-cruiser can resolve it and match rules against the
 * resolved path, not the bare alias.
 */
function buildCruiseFixture(rows: ImportRow[]): string {
  const dir = mkdtempSync(join(tmpdir(), "layout-cruise-"));
  writeFixtureFile(
    dir,
    "tsconfig.json",
    JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./*"] } } }, null, 2),
  );

  const importsByFile = new Map<string, string[]>();
  for (const row of rows) {
    const specifiers = importsByFile.get(row.from) ?? [];
    specifiers.push(row.specifier);
    importsByFile.set(row.from, specifiers);
  }
  for (const [from, specifiers] of importsByFile) {
    const lines = specifiers.map((specifier) => `import "${specifier}";`).join("\n");
    writeFixtureFile(dir, from, `${lines}\nexport {};\n`);
  }

  const targets = new Set(rows.map(targetPath));
  for (const target of targets) {
    if (!existsSync(join(dir, target))) writeFixtureFile(dir, target, "export {};\n");
  }

  return dir;
}

/** Cruises `dir` (a fixture tree, or ROOT for the real-tree check) with the real config's rules. */
async function cruiseFixture(
  dir: string,
  ruleSet: IFlattenedRuleSet,
  exclude?: string,
): Promise<IViolation[]> {
  const tsConfigFileName = join(dir, "tsconfig.json");
  const parsedTsConfig = extractTSConfig(tsConfigFileName);
  const result = await cruise(
    ["."],
    {
      validate: true,
      ruleSet,
      tsConfig: { fileName: tsConfigFileName },
      exclude: exclude ?? "node_modules",
      baseDir: dir,
    },
    undefined,
    { tsConfig: parsedTsConfig },
  );

  const output = result.output;
  if (typeof output === "string") return [];
  return output.summary.violations;
}

/** A violation is reported for exactly the (from, to) pair a row names — not merely the same `from`, since several rows in LAYOUT-6..8 share an importer with different verdicts. */
function assertRows(rows: ImportRow[], violations: IViolation[]): void {
  for (const row of rows) {
    const to = targetPath(row);
    const reported = violations.some(
      (violation) => violation.from === row.from && violation.to === to,
    );
    expect(reported, `${row.from} -> ${row.specifier} expected ${row.verdict}`).toBe(
      row.verdict === "reported",
    );
  }
}

function isCycleViolation(violation: IViolation): boolean {
  return violation.type === "cycle" || /circular/i.test(violation.rule.name);
}

// --- LAYOUT-9 node-plop helpers ----------------------------------------------

interface PlopRunResult {
  changes: { type: string; path: string }[];
  failures: { type: string; path: string; error: string }[];
}

interface PlopGenerator {
  runActions(answers: Record<string, string>): Promise<PlopRunResult>;
}

interface NodePlopApi {
  getGenerator(name: string): PlopGenerator;
}

type NodePlopFactory = (
  plopfilePath: string,
  config: { destBasePath: string },
) => Promise<NodePlopApi>;

/**
 * node-plop ships only as a dependency of the installed `plop` package —
 * pnpm's strict node_modules does not hoist it to the top level because
 * nothing in this project declares it directly. Resolving it the way `plop`
 * itself does (relative to plop's own installed location) reaches the same
 * copy without adding a second dependency.
 */
async function loadNodePlop(): Promise<NodePlopFactory> {
  const plopEntryUrl = import.meta.resolve("plop");
  const pluginRequire = createRequire(plopEntryUrl);
  const nodePlopPath = pluginRequire.resolve("node-plop");
  const mod = (await import(pathToFileURL(nodePlopPath).href)) as { default: NodePlopFactory };
  return mod.default;
}

function snapshotFiles(
  dir: string,
  files: string[],
): { file: string; content: string; mtimeMs: number }[] {
  return files.map((file) => {
    const full = join(dir, file);
    return { file, content: readFileSync(full, "utf8"), mtimeMs: statSync(full).mtimeMs };
  });
}
