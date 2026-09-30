import { describe, expect, it, vi } from "vitest";
import { main, run } from "./migrate-deploy.mjs";

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

  it("PLAT-9: preview skips the migration and exits 0", async () => {
    const run = vi.fn().mockResolvedValue(0);

    const code = await main({ env: { VERCEL_ENV: "preview" }, run });

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

// `run` itself (not `main`'s `run` fake above): it really spawns, through the
// shell, and resolves with the spawned process's own exit code. "node" is the
// command — like `run`'s real callers (pnpm, prisma), a bare name on PATH,
// not a path that could itself contain a space `run`'s unquoted `.join(" ")`
// would split on.
describe("run", () => {
  it("resolves with the spawned process's real exit code on success", async () => {
    await expect(run("node", ["-e", "process.exit(0)"])).resolves.toBe(0);
  });

  it("resolves with the spawned process's real non-zero exit code", async () => {
    await expect(run("node", ["-e", "process.exit(3)"])).resolves.toBe(3);
  });
});
