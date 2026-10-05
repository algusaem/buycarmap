import { randomUUID } from "node:crypto";
import { rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { main, run } from "./migrate-deploy.mjs";

/**
 * Writes a throwaway `.mjs` file that just exits with `code`, for `run` to
 * spawn — no shell metacharacters, unlike `node -e "process.exit(0)"`, which
 * `run`'s `[command, ...args].join(" ")` hands to a shell that on Linux is
 * `/bin/sh`, not cmd.exe, and treats `(` as a syntax error outside quotes.
 */
function writeExitScript(code: number): string {
  const path = join(tmpdir(), `migrate-deploy-run-test-${randomUUID()}.mjs`);
  writeFileSync(path, `process.exit(${code});\n`, "utf8");
  return path;
}

// PLAT-9 worked example (docs/specs/core-platform.md):
//   VERCEL_ENV=production -> `prisma migrate deploy` runs, exit is its own code
//   VERCEL_ENV=preview    -> skipped, exit 0
//   VERCEL_ENV unset      -> skipped, exit 0

describe("main", () => {
  it("PLAT-9: production runs `pnpm exec prisma migrate deploy` and returns its exit code (success)", async () => {
    const run = vi.fn().mockResolvedValue(0);

    const code = await main({ env: { VERCEL_ENV: "production" }, run });

    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith("pnpm", ["exec", "prisma", "migrate", "deploy"]);
    expect(code).toBe(0);
  });

  it("PLAT-9: production returns a failed migration's non-zero exit code", async () => {
    const run = vi.fn().mockResolvedValue(1);

    const code = await main({ env: { VERCEL_ENV: "production" }, run });

    expect(code).toBe(1);
  });

  // Amended by ENV-3 (docs/specs/core-environments.md): preview now migrates
  // its own Neon branch, so the skip case is a development deployment.
  it("PLAT-9: a development deployment skips the migration and exits 0", async () => {
    const run = vi.fn().mockResolvedValue(0);

    const code = await main({ env: { VERCEL_ENV: "development" }, run });

    expect(run).not.toHaveBeenCalled();
    expect(code).toBe(0);
  });

  it("PLAT-9: local (VERCEL_ENV unset) skips the migration and exits 0", async () => {
    const run = vi.fn().mockResolvedValue(0);

    const code = await main({ env: {}, run });

    expect(run).not.toHaveBeenCalled();
    expect(code).toBe(0);
  });
});

// ENV-3 worked example (docs/specs/core-environments.md): previews now share
// a seed-only Neon branch (ADR 0019), so `preview` also migrates — only
// `production` did before this phase.
//   VERCEL_ENV=production  -> migrates
//   VERCEL_ENV=preview     -> migrates
//   VERCEL_ENV=development -> skips, exit 0
//   VERCEL_ENV unset       -> skips, exit 0
describe("ENV-3: migrations run on production and preview", () => {
  it("ENV-3: production migrates", async () => {
    const run = vi.fn().mockResolvedValue(0);

    const code = await main({ env: { VERCEL_ENV: "production" }, run });

    expect(run).toHaveBeenCalledWith("pnpm", ["exec", "prisma", "migrate", "deploy"]);
    expect(code).toBe(0);
  });

  it("ENV-3: preview migrates", async () => {
    const run = vi.fn().mockResolvedValue(0);

    const code = await main({ env: { VERCEL_ENV: "preview" }, run });

    expect(run).toHaveBeenCalledWith("pnpm", ["exec", "prisma", "migrate", "deploy"]);
    expect(code).toBe(0);
  });

  it("ENV-3: development skips", async () => {
    const run = vi.fn().mockResolvedValue(0);

    const code = await main({ env: { VERCEL_ENV: "development" }, run });

    expect(run).not.toHaveBeenCalled();
    expect(code).toBe(0);
  });

  it("ENV-3: unset skips", async () => {
    const run = vi.fn().mockResolvedValue(0);

    const code = await main({ env: {}, run });

    expect(run).not.toHaveBeenCalled();
    expect(code).toBe(0);
  });
});

// `run` itself (not `main`'s `run` fake above): it really spawns, through the
// shell, and resolves with the spawned process's own exit code. "node" is the
// command — like `run`'s real callers (pnpm, prisma), a bare name on PATH,
// not a path that could itself contain a space `run`'s unquoted `.join(" ")`
// would split on.
describe("run", () => {
  it("resolves with the spawned process's real exit code on success", async () => {
    const scriptPath = writeExitScript(0);
    try {
      await expect(run("node", [scriptPath])).resolves.toBe(0);
    } finally {
      rmSync(scriptPath, { force: true });
    }
  });

  it("resolves with the spawned process's real non-zero exit code", async () => {
    const scriptPath = writeExitScript(3);
    try {
      await expect(run("node", [scriptPath])).resolves.toBe(3);
    } finally {
      rmSync(scriptPath, { force: true });
    }
  });
});
