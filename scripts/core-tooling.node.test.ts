import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// The verification contract and the repository tooling are files and settings
// in the repository; these tests read them. See docs/specs/core-tooling.md.

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (path: string) => readFileSync(join(ROOT, path), "utf8").replace(/\r\n/g, "\n");
const exists = (path: string) => existsSync(join(ROOT, path));

interface PackageJson {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  packageManager?: string;
  engines?: Record<string, string>;
  typeCoverage?: { atLeast?: number };
  "lint-staged"?: Record<string, string | string[]>;
}
const pkg = (): PackageJson => JSON.parse(read("package.json"));
const scripts = () => pkg().scripts ?? {};
const workflows = () =>
  readdirSync(join(ROOT, ".github/workflows")).map((name) => read(`.github/workflows/${name}`));

describe("verification contract and repository tooling", () => {
  it("TOOLING-1: the STACK.md §5 scripts exist and check / check:full run in order", () => {
    const s = scripts();
    const required = [
      "lint",
      "typecheck",
      "test",
      "test:unit",
      "test:integration",
      "test:e2e",
      "build",
      "check",
      "check:full",
    ];

    expect(required.filter((name) => !s[name])).toEqual([]);
    expect(s.check).toBe("pnpm lint && pnpm typecheck && pnpm test && pnpm build");
    expect(s["check:full"]).toBe("pnpm check && pnpm test:e2e");
  });

  it("TOOLING-2: lint, typecheck and test do what the contract says", () => {
    const s = scripts();

    for (const step of [
      "biome check",
      "knip",
      "pnpm spec:check",
      "pnpm docs:check",
      "pnpm todo:check",
    ]) {
      expect(s.lint).toContain(step);
    }
    expect(s["todo:check"]).toBe("node scripts/todo-check.mjs");
    expect(s.typecheck).toContain("tsc --noEmit");
    expect(s.typecheck).toContain("type-coverage");
    expect(s.test).toContain("--coverage");
    expect(read("vitest.config.ts")).toMatch(
      /thresholds:\s*\{[^}]*statements:\s*\d+[^}]*branches:\s*\d+[^}]*functions:\s*\d+[^}]*lines:\s*\d+/,
    );
  });

  it("TOOLING-3: ESLint is gone and biome.json bans any, console.log and empty blocks and caps complexity", () => {
    const deps = { ...pkg().dependencies, ...pkg().devDependencies };
    const eslintDeps = Object.keys(deps).filter((name) => name.includes("eslint"));
    const eslintConfigs = readdirSync(ROOT).filter((name) => name.startsWith("eslint.config."));
    const biome = exists("biome.json") ? read("biome.json") : "";

    expect(eslintDeps).toEqual([]);
    expect(eslintConfigs).toEqual([]);
    expect(biome).toMatch(/"noExplicitAny":\s*"error"/);
    expect(biome).toMatch(/"noConsole":\s*\{[^}]*"level":\s*"error"/);
    expect(biome).toMatch(/"noEmptyBlockStatements":\s*"error"/);
    expect(biome).toMatch(/"noExcessiveCognitiveComplexity":\s*\{[^}]*"level":\s*"error"/);
  });

  it("TOOLING-4: type-coverage holds no lower than the coverage measured when it was added", () => {
    const atLeast = pkg().typeCoverage?.atLeast ?? 0;

    expect(atLeast).toBeGreaterThanOrEqual(99.3);
    expect(atLeast).toBeLessThanOrEqual(100);
  });

  it("TOOLING-5: knip runs in lint and the dead mock listings are gone", () => {
    expect(scripts().lint).toContain("knip");
    expect(exists("lib/mock/listings.ts")).toBe(false);
  });

  it("TOOLING-6: Husky runs lint-staged, related unit tests and gitleaks, and commitlint", () => {
    const preCommit = exists(".husky/pre-commit") ? read(".husky/pre-commit") : "";
    const commitMsg = exists(".husky/commit-msg") ? read(".husky/commit-msg") : "";
    const staged = JSON.stringify(pkg()["lint-staged"] ?? {});

    expect(preCommit).toContain("lint-staged");
    expect(preCommit).toContain("vitest related --run --project unit");
    expect(preCommit).toContain("gitleaks");
    expect(commitMsg).toContain("commitlint");
    expect(staged).toContain("biome");
    expect(exists("commitlint.config.mjs")).toBe(true);
  });

  it("TOOLING-7: pnpm and Node are pinned and CI runs on the pinned Node", () => {
    const p = pkg();
    const nvmrc = exists(".nvmrc") ? read(".nvmrc").trim() : "";
    const countOf = (text: string, needle: string) => text.split(needle).length - 1;

    expect(p.packageManager ?? "").toMatch(/^pnpm@11\.\d+\.\d+$/);
    expect(p.engines?.node).toBe(">=22.18.0");
    expect(nvmrc).toMatch(/^22\.(1[89]|[2-9]\d)\.\d+$/);
    for (const text of workflows()) {
      expect(countOf(text, "actions/setup-node")).toBe(countOf(text, "node-version-file: .nvmrc"));
    }
    expect(workflows().some((text) => text.includes("actions/setup-node"))).toBe(true);
  });

  it("TOOLING-8: the PR workflow runs pnpm check, gitleaks and the title check; the nightly contract job stays", () => {
    const all = workflows().join("\n");
    const testWorkflow = read(".github/workflows/test.yml");

    // Two-space job keys (`  check:`, `  gitleaks:`, …) split the YAML into
    // per-job text without a YAML dependency.
    const jobHeader = /^ {2}[a-z-]+:$/gm;
    const headers = [...testWorkflow.matchAll(jobHeader)].map((m) => m[0].trim());
    const bodies = testWorkflow.split(jobHeader).slice(1);
    const jobs = new Map(headers.map((header, i) => [header, bodies[i]]));

    expect(testWorkflow).toMatch(/^on:/m);
    expect(testWorkflow).toContain("pull_request");

    const checkJob = jobs.get("check:") ?? "";
    const gitleaksJob = jobs.get("gitleaks:") ?? "";
    expect(checkJob).toContain("pnpm check");
    expect(gitleaksJob).toContain("gitleaks/gitleaks-action");
    expect(checkJob).not.toContain("github.event_name == 'schedule'");
    expect(gitleaksJob).not.toContain("github.event_name == 'schedule'");

    const prTitleWorkflow = workflows().find(
      (text) =>
        text.includes("amannn/action-semantic-pull-request") && text.includes("pull_request"),
    );
    expect(prTitleWorkflow).toBeDefined();

    expect(all).toContain("pnpm test:contract:live");
    expect(all).toMatch(/cron: "0 4 \* \* \*"/);
  });

  it("TOOLING-9: PR template, CODEOWNERS, Renovate and release-please are in place", () => {
    const template = exists(".github/pull_request_template.md")
      ? read(".github/pull_request_template.md")
      : "";
    const headings = [...template.matchAll(/^## (.+)$/gm)].map(([, heading]) => heading);

    expect(headings).toEqual([
      "Description",
      "Main changes",
      "Impact",
      "Tests",
      "Validation",
      "Decisions and open questions",
      "Checklist",
    ]);
    expect(exists(".github/CODEOWNERS")).toBe(true);
    expect(exists("renovate.json")).toBe(true);
    expect(exists("release-please-config.json")).toBe(true);
    expect(exists(".release-please-manifest.json")).toBe(true);
    expect(workflows().join("\n")).toContain("googleapis/release-please-action");
  });

  it("TOOLING-10: TODO.md is gone", () => {
    expect(exists("TODO.md")).toBe(false);
  });

  it("TOOLING-11: no script, workflow or hook skips the hooks", () => {
    const sources = [JSON.stringify(scripts()), ...workflows()];
    for (const hook of ["pre-commit", "commit-msg"]) {
      if (exists(`.husky/${hook}`)) sources.push(read(`.husky/${hook}`));
    }
    const skipping = sources.filter((text) => /--no-verify|HUSKY=0/.test(text));

    expect(sources.length).toBeGreaterThan(1);
    expect(skipping).toEqual([]);
  });
});
