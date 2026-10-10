import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// docs/specs/core-frontend.md, FRONT-5, FRONT-7, FRONT-11 (static half),
// FRONT-15, FRONT-16, FRONT-17, FRONT-18, FRONT-19 (static half) and FRONT-21.
// Dependency-free, like every other scripts/*.node.test.ts (docs/ARCHITECTURE.md
// › Directory map: "scripts/ … dependency-free except the to-do check").

const ROOT = join(__dirname, "..");
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "app/generated"]);
const TEST_FILE = /\.(test|node\.test|integration\.test)\.[tj]sx?$/;

function walk(dir: string, exts: string[]): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }

  return entries.flatMap((entry) => {
    if (SKIP_DIRS.has(entry) || entry.startsWith(".")) return [];
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) return walk(full, exts);
    if (!exts.some((ext) => entry.endsWith(ext))) return [];
    if (TEST_FILE.test(entry)) return [];
    return [full];
  });
}

function rel(files: string[]): string[] {
  return files.map((file) => relative(ROOT, file).replace(/\\/g, "/")).sort();
}

describe("FRONT-5: the proxy routes and their browser-bound fetchers are removed", () => {
  it("FRONT-5: the five proxy route directories no longer exist", () => {
    const dirs = [
      "app/api/wallapop/search",
      "app/api/wallapop/filters/models",
      "app/api/cochesnet/search",
      "app/api/cochesnet/models",
      "app/api/milanuncios/search",
    ];
    const stillPresent = dirs.filter((dir) => existsSync(join(ROOT, dir)));

    expect(stillPresent).toEqual([]);
  });

  it("FRONT-5: no file under lib/ or components/ references a proxy path", () => {
    const files = [
      ...walk(join(ROOT, "lib"), [".ts", ".tsx"]),
      ...walk(join(ROOT, "components"), [".ts", ".tsx"]),
    ];
    const pattern = /\/api\/wallapop|\/api\/cochesnet|\/api\/milanuncios/;
    const offenders = files.filter((file) => pattern.test(readFileSync(file, "utf-8")));

    expect(rel(offenders)).toEqual([]);
  });
});

describe("FRONT-22: no e2e file routes the deleted search proxies", () => {
  it("FRONT-22: no e2e file routes the deleted search proxies", () => {
    const files = walk(join(ROOT, "e2e"), [".ts", ".tsx"]);
    const pattern = /\/api\/wallapop|\/api\/cochesnet|\/api\/milanuncios/;
    const offenders = files.filter((file) => pattern.test(readFileSync(file, "utf-8")));

    expect(rel(offenders)).toEqual([]);
  });
});

describe("FRONT-25: no webServer entry reuses an existing server", () => {
  it("FRONT-25: reuseExistingServer is false on both webServer entries, and E2E_PORT/E2E_UPSTREAM_PORT still move the ports", () => {
    const content = readFileSync(join(ROOT, "playwright.config.ts"), "utf-8");
    const matches = [...content.matchAll(/reuseExistingServer:\s*([^,\n]+)/g)];

    expect(matches.length).toBe(2);
    expect(matches.every(([, value]) => value.trim() === "false")).toBe(true);
    expect(content).toContain("process.env.E2E_PORT");
    expect(content).toContain("process.env.E2E_UPSTREAM_PORT");
  });
});

describe("FRONT-7: Nominatim keeps calling the browser directly", () => {
  it("FRONT-7: lib/geo/nominatim.ts still calls nominatim.openstreetmap.org", () => {
    const content = readFileSync(join(ROOT, "lib/geo/nominatim.ts"), "utf-8");

    expect(content).toContain("nominatim.openstreetmap.org");
  });

  it("FRONT-7: an ADR 0016 exists and mentions Nominatim", () => {
    const adrFiles = readdirSync(join(ROOT, "docs/decisions")).filter((f) => f.startsWith("0016-"));

    expect(adrFiles.length).toBe(1);
    const content = readFileSync(join(ROOT, "docs/decisions", adrFiles[0]), "utf-8");
    expect(content).toMatch(/Nominatim/);
  });
});

describe("FRONT-11: no inline formatting in components/ or app/", () => {
  it("FRONT-11: no toLocaleString, toFixed, new Intl. or a date-fns format import", () => {
    const files = [
      ...walk(join(ROOT, "components"), [".ts", ".tsx"]),
      ...walk(join(ROOT, "app"), [".ts", ".tsx"]),
    ];
    const pattern = /toLocaleString\(|\.toFixed\(|new Intl\.|from ["']date-fns["']/;
    const offenders = files.filter((file) => pattern.test(readFileSync(file, "utf-8")));

    expect(rel(offenders)).toEqual([]);
  });
});

describe("FRONT-15: a failed read is never a toast in lib/hooks/", () => {
  it("FRONT-15: no toast.error inside lib/hooks/", () => {
    const files = walk(join(ROOT, "lib/hooks"), [".ts", ".tsx"]);
    const offenders = files.filter((file) => readFileSync(file, "utf-8").includes("toast.error"));

    expect(rel(offenders)).toEqual([]);
  });
});

describe("FRONT-16: Impeccable set up per STACK.md §17 steps 1-8", () => {
  it("FRONT-16: impeccable@4.1.0 is pinned in devDependencies", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8")) as {
      devDependencies?: Record<string, string>;
    };

    expect(pkg.devDependencies?.impeccable).toBe("4.1.0");
  });

  it("FRONT-16: the skill's VERSION file exists at .claude/skills/impeccable/scripts/VERSION", () => {
    const versionPath = join(ROOT, ".claude/skills/impeccable/scripts/VERSION");
    expect(existsSync(versionPath)).toBe(true);

    // STACK.md §17 step 8: the skill's engine (this VERSION file) must match
    // the engine the installed npm package was built against, recorded in
    // node_modules/impeccable/package.json's optionalDependencies under the
    // platform-specific "@impeccable/cli-*" key (all platforms pin the same
    // engine version).
    const skillVersion = readFileSync(versionPath, "utf-8").trim();
    const impeccablePkg = JSON.parse(
      readFileSync(join(ROOT, "node_modules/impeccable/package.json"), "utf-8"),
    ) as { optionalDependencies?: Record<string, string> };
    const cliEntry = Object.entries(impeccablePkg.optionalDependencies ?? {}).find(([name]) =>
      name.startsWith("@impeccable/cli-"),
    );

    expect(cliEntry, "no @impeccable/cli-* entry found in optionalDependencies").toBeTruthy();
    expect(skillVersion).toBe(cliEntry?.[1]);
  });

  it("FRONT-16: .claude/settings.json keeps require-branch-db.mjs and also runs Impeccable's hook", () => {
    const content = readFileSync(join(ROOT, ".claude/settings.json"), "utf-8");

    expect(content).toContain("require-branch-db.mjs");
    expect(content.toLowerCase()).toContain("impeccable");
  });

  it("FRONT-16: .gitignore ignores .impeccable/critique/", () => {
    const content = readFileSync(join(ROOT, ".gitignore"), "utf-8");

    expect(content).toContain(".impeccable/critique/");
  });

  it("FRONT-16: .impeccable/config.json matches STACK.md §17 step 6", () => {
    const configPath = join(ROOT, ".impeccable/config.json");
    expect(existsSync(configPath)).toBe(true);

    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(config).toEqual({
      buildPath: "code",
      detector: { designSystem: { enabled: true } },
      hook: { enabled: true, quiet: false },
    });
  });

  it("FRONT-16: the lint script runs impeccable detect over app, components and lib", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8")) as {
      scripts?: Record<string, string>;
    };

    expect(pkg.scripts?.lint ?? "").toContain("impeccable detect app components lib");
  });
});

describe("FRONT-17: product and design context exist at the root", () => {
  it("FRONT-17: PRODUCT.md exists and is non-empty", () => {
    const path = join(ROOT, "PRODUCT.md");
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path, "utf-8").trim().length).toBeGreaterThan(0);
  });

  it("FRONT-17: DESIGN.md exists and is non-empty", () => {
    const path = join(ROOT, "DESIGN.md");
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path, "utf-8").trim().length).toBeGreaterThan(0);
  });
});

describe("FRONT-18: the detector reports zero findings", () => {
  it("FRONT-18: `pnpm exec impeccable detect app components lib` exits 0", () => {
    // Currently fails because the package is not installed (FRONT-16) —
    // a structural failure, not a findings count to fix here.
    const result = spawnSync("pnpm", ["exec", "impeccable", "detect", "app", "components", "lib"], {
      cwd: ROOT,
      shell: true,
      encoding: "utf-8",
      timeout: 60_000,
    });

    expect(result.status).toBe(0);
  });
});

describe("FRONT-19: the a11y gate no longer disables color-contrast", () => {
  it("FRONT-19: e2e/a11y.spec.ts no longer contains color-contrast", () => {
    const content = readFileSync(join(ROOT, "e2e/a11y.spec.ts"), "utf-8");

    expect(content).not.toContain("color-contrast");
  });
});

describe("FRONT-26: fonts are self-hosted files loaded with next/font/local", () => {
  it("FRONT-26: app/layout.tsx imports next/font/local, not next/font/google, and keeps --font-sans/--font-mono", () => {
    const content = readFileSync(join(ROOT, "app/layout.tsx"), "utf-8");

    expect(content).not.toContain("next/font/google");
    expect(content).toContain("next/font/local");
    expect(content).toContain("--font-sans");
    expect(content).toContain("--font-mono");
  });

  it("FRONT-26: both font families ship their woff2 file and OFL licence under app/fonts/", () => {
    const files = [
      "app/fonts/plus-jakarta-sans/plus-jakarta-sans-latin-wght-normal.woff2",
      "app/fonts/plus-jakarta-sans/OFL.txt",
      "app/fonts/jetbrains-mono/jetbrains-mono-latin-wght-normal.woff2",
      "app/fonts/jetbrains-mono/OFL.txt",
    ];

    for (const file of files) {
      expect(existsSync(join(ROOT, file)), `${file} is missing`).toBe(true);
    }
  });

  it("FRONT-26: each woff2 file is non-empty and starts with the wOF2 magic bytes", () => {
    const woff2Files = [
      "app/fonts/plus-jakarta-sans/plus-jakarta-sans-latin-wght-normal.woff2",
      "app/fonts/jetbrains-mono/jetbrains-mono-latin-wght-normal.woff2",
    ];

    for (const file of woff2Files) {
      const buffer = readFileSync(join(ROOT, file));
      expect(buffer.length, `${file} is empty`).toBeGreaterThan(0);
      expect(buffer.subarray(0, 4).toString("ascii"), `${file} does not start with wOF2`).toBe(
        "wOF2",
      );
    }
  });
});

describe("FRONT-21: docs reflect the new flow", () => {
  it("FRONT-21: ADR 0016 exists (search action, deleted proxies, Nominatim, cookie locale)", () => {
    const adrFiles = readdirSync(join(ROOT, "docs/decisions")).filter((f) => f.startsWith("0016-"));

    expect(adrFiles.length).toBe(1);
  });

  it("FRONT-21: ADR 0001 is marked superseded", () => {
    const content = readFileSync(
      join(ROOT, "docs/decisions/0001-no-data-fetching-library.md"),
      "utf-8",
    );
    expect(content).toContain("Superseded");
  });

  it("FRONT-21: ADR 0003 is marked superseded", () => {
    const content = readFileSync(join(ROOT, "docs/decisions/0003-proxy-routes.md"), "utf-8");
    expect(content).toContain("Superseded");
  });

  it("FRONT-21: ADR 0007 rows 19, 20, 21 and 28 end 'Resolved in phase 9'", () => {
    const content = readFileSync(join(ROOT, "docs/decisions/0007-adopt-core-rules.md"), "utf-8");
    const lines = content.split("\n");

    for (const rowId of ["19", "20", "21", "28"]) {
      const row = lines.find((line) => line.trim().startsWith(`| ${rowId} |`));
      expect(row, `row ${rowId} not found in ADR 0007`).toBeTruthy();

      const cells = (row ?? "").split("|");
      // A Markdown table row split on "|" has a leading and a trailing empty
      // element from the row's own leading/trailing pipe; the last real cell
      // is the one before that trailing empty.
      const lastCell = cells[cells.length - 2]?.trim();
      expect(lastCell).toBe("Resolved in phase 9");
    }
  });

  it("FRONT-21: CLAUDE.md no longer describes browser proxies as 'app/api/<source>/'", () => {
    const content = readFileSync(join(ROOT, "CLAUDE.md"), "utf-8");
    expect(content).not.toContain("app/api/<source>/");
  });

  it("FRONT-21: docs/specs/data-sources.md points at server/search/service.ts", () => {
    const content = readFileSync(join(ROOT, "docs/specs/data-sources.md"), "utf-8");
    expect(content).toContain("server/search/service.ts");
  });
});
