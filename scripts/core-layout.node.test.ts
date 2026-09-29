import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { SOURCE_ROOTS } from "./docs-check.mjs";

// Reads the working tree directly against docs/specs/core-layout.md (LAYOUT-1..5).
// The move itself is a later change: these tests only prove what the spec
// requires of the *result*, so they fail against today's root `app/` /
// `components/` / `lib/` layout and pass once the move lands.

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (path: string) => readFileSync(join(ROOT, path), "utf8").replace(/\r\n/g, "\n");
const exists = (path: string) => existsSync(join(ROOT, path));
const readIfExists = (path: string) => (exists(path) ? read(path) : "");

interface TsConfigShape {
  compilerOptions?: { paths?: Record<string, string[]> };
}

interface ComponentsJsonShape {
  tailwind?: { css?: string };
}

/** tsconfig.json is allowed `//` line comments; strip them only if a plain parse fails. */
const parseTsConfig = (text: string): TsConfigShape => {
  try {
    return JSON.parse(text);
  } catch {
    return JSON.parse(text.replace(/^\s*\/\/.*$/gm, ""));
  }
};

const parseComponentsJson = (text: string): ComponentsJsonShape => JSON.parse(text);

// The pure merge-logic functions LAYOUT-5 moves out of the hook and into
// src/lib/listings/.
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

describe("source layout", () => {
  it("LAYOUT-1: no tracked file sits under the old root dirs, and the new src/ and tests/ layout exists", () => {
    const trackedOldOutput = execFileSync(
      "git",
      [
        "ls-files",
        "--",
        "app",
        "components",
        "lib",
        "interfaces",
        "types",
        "e2e",
        "test",
        "proxy.ts",
      ],
      { cwd: ROOT, encoding: "utf8" },
    ).trim();
    const trackedOld = trackedOldOutput === "" ? [] : trackedOldOutput.split("\n");
    expect(trackedOld).toEqual([]);

    const expectedPaths = [
      "src/app/page.tsx",
      "src/proxy.ts",
      "tests/e2e/map.spec.ts",
      "src/app",
      "src/components",
      "src/hooks",
      "src/interfaces",
      "src/lib",
      "src/types",
      "tests/contract",
      "tests/fixtures",
      "tests/mocks",
      "tests/msw",
      "tests/types",
      "tests/utils",
      "tests/setup.jsdom.ts",
      "tests/setup.node.ts",
    ];
    const missing = expectedPaths.filter((path) => !exists(path));
    expect(missing).toEqual([]);
  });

  it("LAYOUT-2: @/* resolves to ./src/*, the Prisma client output and components.json point at src/", () => {
    const tsconfig = parseTsConfig(read("tsconfig.json"));
    expect(tsconfig.compilerOptions?.paths?.["@/*"]).toEqual(["./src/*"]);

    expect(read("prisma/schema.prisma")).toMatch(/output\s*=\s*"\.\.\/src\/generated\/prisma"/);

    expect(read(".gitignore").split("\n")).toContain("/src/generated/prisma");

    const componentsJson = parseComponentsJson(read("components.json"));
    expect(componentsJson.tailwind?.css).toBe("src/app/globals.css");
  });

  it("LAYOUT-3: Vitest collects from src/**, Playwright's testDir is tests/e2e, and the thresholds are unchanged", () => {
    const vitestConfig = read("vitest.config.ts");
    expect(vitestConfig).toContain('"src/**"');
    expect(vitestConfig).not.toContain('"app/**"');
    expect(vitestConfig).not.toContain('"lib/**"');
    expect(vitestConfig).not.toContain('"components/**"');

    expect(vitestConfig).toMatch(
      /thresholds:\s*\{[^}]*statements:\s*89[^}]*branches:\s*85[^}]*functions:\s*84[^}]*lines:\s*89/,
    );

    expect(read("playwright.config.ts")).toContain('testDir: "./tests/e2e"');
  });

  it("LAYOUT-4: docs-check's source roots are .claude, .github, prisma, scripts, src and tests", () => {
    expect([...SOURCE_ROOTS].sort()).toEqual([
      ".claude",
      ".github",
      "prisma",
      "scripts",
      "src",
      "tests",
    ]);
  });

  it("LAYOUT-5: the hook holds only the request lifecycle, and imports the merge logic from src/lib/listings/", () => {
    expect(exists("src/hooks/useListingsSearch.ts")).toBe(true);

    const hookSource = readIfExists("src/hooks/useListingsSearch.ts");
    const stillDefined = MERGE_FUNCTION_NAMES.filter((name) => {
      const pattern = new RegExp(`\\bfunction\\s+${name}\\b|\\bconst\\s+${name}\\s*=`);
      return pattern.test(hookSource);
    });
    expect(stillDefined).toEqual([]);

    expect(hookSource).toContain('from "@/lib/listings/');
  });
});
