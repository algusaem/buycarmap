import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { trackedFiles } from "./git-files.mjs";

// Exercised against a throwaway repository, never this one — a real `git
// ls-files`, but on a fixture, not the user's own repo state.

let repo: string;

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "git-files-"));
  const run = (...args: string[]) => execFileSync("git", args, { cwd: repo });
  run("init", "-q");
  run("config", "user.email", "guard@example.test");
  run("config", "user.name", "Guard");
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe("trackedFiles", () => {
  it("lists every path git tracks, and nothing untracked", () => {
    writeFileSync(join(repo, "a.ts"), "export {};");
    writeFileSync(join(repo, "b.ts"), "export {};");
    writeFileSync(join(repo, "untracked.ts"), "export {};");
    execFileSync("git", ["add", "a.ts", "b.ts"], { cwd: repo });

    expect(trackedFiles(repo).sort()).toEqual(["a.ts", "b.ts"]);
  });

  it("returns an empty array for a repository with nothing tracked yet", () => {
    expect(trackedFiles(repo)).toEqual([]);
  });

  it("lists a path with a space in its name, which -z/null-splitting is for", () => {
    writeFileSync(join(repo, "a file.ts"), "export {};");
    execFileSync("git", ["add", "a file.ts"], { cwd: repo });

    expect(trackedFiles(repo)).toEqual(["a file.ts"]);
  });
});
