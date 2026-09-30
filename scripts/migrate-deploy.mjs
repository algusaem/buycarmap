import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

// PLAT-9 (docs/specs/core-platform.md): `pnpm build` runs this after `prisma
// generate` and before `next build`. Previews share the production database
// until phase 12 (docs/decisions/0013-platform-runtime.md), so migrating from
// a preview build would apply an unmerged schema to production — the
// migration only runs when VERCEL_ENV is "production". Everywhere else it
// prints one line and exits 0, so `pnpm build` still works with no Vercel
// environment at all (a local build, or CI).

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: true });
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

export async function main({ env, run: runCommand }) {
  if (env.VERCEL_ENV !== "production") {
    console.log("Skipping prisma migrate deploy (VERCEL_ENV is not production).");
    return 0;
  }

  return runCommand("pnpm", ["exec", "prisma", "migrate", "deploy"]);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await main({ env: process.env, run }));
}
