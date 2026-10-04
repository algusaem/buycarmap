import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

// Security review fix (item 4): lib/auth/auth.ts's `logger.log` mapper writes
// through the shared `@/lib/logger` singleton, so this swaps it for a
// destination-backed instance (the same `createLogger(dest)` pattern
// lib/logger.node.test.ts uses) to inspect what actually gets written,
// rather than asserting on call arguments a step removed from the real log
// line. `vi.hoisted` is required (not a plain top-level `const`): `vi.mock`
// factories run before this file's own top-level code, so `dest` must exist
// by then.
const { dest } = vi.hoisted(() => {
  const lines: string[] = [];
  return { dest: { lines, write: (line: string) => lines.push(line) } };
});
vi.mock("@/lib/logger", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/logger")>();
  return { ...original, logger: original.createLogger(dest) };
});

import { ALLOWED_HTTP_PATHS, auth } from "./auth";

// BAUTH-1/BAUTH-6 (docs/specs/core-better-auth.md). `auth` is the real
// Better Auth instance (lib/auth/auth.ts) — these are the checks that do not
// need to actually call it over HTTP: the allowlist it computes
// `disabledPaths` from, and the static shape of the migration (one import
// point, NextAuth gone). The HTTP half of BAUTH-6 — actually calling those
// paths — is app/api/auth/[...all]/route.integration.test.ts.

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

function gitLsFiles(...pathspecs: string[]): string[] {
  const output = execFileSync("git", ["ls-files", "--", ...pathspecs], {
    cwd: ROOT,
    encoding: "utf8",
  }).trim();
  return output === "" ? [] : output.split("\n");
}

function importsModule(source: string, moduleName: string): boolean {
  const escaped = moduleName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`from\\s+["']${escaped}["']|require\\(["']${escaped}["']\\)`).test(source);
}

describe("auth.options.disabledPaths", () => {
  // BAUTH-6, amended 2026-10-04 after the security review: the allowlist
  // flipped from "list the disabled flows" to "list the allowed ones", with
  // `disabledPaths` computed as every other path the instance actually
  // serves (lib/auth/auth.ts's `discoverServedPaths`). The six flows this
  // test used to assert directly are still disabled — they are simply no
  // longer the whole list, now that `/change-password`, `/link-social` and
  // every other non-allowlisted path (session management, `/two-factor/*`,
  // account linking) are disabled too.
  it("BAUTH-6: disables every served path except the allowlist", () => {
    const disabled = new Set(auth.options.disabledPaths);

    for (const allowedPath of ALLOWED_HTTP_PATHS) {
      expect(disabled.has(allowedPath)).toBe(false);
    }

    // The six flows the allowlist named before the amendment, plus
    // `/change-password` and `/link-social`, newly disabled by it.
    for (const path of [
      "/sign-up/email",
      "/request-password-reset",
      "/reset-password",
      "/change-email",
      "/verify-email",
      "/send-verification-email",
      "/change-password",
      "/link-social",
    ]) {
      expect(disabled.has(path)).toBe(true);
    }
  });

  it("BAUTH-6: every path Better Auth serves is either allowed or disabled, never neither", () => {
    // This fails only if `discoverServedPaths`/the `DISABLED_PATHS`
    // computation itself broke — by construction, `DISABLED_PATHS` is every
    // served path minus `ALLOWED_HTTP_PATHS`, so the two sets can never
    // overlap and their union is always every served path. A real Better
    // Auth upgrade that adds a new path lands in `DISABLED_PATHS`
    // automatically (fail closed) rather than becoming reachable silently.
    const disabled = [...auth.options.disabledPaths];
    const combined = [...disabled, ...ALLOWED_HTTP_PATHS];

    expect(new Set(combined).size).toBe(combined.length);
  });
});

describe("BAUTH-1: one Better Auth import point, NextAuth gone", () => {
  it("BAUTH-1: only lib/auth/auth.ts and lib/auth/auth-client.ts import better-auth", () => {
    const tsFiles = gitLsFiles("*.ts", "*.tsx").filter(
      (path) => !path.startsWith("app/generated/"),
    );

    const importers = tsFiles.filter((path) => {
      const source = readFileSync(join(ROOT, path), "utf8");
      return importsModule(source, "better-auth") || /from\s+["']better-auth\//.test(source);
    });

    expect(importers.sort()).toEqual(["lib/auth/auth-client.ts", "lib/auth/auth.ts"]);
  });

  it("BAUTH-1: no file imports next-auth", () => {
    const tsFiles = gitLsFiles("*.ts", "*.tsx").filter(
      (path) => !path.startsWith("app/generated/"),
    );

    const importers = tsFiles.filter((path) => {
      const source = readFileSync(join(ROOT, path), "utf8");
      return importsModule(source, "next-auth") || /from\s+["']next-auth\//.test(source);
    });

    expect(importers).toEqual([]);
  });

  it("BAUTH-1: lib/auth/options.ts no longer exists", () => {
    expect(existsSync(join(ROOT, "lib/auth/options.ts"))).toBe(false);
  });
});

describe("security review fix (item 4): Better Auth's logger mapper", () => {
  it("keeps an Error's message and drops every other arg, so no personal data reaches the line", () => {
    auth.options.logger?.log("error", "Unable to link account", new Error("boom"), {
      email: "a@b.c",
    });

    const line = dest.lines.find((written) => written.includes("Unable to link account"));
    if (!line) throw new Error("expected the mapped log line to be written");

    const parsed = JSON.parse(line) as { msg?: string; err?: { message?: string } };
    expect(parsed.msg).toBe("Unable to link account");
    expect(parsed.err?.message).toBe("boom");
    expect(line).not.toContain("a@b.c");
  });
});
