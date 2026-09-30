// Shared by docs-check.mjs and todo-check.mjs, which each apply their own
// filters on top of the raw tracked-file list. Has no dependencies of its own,
// so it runs in a fresh worktree with no node_modules.

import { execFileSync } from "node:child_process";

/**
 * Every path tracked by git, as `git ls-files` records it.
 *
 * `-z`/null-separated and split on `\0` rather than newlines, so a tracked
 * path with unusual characters cannot be misparsed the way a newline-split
 * listing could.
 *
 * @param {string} [cwd] The repository to list — defaults to the process's
 *   own working directory, as every real caller (docs-check.mjs,
 *   todo-check.mjs) relies on. Overridable so the colocated test can point it
 *   at a throwaway repository instead of this one.
 * @returns {string[]}
 */
export function trackedFiles(cwd = process.cwd()) {
  const output = execFileSync("git", ["ls-files", "-z"], { cwd, encoding: "utf8" });
  return output.split("\0").filter(Boolean);
}
