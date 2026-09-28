import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Exercises scripts/todo-check.mjs as `pnpm todo:check` actually runs it — a
// child process over a real git repository — rather than only its exported
// `findUnreferencedTodos`. See docs/specs/core-tooling.md TOOLING-12 for the
// worked examples this pins.

// Built from parts so this file doesn't trip the check it tests.
const TAG = ["TO", "DO"].join("");

const SCRIPT = resolve(fileURLToPath(import.meta.url), "..", "todo-check.mjs");

let repo: string;

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "todo-check-cli-"));
  const run = (...args: string[]) => spawnSync("git", args, { cwd: repo });
  run("init", "-q");
  run("config", "user.email", "guard@example.test");
  run("config", "user.name", "Guard");
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe("todo:check CLI", () => {
  it("TOOLING-12: exits 1 and reports the unreferenced marker", () => {
    writeFileSync(join(repo, "a.ts"), `// ${TAG}: x`);
    spawnSync("git", ["add", "a.ts"], { cwd: repo });

    const result = spawnSync("node", [SCRIPT], { cwd: repo, encoding: "utf8" });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("a.ts:1  TODO without an issue reference");
  });

  it("TOOLING-12: exits 0 and reports the scanned file count with an issue reference", () => {
    writeFileSync(join(repo, "a.ts"), `// ${TAG}(#1): x`);
    spawnSync("git", ["add", "a.ts"], { cwd: repo });

    const result = spawnSync("node", [SCRIPT], { cwd: repo, encoding: "utf8" });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("todo:check passed - 1 file(s) scanned.");
  });
});
