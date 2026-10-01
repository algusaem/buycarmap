import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
  copyFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { cruise } from "dependency-cruiser";
import extractTSConfig from "dependency-cruiser/config-utl/extract-ts-config";
import type { IConfiguration, IModule, IViolation } from "dependency-cruiser";
import nodePlop from "node-plop";
import { afterEach, describe, expect, it } from "vitest";

// Checks the working tree against docs/specs/core-layout.md, LAYOUT-1..3 and
// LAYOUT-5..11. LAYOUT-4 is covered by docs-check.node.test.ts, since it tests
// docs-check's isDatedRecord rather than the tree. LAYOUT-6..8 and 10 cruise
// fixture trees with the committed dependency-cruiser config, rules and
// options both, and then cruise the real tree the way `pnpm depcruise` does.
// LAYOUT-9 runs the committed plopfile through node-plop in a temp directory.
// LAYOUT-11 is covered by the colocated server/<feature>/queries.node.test.ts.

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (path: string) => readFileSync(join(ROOT, path), "utf8").replace(/\r\n/g, "\n");
const exists = (path: string) => existsSync(join(ROOT, path));
const readIfExists = (path: string) => (exists(path) ? read(path) : "");

// Every temp directory a test creates, removed after each test.
const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

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
    expect(vitestConfig).toMatch(/coverage:\s*\{[\s\S]*?include:\s*\[[^\]]*"proxy\.ts"[^\]]*\]/);

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
    expect(exists("lib/alerts")).toBe(false);
    expect(exists("lib/db/prisma.ts")).toBe(true);
    expect(exists("lib/search/schema.ts")).toBe(true);

    expect(gitGrepDbOffenders()).toEqual([]);
    expect(gitGrepZodOffenders()).toEqual([]);

    const serverActionFiles = trackedUseServerFiles();
    expect(serverActionFiles.length).toBeGreaterThan(0);
    expect(serverActionFiles.filter((file) => !/^server\/[^/]+\/actions\.ts$/.test(file))).toEqual(
      [],
    );
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
      { from: "app/x/page.tsx", specifier: "@/server/alerts/search", verdict: "reported" },
      { from: "app/x/page.tsx", specifier: "@/server/alerts/schema", verdict: "clean" },
      { from: "app/api/x/route.ts", specifier: "@/server/alerts/search", verdict: "reported" },
      { from: "components/X.tsx", specifier: "@/server/favorites/service", verdict: "reported" },
      { from: "components/X.tsx", specifier: "@/server/favorites/schema", verdict: "clean" },
      { from: "components/X.tsx", specifier: "@/server/favorites/actions", verdict: "clean" },
      { from: "components/X.tsx", specifier: "@/server/favorites/queries", verdict: "reported" },
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
      { from: "lib/geo/x.ts", specifier: "@/app/x/page", verdict: "reported" },
      // Type-only imports and tests.
      {
        from: "lib/geo/x.ts",
        specifier: "@/server/favorites/schema",
        verdict: "reported",
        typeOnly: true,
      },
      { from: "components/X.tsx", specifier: "@prisma/client", verdict: "reported" },
      { from: "lib/auth/options.ts", specifier: "@prisma/client", verdict: "reported" },
      {
        from: "server/favorites/actions.node.test.ts",
        specifier: "@/lib/db/prisma",
        verdict: "clean",
      },
    ];

    const config = loadConfig();
    const dir = buildCruiseFixture(rows);
    writeFixtureFile(dir, "lib/geo/cycle-a.ts", 'import "@/lib/geo/cycle-b";\nexport {};\n');
    writeFixtureFile(dir, "lib/geo/cycle-b.ts", 'import "@/lib/geo/cycle-a";\nexport {};\n');
    writeFixtureFile(
      dir,
      "lib/geo/cycle-c.test.ts",
      'import "@/lib/geo/cycle-d.test";\nexport {};\n',
    );
    writeFixtureFile(
      dir,
      "lib/geo/cycle-d.test.ts",
      'import "@/lib/geo/cycle-c.test";\nexport {};\n',
    );

    const { violations } = await cruiseTree(dir, config, ["."]);
    assertRows(rows, violations);
    expect(violations.some(isCycleViolation)).toBe(true);
    expect(
      violations.some(
        (violation) =>
          isCycleViolation(violation) && /^lib\/geo\/cycle-[ab]\.ts$/.test(violation.from),
      ),
    ).toBe(true);
    expect(
      violations.some(
        (violation) =>
          isCycleViolation(violation) && /^lib\/geo\/cycle-[cd]\.test\.ts$/.test(violation.from),
      ),
    ).toBe(true);

    // The real tree, cruised with the same config and the same roots as
    // `pnpm depcruise`.
    const realTree = await cruiseTree(ROOT, config, depcruiseRoots());
    const favoritesActions = realTree.modules.find(
      (module) => module.source === "server/favorites/actions.ts",
    );
    expect(favoritesActions).toBeDefined();
    expect(
      favoritesActions?.dependencies.some(
        (dependency) =>
          dependency.resolved === "server/favorites/service.ts" && !dependency.couldNotResolve,
      ),
    ).toBe(true);
    const realTreeViolations = realTree.violations;
    expect(realTreeViolations).toEqual([]);
    // Cruising the whole real tree takes about 6s when the full suite runs in
    // parallel with coverage, past Vitest's 5s default.
  }, 30_000);

  it("LAYOUT-6: @prisma/* is reported through pnpm's .pnpm store path", async () => {
    expect(exists(".dependency-cruiser.cjs")).toBe(true);

    const config = loadConfig();
    const dir = buildCruiseFixture([]);
    // pnpm links node_modules/@prisma/client to its store under
    // node_modules/.pnpm/, so the import resolves to the store path. A
    // directory junction needs no elevated rights on Windows and is a plain
    // symlink elsewhere.
    writeFixtureFile(
      dir,
      `${PNPM_PRISMA_PACKAGE_DIR}/package.json`,
      JSON.stringify({ name: "@prisma/client", main: "index.js" }, null, 2),
    );
    writeFixtureFile(dir, `${PNPM_PRISMA_PACKAGE_DIR}/index.js`, "module.exports = {};\n");
    rmSync(join(dir, PRISMA_PACKAGE_DIR), { recursive: true, force: true });
    symlinkSync(join(dir, PNPM_PRISMA_PACKAGE_DIR), join(dir, PRISMA_PACKAGE_DIR), "junction");
    writeFixtureFile(dir, "components/X.tsx", 'import "@prisma/client";\nexport {};\n');

    const { violations } = await cruiseTree(dir, config, ["components"]);
    expect(
      violations.some(
        (violation) =>
          violation.from === "components/X.tsx" &&
          violation.to === `${PNPM_PRISMA_PACKAGE_DIR}/index.js`,
      ),
    ).toBe(true);
  });

  it("LAYOUT-6: an import of the generated client is reported even when app/generated is absent", async () => {
    expect(exists(".dependency-cruiser.cjs")).toBe(true);

    const config = loadConfig();
    const dir = buildCruiseFixture([]);
    writeFixtureFile(dir, "lib/geo/x.ts", 'import "@/app/generated/prisma/client";\nexport {};\n');
    expect(existsSync(join(dir, "app/generated"))).toBe(false);

    const { violations } = await cruiseTree(dir, config, ["lib"]);
    expect(
      violations.some(
        (violation) =>
          violation.from === "lib/geo/x.ts" && violation.to === "@/app/generated/prisma/client",
      ),
    ).toBe(true);
  });

  it("LAYOUT-7: the NextAuth exception is scoped to lib/auth/options.ts importing only lib/db and server/auth/service", async () => {
    expect(exists(".dependency-cruiser.cjs")).toBe(true);

    const config = loadConfig();
    const exceptionRules = (config.forbidden ?? []).filter(
      (rule) =>
        (rule.comment ?? "").includes("ADR 0007 row 25") &&
        JSON.stringify(rule).includes("lib/auth/options"),
    );
    expect(exceptionRules.length).toBeGreaterThan(0);

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

    const dir = buildCruiseFixture(rows);
    const { violations } = await cruiseTree(dir, config, ["."]);
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

    const config = loadConfig();
    const dir = buildCruiseFixture(rows);
    const { violations } = await cruiseTree(dir, config, ["."]);
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

    const config = loadConfig();
    const dir = buildCruiseFixture(rows);
    const { violations } = await cruiseTree(dir, config, ["."]);
    assertRows(rows, violations);
  });

  it("LAYOUT-9: pnpm gen feature scaffolds the four server files and the spec, and refuses to redo an existing feature", async () => {
    expect(exists("plopfile.mjs")).toBe(true);

    const { dir, plopfilePath } = makePlopFixture("layout9-");

    const EXPECTED_FILES = [
      "server/widgets/queries.ts",
      "server/widgets/actions.ts",
      "server/widgets/service.ts",
      "server/widgets/schema.ts",
      "docs/specs/widgets.md",
    ];

    const plop = await nodePlop(plopfilePath, { destBasePath: dir, force: false });
    const firstRun = await plop.getGenerator("feature").runActions({ name: "widgets" });

    expect(firstRun.failures).toEqual([]);
    const created = EXPECTED_FILES.filter((file) => existsSync(join(dir, file)));
    expect(created.slice().sort()).toEqual(EXPECTED_FILES.slice().sort());
    expect(readFileSync(join(dir, "docs/specs/widgets.md"))).toEqual(
      readFileSync(join(ROOT, "docs/specs/_template.md")),
    );

    const before = snapshotFiles(dir, EXPECTED_FILES);

    const secondPlop = await nodePlop(plopfilePath, { destBasePath: dir, force: false });
    const secondRun = await secondPlop.getGenerator("feature").runActions({ name: "widgets" });

    expect(secondRun.failures.length).toBeGreaterThan(0);
    const failureText = secondRun.failures
      .map((failure) => `${failure.path} ${failure.error}`)
      .join("\n");
    expect(failureText).toMatch(/server[\\/]widgets/);

    expect(snapshotFiles(dir, EXPECTED_FILES)).toEqual(before);
  });

  it("LAYOUT-9: pnpm gen feature refuses a name whose spec already exists, and writes nothing", async () => {
    expect(exists("plopfile.mjs")).toBe(true);

    const { dir, plopfilePath } = makePlopFixture("layout9-spec-");

    const existingSpec = "# Gadgets\n\nAn existing spec.\n";
    writeFileSync(join(dir, "docs/specs/gadgets.md"), existingSpec, "utf8");
    const before = snapshotFiles(dir, ["docs/specs/gadgets.md"]);

    const plop = await nodePlop(plopfilePath, { destBasePath: dir, force: false });
    const run = await plop.getGenerator("feature").runActions({ name: "gadgets" });

    expect(run.failures.length).toBeGreaterThan(0);
    const failureText = run.failures
      .map((failure) => `${failure.path} ${failure.error}`)
      .join("\n");
    expect(failureText).toMatch(/docs[\\/]specs[\\/]gadgets\.md/);

    expect(existsSync(join(dir, "server"))).toBe(false);
    expect(snapshotFiles(dir, ["docs/specs/gadgets.md"])).toEqual(before);
  });
});

// --- LAYOUT-5 helpers --------------------------------------------------------

/**
 * Tracked *.ts/*.tsx files that import lib/db, lib/prisma or the generated
 * Prisma client directly, outside the files the spec allows
 * (server/<feature>/service.ts, lib/db/**, lib/auth/options.ts, and tests,
 * which mock it).
 */
function gitGrepDbOffenders(): string[] {
  const files = gitGrepFiles("@/lib/db/|@/lib/prisma|app/generated/prisma");
  const ALLOWED = [
    /^server\/[^/]+\/service\.ts$/,
    /^lib\/db\//,
    /^lib\/auth\/options\.ts$/,
    /\.test\.tsx?$/,
    /^test\//,
    /^prisma\/seed\.ts$/,
  ];
  return files.filter((file) => !ALLOWED.some((pattern) => pattern.test(file)));
}

/**
 * Tracked non-test *.ts/*.tsx files that import zod outside a feature's
 * schema.ts and the two schemas LAYOUT-5 keeps outside server/ until their
 * phase (lib/search/schema.ts, lib/env.ts).
 */
function gitGrepZodOffenders(): string[] {
  const files = gitGrepFiles("from ['\"]zod(/[^'\"]*)?['\"]");
  const ALLOWED = [
    /^server\/[^/]+\/schema\.ts$/,
    /^lib\/search\/schema\.ts$/,
    /^lib\/env\.ts$/,
    /^lib\/ids\.ts$/,
    /\.test\.tsx?$/,
  ];
  return files.filter((file) => !ALLOWED.some((pattern) => pattern.test(file)));
}

/** Tracked *.ts/*.tsx files whose first statement is the "use server" directive. */
function trackedUseServerFiles(): string[] {
  const directive = /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*["']use server["']/;
  return gitGrepFiles("use server").filter((file) => directive.test(read(file)));
}

function gitGrepFiles(pattern: string): string[] {
  let output = "";
  try {
    output = execFileSync("git", ["grep", "-l", "-I", "-E", pattern, "--", "*.ts", "*.tsx"], {
      cwd: ROOT,
      encoding: "utf8",
    });
  } catch (error) {
    if (gitGrepStatus(error) === 1) return [];
    throw error;
  }

  return output.trim() === "" ? [] : output.trim().split("\n");
}

function gitGrepStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
}

// --- LAYOUT-6..8 and 10 dependency-cruiser helpers ---------------------------

interface ImportRow {
  from: string;
  specifier: string;
  verdict: "reported" | "clean";
  /** Written as `import type { Stub } from "…"` instead of a side-effect import. */
  typeOnly?: boolean;
}

interface CruiseOutcome {
  violations: IViolation[];
  modules: IModule[];
}

const PRISMA_PACKAGE_DIR = "node_modules/@prisma/client";
const PNPM_PRISMA_PACKAGE_DIR = "node_modules/.pnpm/x@1/node_modules/@prisma/client";

function isBarePackage(specifier: string): boolean {
  return !specifier.startsWith("@/");
}

function targetPath(row: ImportRow): string {
  return `${row.specifier.replace(/^@\//, "")}.ts`;
}

function writeFixtureFile(dir: string, rel: string, content: string): void {
  const full = join(dir, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, "utf8");
}

/** Loads the real, committed dependency-cruiser config — never a rule set invented for the test. */
function loadConfig(): IConfiguration {
  const require = createRequire(import.meta.url);
  return require(join(ROOT, ".dependency-cruiser.cjs")) as IConfiguration;
}

/** The roots `pnpm depcruise` cruises, read from its package.json script. */
function depcruiseRoots(): string[] {
  const packageJson = JSON.parse(read("package.json")) as { scripts?: Record<string, string> };
  const script = packageJson.scripts?.depcruise ?? "";
  const words = script.split(/\s+/).filter(Boolean);
  const configFlag = words.indexOf("--config");
  const roots = words.slice(1, configFlag === -1 ? undefined : configFlag);
  expect(roots.length).toBeGreaterThan(0);
  return roots;
}

/**
 * Builds a fixture tree: one importer file per distinct `from` (importing
 * every specifier the rows give it), a stub target file for every `@/`
 * specifier so dependency-cruiser can resolve it and match rules against the
 * resolved path, not the bare alias, and a stub `@prisma/client` package under
 * node_modules.
 */
function buildCruiseFixture(rows: ImportRow[]): string {
  const dir = makeTempDir("layout-cruise-");
  writeFixtureFile(
    dir,
    "tsconfig.json",
    JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./*"] } } }, null, 2),
  );
  writeFixtureFile(
    dir,
    `${PRISMA_PACKAGE_DIR}/package.json`,
    JSON.stringify({ name: "@prisma/client", main: "index.js", types: "index.d.ts" }, null, 2),
  );
  writeFixtureFile(dir, `${PRISMA_PACKAGE_DIR}/index.js`, "module.exports = {};\n");
  writeFixtureFile(dir, `${PRISMA_PACKAGE_DIR}/index.d.ts`, "export type Stub = string;\n");

  const importsByFile = new Map<string, ImportRow[]>();
  for (const row of rows) {
    const fileRows = importsByFile.get(row.from) ?? [];
    fileRows.push(row);
    importsByFile.set(row.from, fileRows);
  }
  for (const [from, fileRows] of importsByFile) {
    const lines = fileRows
      .map((row) =>
        row.typeOnly
          ? `import type { Stub } from "${row.specifier}";\nexport type Uses${fileRows.indexOf(row)} = Stub;`
          : `import "${row.specifier}";`,
      )
      .join("\n");
    writeFixtureFile(dir, from, `${lines}\nexport {};\n`);
  }

  const targets = new Set(rows.filter((row) => !isBarePackage(row.specifier)).map(targetPath));
  for (const target of targets) {
    if (!existsSync(join(dir, target))) {
      writeFixtureFile(dir, target, "export type Stub = string;\nexport {};\n");
    }
  }

  return dir;
}

/**
 * Cruises `sources` under `dir` (a fixture tree, or ROOT for the real tree)
 * with the committed config: its rules and its options (tsPreCompilationDeps,
 * doNotFollow, exclude, includeOnly…), with `dir`'s own tsconfig.json.
 */
async function cruiseTree(
  dir: string,
  config: IConfiguration,
  sources: string[],
): Promise<CruiseOutcome> {
  const tsConfigFileName = join(dir, "tsconfig.json");
  const parsedTsConfig = extractTSConfig(tsConfigFileName);
  const result = await cruise(
    sources,
    {
      ...config.options,
      validate: true,
      ruleSet: { forbidden: config.forbidden },
      tsConfig: { fileName: tsConfigFileName },
      baseDir: dir,
    },
    undefined,
    { tsConfig: parsedTsConfig },
  );

  const output = result.output;
  if (typeof output === "string") {
    throw new Error(`dependency-cruiser returned a string instead of a cruise result: ${output}`);
  }
  return { violations: output.summary.violations, modules: output.modules };
}

/** A violation is reported for exactly the (from, to) pair a row names — not merely the same `from`, since several rows share an importer with different verdicts. */
function assertRows(rows: ImportRow[], violations: IViolation[]): void {
  for (const row of rows) {
    const matchesTarget = isBarePackage(row.specifier)
      ? (to: string) => to.startsWith(`${PRISMA_PACKAGE_DIR}/`)
      : (to: string) => to === targetPath(row);
    const reported = violations.some(
      (violation) => violation.from === row.from && matchesTarget(violation.to),
    );
    expect(reported, `${row.from} -> ${row.specifier} expected ${row.verdict}`).toBe(
      row.verdict === "reported",
    );
  }
}

function isCycleViolation(violation: IViolation): boolean {
  return violation.type === "cycle" || /circular/i.test(violation.rule.name);
}

// --- LAYOUT-9 helpers ----------------------------------------------------------

interface FileSnapshot {
  file: string;
  content: string;
  mtimeMs: number;
}

/** A temp directory holding a copy of the committed plopfile and the spec template. */
function makePlopFixture(prefix: string): { dir: string; plopfilePath: string } {
  const dir = makeTempDir(prefix);
  mkdirSync(join(dir, "docs", "specs"), { recursive: true });
  copyFileSync(join(ROOT, "docs/specs/_template.md"), join(dir, "docs/specs/_template.md"));
  const plopfilePath = join(dir, "plopfile.mjs");
  copyFileSync(join(ROOT, "plopfile.mjs"), plopfilePath);
  return { dir, plopfilePath };
}

function snapshotFiles(dir: string, files: string[]): FileSnapshot[] {
  return files.map((file) => {
    const full = join(dir, file);
    return { file, content: readFileSync(full, "utf8"), mtimeMs: statSync(full).mtimeMs };
  });
}
