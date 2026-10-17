import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Static checks against docs/specs/core-better-auth.md: BAUTH-12 (AUTH-8
// withdrawn), BAUTH-17 (every ownership check goes through can()/ownedBy()),
// BAUTH-18 (docs and configuration record the change), BAUTH-19 (legacy users
// columns leave the schema) and BAUTH-21 (the remaining legacy auth columns
// leave the code). None of these need a running `auth` instance — they read
// the working tree directly, the way scripts/core-platform.node.test.ts does.

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

describe("BAUTH-19: the legacy users columns leave the Prisma schema", () => {
  it("BAUTH-19: the User model names none of the five legacy fields", () => {
    const schema = read("prisma/schema.prisma");
    const userModel = schema.match(/^model User \{\n([\s\S]*?)^\}/m)?.[1] ?? "";
    const fieldNames = userModel
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "" && !line.startsWith("//") && !line.startsWith("@@"))
      .map((line) => line.split(/\s+/)[0]);

    expect(fieldNames).toContain("emailConfirmed");
    for (const legacy of [
      "password",
      "emailVerified",
      "passwordChangedAt",
      "twoFactorSecret",
      "twoFactorLastStep",
    ]) {
      expect(fieldNames).not.toContain(legacy);
    }
  });
});

describe("BAUTH-21: the remaining legacy auth columns leave the code", () => {
  const modelFieldNames = (name: string): string[] => {
    const schema = read("prisma/schema.prisma");
    const model = schema.match(new RegExp(`^model ${name} \\{\\n([\\s\\S]*?)^\\}`, "m"))?.[1] ?? "";
    return model
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "" && !line.startsWith("//") && !line.startsWith("@@"))
      .map((line) => line.split(/\s+/)[0]);
  };

  it("BAUTH-21: the User model names neither twoFactorEnabledAt nor twoFactorResetNotifiedAt", () => {
    const fieldNames = modelFieldNames("User");

    expect(fieldNames).toContain("twoFactorEnabled");
    expect(fieldNames).not.toContain("twoFactorEnabledAt");
    expect(fieldNames).not.toContain("twoFactorResetNotifiedAt");
  });

  it("BAUTH-21: the Account model names none of the NextAuth-only columns", () => {
    const fieldNames = modelFieldNames("Account");

    expect(fieldNames).toContain("accessTokenExpiresAt");
    expect(fieldNames).not.toContain("expires_at");
    expect(fieldNames).not.toContain("token_type");
    expect(fieldNames).not.toContain("session_state");
  });

  it("BAUTH-21: no tracked source outside migrations and tests names the two-factor legacy fields", () => {
    const sources = gitLsFiles("*.ts", "*.tsx", "*.mjs", "*.cjs", "*.js")
      .filter((path) => !path.startsWith("prisma/migrations/"))
      .filter((path) => !path.startsWith("app/generated/"))
      .filter((path) => !/\.test\.tsx?$/.test(path) && !/\.spec\.ts$/.test(path))
      .filter((path) => exists(path));

    const offenders = sources.filter((path) =>
      /twoFactorEnabledAt|twoFactorResetNotifiedAt|two_factor_enabled_at|two_factor_reset_notified_at/.test(
        read(path),
      ),
    );

    expect(offenders).toEqual([]);
  });

  it("BAUTH-21: the re-enrolment notice and its pieces are gone", () => {
    expect(exists("scripts/notify-2fa-reset.mjs")).toBe(false);
    expect(exists("server/two-factor/reenrol.ts")).toBe(false);
    expect(exists("server/two-factor/reenrol.integration.test.ts")).toBe(false);
    expect(exists("emails/TwoFactorResetEmail.tsx")).toBe(false);

    const scripts = JSON.parse(read("package.json")).scripts;
    expect(scripts).not.toHaveProperty("auth:notify-2fa-reset");

    for (const path of ["messages/en.json", "messages/es.json"]) {
      const transactionalEmail = JSON.parse(read(path)).transactionalEmail;
      expect(transactionalEmail).toBeDefined();
      expect(transactionalEmail).not.toHaveProperty("twoFactorReset");
    }
  });
});
