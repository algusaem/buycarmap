import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

// PLAT-9 (docs/specs/core-platform.md), amended by ENV-3
// (docs/specs/core-environments.md): `pnpm build` runs this after `prisma
// generate` and before `next build`. Previews now have their own Neon
// branch, `preview` (ADR 0019), seed-only and never a child of production, so
// the migration runs whenever VERCEL_ENV is "production" or "preview".
// Everywhere else it prints one line and exits 0, so `pnpm build` still works
// with no Vercel environment at all (a local build, or CI).

// Exported so the colocated test can prove it actually spawns and resolves
// with the child's real exit code, using a harmless real command (this same
// Node binary) rather than a fake — `main`'s own test already covers the
// VERCEL_ENV branching with a fake `run`, which this does not repeat.
export function run(command, args) {
  return new Promise((resolve, reject) => {
    // One command string, not (command, args): Node 22 deprecates passing args
    // alongside `shell: true` (DEP0190). The args are fixed literals from main().
    const child = spawn([command, ...args].join(" "), { stdio: "inherit", shell: true });
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

export async function main({ env, run: runCommand }) {
  if (env.VERCEL_ENV !== "production" && env.VERCEL_ENV !== "preview") {
    console.log("Skipping prisma migrate deploy (VERCEL_ENV is not production or preview).");
    return 0;
  }

  return runCommand("pnpm", ["exec", "prisma", "migrate", "deploy"]);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await main({ env: process.env, run }));
}
