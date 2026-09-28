// Shared by docs-check.mjs and todo-check.mjs, which each apply their own
// filters on top of the raw tracked-file list. Kept dependency-free, like the
// scripts that import it, so it runs in a fresh worktree with no node_modules.

import { execFileSync } from "node:child_process";

/**
 * Every path tracked by git, as `git ls-files` records it.
 *
 * `-z`/null-separated and split on `\0` rather than newlines, so a tracked
 * path with unusual characters cannot be misparsed the way a newline-split
 * listing could.
 *
 * @returns {string[]}
 */
export function trackedFiles() {
  const output = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" });
  return output.split("\0").filter(Boolean);
}
