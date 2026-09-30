//
// Gives the current git branch its own database inside the local Compose
// Postgres (docker-compose.yml), started with `pnpm db:up`.
//
// Every worktree used to share one Neon database, which broke `prisma migrate
// dev`: it assumes the dev database matches the *current branch's* migration
// history, so a migration applied from one worktree read as drift in all the
// others, and the only remedy Prisma offered was a destructive reset. A branch
// per branch removes the shared state that causes it — now inside the local
// Postgres instead of a Neon branch, so local work needs no network access and
// no Neon API key.
//
// Deliberately dependency-free — built-ins only. A fresh worktree has no
// node_modules (and no .env), so anything imported here would have to be
// installed before the script that bootstraps the worktree could run.
//
// Usage:
//   node scripts/db-branch.mjs            create or reuse this branch's database, write .env
//   node scripts/db-branch.mjs --delete   drop this branch's database
//   node scripts/db-branch.mjs --delete <name>

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ADMIN_URL = "postgresql://postgres:postgres@localhost:5433/postgres";
const POSTGRES_NAME_LIMIT = 63;

// Neon accepted a fairly wide character set, but git branch names carry
// slashes (`claude/foo`) and the occasional oddity. Kept for its own test and
// for anything still comparing branch names loosely; database names use
// `databaseName` below instead, whose alphabet Postgres actually accepts.
export const sanitize = (name) => name.replace(/[^a-zA-Z0-9._/-]/g, "-");

// TEST-2 (docs/specs/core-testing.md): the Postgres database name for the
// current git branch. Lowercase, every character outside a-z0-9 becomes "_",
// runs of "_" collapse, and names over Postgres' 63-byte limit are cut to 54
// characters plus "_" and the first 8 hex characters of the branch name's
// SHA-1 — short enough to always fit, and still traceable back to the branch.
export function databaseName(branch) {
  const sanitized = branch
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_");
  const full = `buycarmap_${sanitized}`;

  if (Buffer.byteLength(full, "utf8") <= POSTGRES_NAME_LIMIT) return full;

  const suffix = createHash("sha1").update(branch).digest("hex").slice(0, 8);
  return `${full.slice(0, 54)}_${suffix}`;
}

// TEST-2/TEST-3: refuses to proceed against a non-local database host, naming
// it in the thrown message. This is what stops `pnpm db:branch` and
// `pnpm db:branch:rm` from ever reaching Neon, and so production.
export function assertLocalUrl(url) {
  const { hostname } = new URL(url);
  if (hostname !== "localhost" && hostname !== "127.0.0.1") {
    throw new Error(
      `Refusing to connect to "${hostname}": only localhost and 127.0.0.1 are allowed here.`,
    );
  }
}

function git(exec, ...args) {
  return exec("git", args, { encoding: "utf8" }).trim();
}

function fail(error, exit, message) {
  error(`\n  ${message}\n`);
  exit(1);
}

/**
 * Parses a .env file into a plain object. dotenv is not available here (see the
 * dependency-free note above), and the format we need is a small subset:
 * KEY=value, optionally single- or double-quoted.
 */
export function parseEnv(contents) {
  const out = {};
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (!match) continue;
    out[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
  return out;
}

/**
 * Rewrites DATABASE_URL in place, preserving every other line and any comments.
 * Appends if the key is absent.
 */
export function setEnvValue(contents, key, value) {
  const line = `${key}="${value}"`;
  const pattern = new RegExp(`^\\s*${key}\\s*=.*$`, "m");
  if (pattern.test(contents)) return contents.replace(pattern, line);
  return `${contents.replace(/\s*$/, "")}\n${line}\n`;
}

/** The admin connection string `pnpm db:branch` uses to create/drop databases. */
function resolveAdminUrl(env, mainEnv) {
  return env.LOCAL_DATABASE_ADMIN_URL || mainEnv.LOCAL_DATABASE_ADMIN_URL || DEFAULT_ADMIN_URL;
}

/** Swaps the database name in a connection string, keeping host/user/password/port/query. */
function withDatabase(url, name) {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

/**
 * Runs a SQL statement against the Compose Postgres through `docker compose
 * exec`, so this script needs no `pg` import — keeping it dependency-free.
 */
function psql(exec, sql) {
  return exec(
    "docker",
    ["compose", "exec", "-T", "postgres", "psql", "-U", "postgres", "-tAc", sql],
    {
      encoding: "utf8",
    },
  );
}

function ensureComposeRunning(deps) {
  try {
    psql(deps.exec, "select 1");
    return true;
  } catch {
    fail(deps.error, deps.exit, "Run `pnpm db:up` first (Docker Desktop must be running).");
    return false;
  }
}

/** Creates the database if it does not already exist. Idempotent. */
function createDatabaseIfMissing(deps, name) {
  // `name` only ever comes from `databaseName`, whose alphabet is [a-z0-9_] —
  // never user-supplied SQL — but it is still quoted rather than trusted.
  const exists = psql(deps.exec, `SELECT 1 FROM pg_database WHERE datname = '${name}'`).trim();
  if (exists === "1") {
    deps.log(`\n  reusing existing database "${name}"`);
    return;
  }

  deps.exec(
    "docker",
    [
      "compose",
      "exec",
      "-T",
      "postgres",
      "psql",
      "-U",
      "postgres",
      "-c",
      `CREATE DATABASE "${name}"`,
    ],
    { encoding: "utf8" },
  );
  deps.log(`\n  created database "${name}"`);
}

function dropDatabase(deps, name) {
  deps.exec(
    "docker",
    [
      "compose",
      "exec",
      "-T",
      "postgres",
      "psql",
      "-U",
      "postgres",
      "-c",
      `DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`,
    ],
    { encoding: "utf8" },
  );
  deps.log(`\n  dropped database "${name}"\n`);
}

function runMigrations(deps, databaseUrl) {
  deps.exec("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...deps.env, DATABASE_URL: databaseUrl },
    shell: process.platform === "win32",
  });
}

function writeDatabaseEnv(deps, databaseUrl, mainEnvRaw, localEnvPath) {
  // Seed a worktree that has no .env from the main checkout, so every other
  // secret (NEXTAUTH_SECRET, Resend, OAuth) comes across too.
  const base = deps.fileExists(localEnvPath) ? deps.readFile(localEnvPath, "utf8") : mainEnvRaw;
  deps.writeFile(localEnvPath, setEnvValue(base, "DATABASE_URL", databaseUrl), "utf8");

  deps.log(
    `  wrote DATABASE_URL → ${localEnvPath}\n` +
      `  database: ${new URL(databaseUrl).pathname.replace(/^\//, "")}\n\n` +
      `  This worktree now has its own database. Run \`pnpm install\` if you have not,\n` +
      `  then \`pnpm exec prisma generate\`.\n`,
  );
}

// TEST-2/TEST-3: `main`'s real work, with every side effect (shelling out to
// git/docker/pnpm, reading and writing .env, process.exit) taken as injected
// dependencies defaulting to the real ones — so the colocated test can drive
// every branch (compose not running, database exists vs. is created, the
// --delete path, the .env write) with fakes instead of a real Docker/Postgres
// and a real worktree.
export async function main({
  argv = process.argv.slice(2),
  exec = execFileSync,
  fileExists = existsSync,
  readFile = readFileSync,
  writeFile = writeFileSync,
  env = process.env,
  log = console.log,
  error = console.error,
  exit = process.exit,
} = {}) {
  const deps = { exec, fileExists, readFile, writeFile, env, log, error, exit };
  const isDelete = argv.includes("--delete");

  // Worktrees have no .env of their own; the shared secrets live in the main
  // checkout, which --git-common-dir points at from anywhere.
  const mainRoot = dirname(git(exec, "rev-parse", "--path-format=absolute", "--git-common-dir"));
  const worktreeRoot = git(exec, "rev-parse", "--show-toplevel");
  const mainEnvPath = join(mainRoot, ".env");
  const localEnvPath = join(worktreeRoot, ".env");

  if (!fileExists(mainEnvPath)) {
    fail(
      error,
      exit,
      `No .env found in the main checkout (${mainEnvPath}). Copy .env.example and fill it in.`,
    );
    return;
  }

  const mainEnvRaw = readFile(mainEnvPath, "utf8");
  const mainEnv = parseEnv(mainEnvRaw);

  const adminUrl = resolveAdminUrl(env, mainEnv);
  assertLocalUrl(adminUrl);

  const gitBranch = git(exec, "rev-parse", "--abbrev-ref", "HEAD");
  const target = databaseName(
    isDelete ? (argv[argv.indexOf("--delete") + 1] ?? gitBranch) : gitBranch,
  );
  const databaseUrl = withDatabase(adminUrl, target);
  assertLocalUrl(databaseUrl);

  if (!ensureComposeRunning(deps)) return;

  if (isDelete) {
    dropDatabase(deps, target);
    return;
  }

  createDatabaseIfMissing(deps, target);
  runMigrations(deps, databaseUrl);
  writeDatabaseEnv(deps, databaseUrl, mainEnvRaw, localEnvPath);
}

// Guarded so the pure helpers above can be imported by the colocated test
// without the script provisioning a database as a side effect of `import`.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
