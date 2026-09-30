import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  checkBranchDatabase,
  findMainCheckout,
  hookCommand,
  hookMain,
  main,
  touchesDatabase,
} from "./require-branch-db.mjs";

const SHARED = "postgresql://postgres:postgres@localhost:5433/buycarmap";
const BRANCH = "postgresql://postgres:postgres@localhost:5433/buycarmap_feature_x";

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

// TEST-3 (docs/specs/core-testing.md), worked examples: a worktree's
// DATABASE_URL pointing anywhere but localhost/127.0.0.1 must be refused, so a
// worktree can never touch Neon and so production.
describe("checkBranchDatabase refuses a non-local host", () => {
  const LOCAL = "postgresql://postgres:postgres@localhost:5433/buycarmap_x";
  const NEON = "postgresql://u:p@ep-dawn-recipe.c-2.eu-central-1.aws.neon.tech/neondb";

  it("TEST-3: allows a worktree whose DATABASE_URL is localhost", () => {
    expect(checkBranchDatabase(LOCAL, undefined, true)).toBeNull();
  });

  it("TEST-3: refuses a worktree whose DATABASE_URL is a Neon host, naming the host", () => {
    // .toEqual(expect.stringMatching(...)) rather than .toMatch(...): the
    // unimplemented check still returns null here, and .toMatch() throws a
    // TypeError on a non-string instead of failing the assertion cleanly.
    expect(checkBranchDatabase(NEON, undefined, true)).toEqual(
      expect.stringMatching(/ep-dawn-recipe\.c-2\.eu-central-1\.aws\.neon\.tech/),
    );
  });

  it("TEST-3: refuses a worktree whose DATABASE_URL is 127.0.0.1's neighbour, not 127.0.0.1 itself", () => {
    const almostLocal = "postgresql://postgres:postgres@127.0.0.2:5433/buycarmap_x";
    expect(checkBranchDatabase(almostLocal, undefined, true)).toEqual(
      expect.stringMatching(/127\.0\.0\.2/),
    );
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
    if (!main) throw new Error("expected findMainCheckout to locate the main checkout");
    expect(resolve(main).toLowerCase()).toBe(resolve(repo).toLowerCase());
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

// TEST-3: `main`, with `findMain`/`readUrl`/`error`/`exit` injected so the
// branch can be exercised without a real git worktree or a real `.env`.
describe("main", () => {
  it("TEST-3: with the real readDatabaseUrl, reads a worktree's own .env rather than a fake", () => {
    // The one test in this describe block that leaves `readUrl` at its real
    // default, so `readDatabaseUrl` itself — join(dir, ".env"), existsSync,
    // parseEnv(readFileSync(...)) — runs for real against a throwaway
    // directory, never this repository's own .env.
    const dir = mkdtempSync(join(tmpdir(), "require-branch-db-env-"));
    try {
      writeFileSync(
        join(dir, ".env"),
        'DATABASE_URL="postgresql://postgres:postgres@localhost:5433/buycarmap_x"\n',
      );
      const error = vi.fn();
      const exit = vi.fn();

      main({ cwd: dir, findMain: () => "/repo", readUrl: undefined, error, exit });

      // Same value both sides of checkBranchDatabase's comparison would be a
      // pass; here the "main" side differs, so this also proves readUrl was
      // actually called against `dir`, not skipped.
      expect(error).not.toHaveBeenCalled();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("TEST-3: the real readDatabaseUrl reports no .env for a worktree directory that has none", () => {
    const dir = mkdtempSync(join(tmpdir(), "require-branch-db-noenv-"));
    try {
      const error = vi.fn();
      const exit = vi.fn();

      main({ cwd: dir, findMain: () => "/repo", readUrl: undefined, error, exit });

      expect(error.mock.calls[0]?.[0]).toContain("this worktree has no .env");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does nothing when checkBranchDatabase finds no problem (the main checkout)", () => {
    const error = vi.fn();
    const exit = vi.fn();

    main({
      cwd: "/repo",
      findMain: () => null,
      readUrl: () => SHARED,
      error,
      exit,
    });

    expect(error).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  it("TEST-3: reports the problem and exits 1 by default for a worktree with no .env", () => {
    const error = vi.fn();
    const exit = vi.fn();

    main({
      cwd: "/worktree",
      findMain: () => "/repo",
      readUrl: (dir) => (dir === "/worktree" ? undefined : SHARED),
      error,
      exit,
    });

    expect(error.mock.calls[0]?.[0]).toContain("this worktree has no .env");
    expect(error.mock.calls[0]?.[0]).toContain("Run `pnpm db:branch` first");
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("TEST-3: exits with the given exitCode — 2, the hook's blocking-error code", () => {
    const error = vi.fn();
    const exit = vi.fn();

    main({
      exitCode: 2,
      cwd: "/worktree",
      findMain: () => "/repo",
      readUrl: () => undefined,
      error,
      exit,
    });

    expect(exit).toHaveBeenCalledWith(2);
  });
});

describe("hookCommand", () => {
  it("reads tool_input.command out of a well-formed payload", () => {
    expect(hookCommand('{"tool_input":{"command":"pnpm dev"}}')).toBe("pnpm dev");
  });

  it("resolves to an empty string for malformed JSON, rather than throwing", () => {
    expect(hookCommand("not json")).toBe("");
  });

  it("resolves to an empty string when tool_input is absent", () => {
    expect(hookCommand("{}")).toBe("");
  });
});

// hookMain reads a PreToolUse payload from `stdin` (injected — a plain array
// of chunks satisfies `for await`, so no real stdin is needed) and runs
// `runMain` only for a database-touching command.
describe("hookMain", () => {
  it("TEST-3: runs main with exitCode 2 when the command touches the database", async () => {
    const runMain = vi.fn();

    await hookMain({
      stdin: ['{"tool_input":{"command":"pnpm dev"}}'],
      runMain,
    });

    expect(runMain).toHaveBeenCalledWith({ exitCode: 2 });
  });

  it("never calls main for a command that does not touch the database", async () => {
    const runMain = vi.fn();

    await hookMain({
      stdin: ['{"tool_input":{"command":"pnpm test"}}'],
      runMain,
    });

    expect(runMain).not.toHaveBeenCalled();
  });

  it("never calls main when the payload is malformed", async () => {
    const runMain = vi.fn();

    await hookMain({ stdin: ["not json"], runMain });

    expect(runMain).not.toHaveBeenCalled();
  });

  it("reassembles a payload split across several stdin chunks", async () => {
    const runMain = vi.fn();
    const payload = '{"tool_input":{"command":"pnpm dev"}}';

    await hookMain({
      stdin: [payload.slice(0, 10), payload.slice(10)],
      runMain,
    });

    expect(runMain).toHaveBeenCalledWith({ exitCode: 2 });
  });
});
