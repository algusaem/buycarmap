import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as guard from "./require-branch-db.mjs";

const { checkBranchDatabase, findMainCheckout, touchesDatabase } = guard as unknown as {
  checkBranchDatabase: (
    worktreeUrl: string | undefined,
    mainUrl: string | undefined,
    isWorktree: boolean,
  ) => string | null;
  findMainCheckout: (cwd?: string) => string | null;
  touchesDatabase: (command: string) => boolean;
};

const SHARED = "postgresql://user:pw@ep-shared.neon.tech/neondb";
const BRANCH = "postgresql://user:pw@ep-branch.neon.tech/neondb";

describe("checkBranchDatabase", () => {
  it("lets the main checkout through — it owns the shared database", () => {
    expect(checkBranchDatabase(SHARED, SHARED, false)).toBeNull();
  });

  it("blocks a worktree that has no .env at all", () => {
    // The state a freshly created worktree is in, which is exactly when the
    // temptation to just run prisma is highest.
    expect(checkBranchDatabase(undefined, SHARED, true)).toMatch(/no \.env/);
  });

  it("blocks a worktree still pointing at the main database", () => {
    expect(checkBranchDatabase(SHARED, SHARED, true)).toMatch(/points at the main checkout/);
  });

  it("lets a worktree with its own database through", () => {
    expect(checkBranchDatabase(BRANCH, SHARED, true)).toBeNull();
  });

  it("lets a worktree through when the main checkout has no .env to compare", () => {
    // Nothing to compare against is not evidence of a problem, and failing
    // closed here would block a checkout that is set up correctly.
    expect(checkBranchDatabase(BRANCH, undefined, true)).toBeNull();
  });
});

describe("findMainCheckout", () => {
  // Both branches are exercised against a throwaway repository rather than the
  // checkout the suite happens to be running from: asserting "this is a
  // worktree" only holds when the tests were started from one, which is not
  // true on the main checkout or in CI.
  let repo: string;
  let worktree: string;

  beforeAll(() => {
    repo = realpathSync(mkdtempSync(join(tmpdir(), "guard-repo-")));
    worktree = join(repo, "..", `${basename(repo)}-wt`);
    const run = (...args: string[]) => execFileSync("git", args, { cwd: repo });
    run("init", "-q");
    run("config", "user.email", "guard@example.test");
    run("config", "user.name", "Guard");
    run("commit", "-q", "--allow-empty", "-m", "init");
    run("worktree", "add", "-q", "--detach", worktree);
  });

  afterAll(() => {
    execFileSync("git", ["worktree", "remove", "--force", worktree], {
      cwd: repo,
    });
    rmSync(repo, { recursive: true, force: true });
  });

  it("locates the main checkout from inside a linked worktree", () => {
    // If this returned null the guard would skip its check entirely, which is
    // exactly the worktree case it exists to catch.
    const main = findMainCheckout(worktree);

    expect(main).not.toBeNull();
    expect(resolve(main!).toLowerCase()).toBe(resolve(repo).toLowerCase());
  });

  it("returns null from the main checkout, which owns the shared database", () => {
    expect(findMainCheckout(repo)).toBeNull();
  });
});

describe("touchesDatabase", () => {
  it.each([
    "pnpm exec prisma migrate dev",
    "npx prisma migrate deploy",
    "npx prisma studio",
    "pnpm dev",
    "npm run dev",
    "next dev --turbo",
  ])("recognises %s as reaching the database", (command) => {
    expect(touchesDatabase(command)).toBe(true);
  });

  it("does not fire on prisma generate, which never opens a connection", () => {
    // A guard that blocks safe commands is a guard people learn to bypass.
    expect(touchesDatabase("npx prisma generate")).toBe(false);
    expect(touchesDatabase("pnpm build")).toBe(false);
  });

  it.each(["ls -la", "pnpm db:branch", "pnpm test", "git status", ""])(
    "leaves %s alone",
    (command) => {
      // db:branch especially: blocking the fix for the problem would deadlock.
      expect(touchesDatabase(command)).toBe(false);
    },
  );
});
