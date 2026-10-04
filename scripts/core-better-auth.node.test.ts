import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Static checks against docs/specs/core-better-auth.md: BAUTH-12 (AUTH-8
// withdrawn), BAUTH-17 (every ownership check goes through can()/ownedBy())
// and BAUTH-18 (docs and configuration record the change). None of these
// need a running `auth` instance — they read the working tree directly, the
// way scripts/core-platform.node.test.ts does.

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (path: string) => readFileSync(join(ROOT, path), "utf8").replace(/\r\n/g, "\n");
const exists = (path: string) => existsSync(join(ROOT, path));

function gitLsFiles(...pathspecs: string[]): string[] {
  const output = execFileSync("git", ["ls-files", "--", ...pathspecs], {
    cwd: ROOT,
    encoding: "utf8",
  }).trim();
  return output === "" ? [] : output.split("\n");
}

describe("BAUTH-12: AUTH-8 is withdrawn", () => {
  it("BAUTH-12: the auth spec's AUTH-8 line says Withdrawn", () => {
    const spec = read("docs/specs/auth-email-and-oauth.md");
    const auth8Line = spec.split("\n").find((line) => line.includes("AUTH-8")) ?? "";

    expect(auth8Line).toContain("Withdrawn");
  });

  // Built from parts so this file does not match its own search.
  const WITHDRAWN_TITLE = ['"AUTH', "-8:"].join("");

  it("BAUTH-12: no test title names the withdrawn replay criterion any more", () => {
    const testFiles = gitLsFiles("*.test.ts", "*.test.tsx");

    const stillReferencing = testFiles.filter((path) => read(path).includes(WITHDRAWN_TITLE));

    expect(stillReferencing).toEqual([]);
  });
});

describe("BAUTH-17: ownership checks go through can()/ownedBy()", () => {
  it("BAUTH-17: no inline userId ownership comparison outside lib/auth/permissions.ts", () => {
    const serverFiles = gitLsFiles(
      "server/**/actions.ts",
      "server/**/queries.ts",
      "server/**/service.ts",
    );

    const pattern =
      /userId\s*!==\s*user\.id|userId\s*===\s*user\.id|\.userId\s*!==\s*|\.userId\s*===\s*/;

    const offenders = serverFiles
      .filter((path) => path !== "lib/auth/permissions.ts")
      .filter((path) => pattern.test(read(path)));

    // Today's one known offender: server/two-factor/service.ts's
    // `recovery.userId !== user.id` recovery-code ownership check.
    expect(offenders).toEqual([]);
  });
});

describe("BAUTH-18: docs and configuration record the change", () => {
  it("BAUTH-18: .env.example carries BETTER_AUTH_SECRET and BETTER_AUTH_URL", () => {
    const envExample = read(".env.example");

    expect(envExample).toMatch(/^BETTER_AUTH_SECRET=/m);
    expect(envExample).toMatch(/^BETTER_AUTH_URL=/m);
  });

  it("BAUTH-18: .env.example no longer carries NEXTAUTH_SECRET or TWO_FACTOR_ENCRYPTION_KEY", () => {
    const envExample = read(".env.example");

    expect(envExample).not.toMatch(/^NEXTAUTH_SECRET=/m);
    expect(envExample).not.toMatch(/^TWO_FACTOR_ENCRYPTION_KEY=/m);
  });

  it("BAUTH-18: an ADR 0018 exists", () => {
    const adrs = gitLsFiles("docs/decisions/0018-*.md");

    expect(adrs.length).toBeGreaterThan(0);
    for (const path of adrs) {
      expect(exists(path)).toBe(true);
    }
  });

  it("BAUTH-18: ADR 0004 is marked Superseded", () => {
    expect(read("docs/decisions/0004-jwt-sessions.md")).toContain("Superseded");
  });

  it("BAUTH-18: ADR 0007 row 25 ends 'Resolved in phase 11'", () => {
    const adr = read("docs/decisions/0007-adopt-core-rules.md");
    const row25 = adr.split("\n").find((line) => line.trimStart().startsWith("| 25 ")) ?? "";

    expect(row25.trimEnd()).toMatch(/Resolved in phase 11\s*\|$/);
  });
});
