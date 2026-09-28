// Refuses to let a command run against the shared dev database from a worktree.
//
// `pnpm db:branch` exists because worktrees sharing one Neon database is what
// makes `prisma migrate dev` demand a destructive reset (see CLAUDE.md). But a
// script you have to remember to run is a script that gets forgotten — and the
// cost of forgetting is an offer to wipe a database holding real accounts.
// This turns the convention into a precondition.
//
// Kept dependency-free and separate from db-branch.mjs so it can run in a fresh
// worktree that has no node_modules, and so the rule lives in the repository
// rather than only in local tooling config.

import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseEnv } from "./db-branch.mjs";

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

/**
 * The main checkout's path, or null when this *is* the main checkout.
 *
 * In a linked worktree `--git-common-dir` points at the main checkout's .git
 * while `--git-dir` points at .git/worktrees/<name>; in the main checkout they
 * agree. Comparing them is how you tell without parsing `git worktree list`.
 *
 * @param {string} [cwd]
 * @returns {string | null}
 */
export function findMainCheckout(cwd = process.cwd()) {
  const gitDir = git(["rev-parse", "--absolute-git-dir"], cwd);
  const commonDir = git(["rev-parse", "--path-format=absolute", "--git-common-dir"], cwd);
  if (gitDir === commonDir) return null;
  return join(commonDir, "..");
}

function readDatabaseUrl(dir) {
  const path = join(dir, ".env");
  if (!existsSync(path)) return undefined;
  return parseEnv(readFileSync(path, "utf8")).DATABASE_URL;
}

/**
 * Whether a shell command would talk to the database.
 *
 * Deliberately narrow. Blocking everything that mentions Prisma would catch
 * `prisma generate`, which only reads schema.prisma and never opens a
 * connection -- and a guard that fires on safe commands is a guard people
 * learn to bypass.
 *
 * @param {string} command
 * @returns {boolean}
 */
export function touchesDatabase(command) {
  if (!command) return false;
  if (/prisma\s+generate/.test(command)) return false;
  return (
    /\bprisma\b/.test(command) ||
    // `run` is optional: npm needs it, pnpm and yarn do not.
    /\b(?:pnpm|npm|yarn)\s+(?:run\s+)?dev\b/.test(command) ||
    /\bnext\s+dev\b/.test(command)
  );
}

/**
 * Returns a refusal message, or null when the command may proceed.
 *
 * Exported so the decision is testable without spawning anything.
 *
 * @param {string | undefined} worktreeUrl
 * @param {string | undefined} mainUrl
 * @param {boolean} isWorktree
 * @returns {string | null}
 */
export function checkBranchDatabase(worktreeUrl, mainUrl, isWorktree) {
  // The main checkout owns the shared database. Only worktrees need their own.
  if (!isWorktree) return null;

  if (!worktreeUrl) {
    return "this worktree has no .env, so DATABASE_URL is unset";
  }
  if (mainUrl && worktreeUrl === mainUrl) {
    return "this worktree's DATABASE_URL still points at the main checkout's database";
  }
  return null;
}

function main(exitCode = 1) {
  const mainCheckout = findMainCheckout();
  const problem = checkBranchDatabase(
    readDatabaseUrl(process.cwd()),
    mainCheckout ? readDatabaseUrl(mainCheckout) : undefined,
    mainCheckout !== null,
  );

  if (!problem) return;

  console.error(
    `Refusing to run: ${problem}.\n\n` +
      `  Run \`pnpm db:branch\` first. It forks a copy-on-write Neon branch for\n` +
      `  this git branch and writes DATABASE_URL into this worktree's .env.\n\n` +
      `  Why this is blocked rather than warned about: while worktrees share one\n` +
      `  database, a migration applied from any of them makes every other one\n` +
      `  report drift, and the only remedy Prisma offers is a reset that drops\n` +
      `  every row. Never accept that offer -- provision the branch instead.`,
  );
  process.exit(exitCode);
}

/**
 * Claude Code PreToolUse hook entry point (`--hook`).
 *
 * Reads the tool payload on stdin and blocks with exit 2 -- the blocking-error
 * code -- when a database-touching command would run without a branch database.
 * Parsing here rather than in the hook's shell command keeps the rule in one
 * tested file and avoids depending on jq, which is not installed on this
 * machine.
 */
async function hookMain() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);

  let command = "";
  try {
    command = JSON.parse(chunks.join("")).tool_input?.command ?? "";
  } catch {
    // A payload we cannot read is not evidence of a problem. Failing closed
    // here would block every command on a malformed hook input.
    return;
  }

  if (!touchesDatabase(command)) return;
  main(2);
}

// Guarded so the pure helpers above can be imported by the colocated test
// without the check running as a side effect of `import`.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes("--hook")) await hookMain();
  else main();
}
