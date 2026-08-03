import { describe, expect, it } from "vitest";

import * as guard from "./require-branch-db.mjs";

const { checkBranchDatabase, findMainCheckout, touchesDatabase } =
  guard as unknown as {
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
    expect(checkBranchDatabase(SHARED, SHARED, true)).toMatch(
      /points at the main checkout/,
    );
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
  it("identifies this worktree as a worktree and locates the main checkout", () => {
    // This test file runs from inside a linked worktree, so the guard has to
    // recognise that; if it returned null the whole check would be skipped.
    const main = findMainCheckout();

    expect(main).not.toBeNull();
    expect(main?.toLowerCase()).toContain("buycarmap");
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
