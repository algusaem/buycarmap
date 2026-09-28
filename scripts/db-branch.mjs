//
// Gives the current git branch its own Neon database branch.
//
// Every worktree used to share one Neon database, which breaks `prisma migrate
// dev`: it assumes the dev database matches the *current branch's* migration
// history, so a migration applied from one worktree reads as drift in all the
// others, and the only remedy Prisma offers is a destructive reset. A branch
// per branch removes the shared state that causes it.
//
// Deliberately dependency-free — built-ins only. A fresh worktree has no
// node_modules (and no .env), so anything imported here would have to be
// installed before the script that bootstraps the worktree could run.
//
// Usage:
//   node scripts/db-branch.mjs            create or reuse a branch, write .env
//   node scripts/db-branch.mjs --delete   delete this branch's Neon branch
//   node scripts/db-branch.mjs --delete <name>

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const API = "https://console.neon.tech/api/v2";

// Neon accepts a fairly wide character set, but git branch names carry slashes
// (`claude/foo`) and the occasional oddity. Keep it boring and predictable.
export const sanitize = (name) => name.replace(/[^a-zA-Z0-9._/-]/g, "-");

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function fail(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
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

async function neon(apiKey, path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    fail(
      `Neon API ${options.method ?? "GET"} ${path} failed (${response.status}).\n  ${body.slice(0, 300)}`,
    );
  }

  return response.json();
}

/**
 * Branch creation provisions a compute endpoint, which is not immediately
 * usable. Without waiting, the connection string we hand back can refuse the
 * first connection and look like a broken script.
 */
async function waitForOperations(apiKey, projectId, operations) {
  const pending = operations.filter((op) => op.status !== "finished");
  if (pending.length === 0) return;

  process.stdout.write("  waiting for the compute endpoint");
  for (let attempt = 0; attempt < 60; attempt++) {
    const states = await Promise.all(
      pending.map(async (op) => {
        const { operation } = await neon(apiKey, `/projects/${projectId}/operations/${op.id}`);
        return operation.status;
      }),
    );

    if (states.every((s) => s === "finished")) {
      process.stdout.write(" ready\n");
      return;
    }
    if (states.some((s) => s === "failed" || s === "error")) {
      process.stdout.write("\n");
      fail("Neon reported a failed operation while creating the branch.");
    }

    process.stdout.write(".");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  process.stdout.write("\n");
  fail("Timed out waiting for the Neon compute endpoint to start.");
}

async function resolveProjectId(apiKey, configured) {
  if (configured) return configured;

  // Convenience for the common single-project account, but pin it afterwards:
  // silently picking a project becomes a hazard the moment a second one exists.
  const { projects } = await neon(apiKey, "/projects");
  if (projects.length !== 1) {
    fail(
      `NEON_PROJECT_ID is not set and your account has ${projects.length} projects, so there is nothing safe to guess.\n` +
        `  Add NEON_PROJECT_ID to .env — it is in the Neon console URL, or run:\n` +
        `    curl -s -H "Authorization: Bearer $NEON_API_KEY" ${API}/projects`,
    );
  }

  console.log(
    `  using the only project on the account: ${projects[0].id}\n` +
      `  pin it by adding NEON_PROJECT_ID="${projects[0].id}" to .env`,
  );
  return projects[0].id;
}

async function main() {
  const args = process.argv.slice(2);
  const isDelete = args.includes("--delete");

  // Worktrees have no .env of their own; the shared secrets live in the main
  // checkout, which --git-common-dir points at from anywhere.
  const mainRoot = dirname(git("rev-parse", "--path-format=absolute", "--git-common-dir"));
  const worktreeRoot = git("rev-parse", "--show-toplevel");
  const mainEnvPath = join(mainRoot, ".env");
  const localEnvPath = join(worktreeRoot, ".env");

  if (!existsSync(mainEnvPath)) {
    fail(`No .env found in the main checkout (${mainEnvPath}). Copy .env.example and fill it in.`);
  }

  const mainEnvRaw = readFileSync(mainEnvPath, "utf8");
  const mainEnv = parseEnv(mainEnvRaw);
  const apiKey = process.env.NEON_API_KEY || mainEnv.NEON_API_KEY;

  if (!apiKey) {
    fail(
      "NEON_API_KEY is not set.\n" +
        "  Create one at https://console.neon.tech → Account settings → API keys,\n" +
        "  then add it to .env in the main checkout. It is tooling-only and is not\n" +
        "  read by the app, so it is deliberately absent from lib/env.ts.",
    );
  }

  const projectId = await resolveProjectId(
    apiKey,
    process.env.NEON_PROJECT_ID || mainEnv.NEON_PROJECT_ID,
  );

  const gitBranch = git("rev-parse", "--abbrev-ref", "HEAD");
  const target = sanitize(isDelete ? (args[args.indexOf("--delete") + 1] ?? gitBranch) : gitBranch);

  const { branches } = await neon(apiKey, `/projects/${projectId}/branches`);
  const defaultBranch = branches.find((b) => b.default);
  const existing = branches.find((b) => b.name === target);

  if (isDelete) {
    if (!existing) fail(`No Neon branch named "${target}" — nothing to delete.`);
    if (existing.default) {
      fail(
        `Refusing to delete "${target}": it is the project's default branch and holds the shared data.`,
      );
    }
    // The main checkout's DATABASE_URL is the one thing that must keep working.
    if (mainEnv.DATABASE_URL?.includes(existing.id)) {
      fail(`Refusing to delete "${target}": the main checkout's DATABASE_URL still points at it.`);
    }

    await neon(apiKey, `/projects/${projectId}/branches/${existing.id}`, {
      method: "DELETE",
    });
    console.log(`\n  deleted Neon branch "${target}" (${existing.id})\n`);
    return;
  }

  if (defaultBranch && target === defaultBranch.name) {
    fail(
      `"${target}" is the Neon default branch, which is the shared database this script exists to protect.\n` +
        `  Switch to a feature branch first.`,
    );
  }

  let branch = existing;
  if (branch) {
    console.log(`\n  reusing existing Neon branch "${target}" (${branch.id})`);
  } else {
    if (!defaultBranch) fail("Could not determine the project's default Neon branch to fork from.");
    console.log(`\n  creating Neon branch "${target}" from "${defaultBranch.name}"…`);

    const created = await neon(apiKey, `/projects/${projectId}/branches`, {
      method: "POST",
      body: JSON.stringify({
        branch: { name: target, parent_id: defaultBranch.id },
        endpoints: [{ type: "read_write" }],
      }),
    });

    branch = created.branch;
    await waitForOperations(apiKey, projectId, created.operations ?? []);
  }

  // Reuse the role and database from the existing connection string rather than
  // asking for them again — a Neon branch inherits both from its parent.
  const parentUrl = new URL(mainEnv.DATABASE_URL);
  const params = new URLSearchParams({
    branch_id: branch.id,
    database_name: parentUrl.pathname.replace(/^\//, ""),
    role_name: decodeURIComponent(parentUrl.username),
    pooled: "true",
  });

  const { uri } = await neon(apiKey, `/projects/${projectId}/connection_uri?${params}`);

  // Seed a worktree that has no .env from the main checkout, so every other
  // secret (NEXTAUTH_SECRET, Resend, OAuth) comes across too.
  const base = existsSync(localEnvPath) ? readFileSync(localEnvPath, "utf8") : mainEnvRaw;
  writeFileSync(localEnvPath, setEnvValue(base, "DATABASE_URL", uri), "utf8");

  console.log(
    `  wrote DATABASE_URL → ${localEnvPath}\n` +
      `  host: ${new URL(uri).host}\n\n` +
      `  This worktree now has its own database. Run \`pnpm install\` if you have not,\n` +
      `  then \`pnpm exec prisma migrate deploy\` to bring it up to date.\n`,
  );
}

// Guarded so the pure helpers above can be imported by the colocated test
// without the script provisioning a database as a side effect of `import`.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
