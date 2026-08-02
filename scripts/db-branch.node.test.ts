import { describe, expect, it } from "vitest";

// @ts-expect-error - plain .mjs dev script, deliberately dependency-free and untyped
import { parseEnv, sanitize, setEnvValue } from "./db-branch.mjs";

// `pnpm db:branch` rewrites a real .env holding NEXTAUTH_SECRET, the Resend key
// and OAuth secrets. Losing a line here silently breaks auth; matching the wrong
// line silently points the app at the wrong database. Both are covered.

describe("parseEnv", () => {
  it("strips single quotes, which is how DATABASE_URL is actually written here", () => {
    // The real .env uses single quotes. Leaving them in makes `new URL(...)`
    // parse the host as "base" — the failure that started all of this.
    const env = parseEnv(`DATABASE_URL='postgresql://user:pw@host.neon.tech/neondb'`);

    expect(env.DATABASE_URL).toBe("postgresql://user:pw@host.neon.tech/neondb");
    expect(new URL(env.DATABASE_URL).host).toBe("host.neon.tech");
  });

  it("strips double quotes and tolerates CRLF", () => {
    const env = parseEnv('A="one"\r\nB="two"\r\n');

    expect(env).toEqual({ A: "one", B: "two" });
  });

  it("ignores comments, so a commented-out key is not read as set", () => {
    // .env.example ships `# NEON_API_KEY=""`. If that parsed as a real key,
    // copying the example would look configured while being empty.
    const env = parseEnv(['# NEON_API_KEY="secret"', "", "NEON_PROJECT_ID=proj-123"].join("\n"));

    expect(env.NEON_API_KEY).toBeUndefined();
    expect(env.NEON_PROJECT_ID).toBe("proj-123");
  });
});

describe("setEnvValue", () => {
  const original = [
    "# Neon connection string",
    'DATABASE_URL="postgresql://old@old-host/neondb"',
    "",
    'NEXTAUTH_SECRET="keep-me-32-characters-long-abcdef"',
    'RESEND_API_KEY="re_keep_me"',
    "",
  ].join("\n");

  it("replaces the value while preserving every other line and comment", () => {
    const result = setEnvValue(original, "DATABASE_URL", "postgresql://new@new-host/neondb");

    expect(result).toBe(
      [
        "# Neon connection string",
        'DATABASE_URL="postgresql://new@new-host/neondb"',
        "",
        'NEXTAUTH_SECRET="keep-me-32-characters-long-abcdef"',
        'RESEND_API_KEY="re_keep_me"',
        "",
      ].join("\n"),
    );
  });

  it("appends when the key is absent, without disturbing existing lines", () => {
    const result = setEnvValue('NEXTAUTH_SECRET="keep"\n', "DATABASE_URL", "postgresql://x@y/z");

    expect(result).toBe('NEXTAUTH_SECRET="keep"\nDATABASE_URL="postgresql://x@y/z"\n');
  });

  it("does not match a longer key that merely starts with the same name", () => {
    // Neon hands out DATABASE_URL_UNPOOLED alongside DATABASE_URL. Rewriting
    // the unpooled one would point Prisma at a direct connection by accident.
    const withUnpooled = 'DATABASE_URL_UNPOOLED="postgresql://direct@host/neondb"\n';
    const result = setEnvValue(withUnpooled, "DATABASE_URL", "postgresql://pooled@host/neondb");

    expect(result).toBe(
      'DATABASE_URL_UNPOOLED="postgresql://direct@host/neondb"\n' +
        'DATABASE_URL="postgresql://pooled@host/neondb"\n',
    );
  });
});

describe("sanitize", () => {
  it("keeps slashed branch names intact", () => {
    expect(sanitize("claude/practical-pare-d865a0")).toBe("claude/practical-pare-d865a0");
  });

  it("replaces characters Neon will not accept", () => {
    // Three invalid characters — "é", the space and "#" — become three dashes.
    expect(sanitize("feat/caché #2")).toBe("feat/cach---2");
  });
});
