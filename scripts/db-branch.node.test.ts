import { describe, expect, it, vi } from "vitest";

// A plain .mjs dev script, deliberately dependency-free and untyped, so TS
// infers `{}` for parseEnv's return and every property read fails. Declaring
// the surface here is narrower than adding a .d.ts for one dev script.
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import * as dbBranch from "./db-branch.mjs";

type Exec = (cmd: string, args: string[], options?: Record<string, unknown>) => string;

interface MainOptions {
  argv?: string[];
  exec?: Exec;
  fileExists?: (path: string) => boolean;
  readFile?: (path: string, encoding: string) => string;
  writeFile?: (path: string, data: string, encoding: string) => void;
  env?: Record<string, string | undefined>;
  log?: (message: string) => void;
  error?: (message: string) => void;
  exit?: (code: number) => void;
}

const { parseEnv, sanitize, setEnvValue, databaseName, assertLocalUrl, main } =
  dbBranch as unknown as {
    parseEnv: (contents: string) => Record<string, string>;
    sanitize: (name: string) => string;
    setEnvValue: (contents: string, key: string, value: string) => string;
    databaseName: (branch: string) => string;
    assertLocalUrl: (url: string) => void;
    main: (options?: MainOptions) => Promise<void>;
  };

const MAIN_ROOT = resolve("/repo");
const WORKTREE_ROOT = resolve("/worktree");
const GIT_COMMON_DIR = join(MAIN_ROOT, ".git");
const MAIN_ENV_PATH = join(MAIN_ROOT, ".env");
const LOCAL_ENV_PATH = join(WORKTREE_ROOT, ".env");
const MAIN_ENV_RAW = 'NEXTAUTH_SECRET="placeholder-placeholder-placeholder"\n';

/** The fake `git rev-parse` reply for one of the three invocations `main` makes. */
function fakeGit(args: string[], branch: string): string | undefined {
  if (args.includes("--git-common-dir")) return GIT_COMMON_DIR;
  if (args.includes("--show-toplevel")) return WORKTREE_ROOT;
  if (args.includes("--abbrev-ref")) return branch;
  return undefined;
}

/** The fake `docker compose exec … psql -tAc <sql>` reply. */
function fakePsql(args: string[], composeRunning: boolean, databaseExists: boolean): string {
  const sql = args[args.length - 1];
  if (sql === "select 1") {
    if (!composeRunning) throw new Error("compose not running");
    return "1";
  }
  return databaseExists ? "1" : "";
}

/**
 * A fake `exec` standing in for `execFileSync`, branching on the same
 * command/argument shapes `main` actually issues (git rev-parse × 3, the
 * compose "select 1" probe, the existence query, create/drop, and the
 * `pnpm exec prisma migrate deploy` call) — never a real git or docker
 * process.
 */
function makeExec(opts: { branch?: string; composeRunning?: boolean; databaseExists?: boolean }) {
  const { branch = "feature/x", composeRunning = true, databaseExists = false } = opts;
  return vi.fn<Exec>((cmd, args) => {
    if (cmd === "git") return fakeGit(args, branch) ?? "";
    if (cmd === "docker" && args.includes("-tAc")) {
      return fakePsql(args, composeRunning, databaseExists);
    }
    return "";
  });
}

interface Harness {
  exec: ReturnType<typeof makeExec>;
  fileExists: ReturnType<typeof vi.fn<(path: string) => boolean>>;
  readFile: ReturnType<typeof vi.fn<(path: string, encoding: string) => string>>;
  writeFile: ReturnType<typeof vi.fn<(path: string, data: string, encoding: string) => void>>;
  log: ReturnType<typeof vi.fn<(message: string) => void>>;
  error: ReturnType<typeof vi.fn<(message: string) => void>>;
  exit: ReturnType<typeof vi.fn<(code: number) => void>>;
}

function makeHarness(opts: {
  branch?: string;
  composeRunning?: boolean;
  databaseExists?: boolean;
  mainEnvExists?: boolean;
  localEnvExists?: boolean;
  localEnvRaw?: string;
}): Harness {
  const { mainEnvExists = true, localEnvExists = false, localEnvRaw = "" } = opts;
  return {
    exec: makeExec(opts),
    fileExists: vi.fn((path: string) => {
      if (path === MAIN_ENV_PATH) return mainEnvExists;
      if (path === LOCAL_ENV_PATH) return localEnvExists;
      return false;
    }),
    readFile: vi.fn((path: string) => {
      if (path === MAIN_ENV_PATH) return MAIN_ENV_RAW;
      if (path === LOCAL_ENV_PATH) return localEnvRaw;
      throw new Error(`unexpected readFile(${path})`);
    }),
    writeFile: vi.fn(),
    log: vi.fn(),
    error: vi.fn(),
    exit: vi.fn(),
  };
}

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
    'NEXTAUTH_SECRET="placeholder-placeholder-placeholder"',
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
        'NEXTAUTH_SECRET="placeholder-placeholder-placeholder"',
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

// TEST-2 (docs/specs/core-testing.md): `pnpm db:branch` now provisions a
// database inside the Compose Postgres instead of a Neon branch, named
// `buycarmap_` plus the sanitized branch name.
describe("databaseName", () => {
  it.each([
    ["chore/adopt-testing", "buycarmap_chore_adopt_testing"],
    ["claude/Fix-Map.v2", "buycarmap_claude_fix_map_v2"],
  ])(
    "TEST-2: lowercases, replaces non a-z0-9 with _ and collapses runs — %s",
    (branch, expected) => {
      expect(databaseName(branch)).toBe(expected);
    },
  );

  it("TEST-2: cuts a name over 63 bytes to 54 characters plus _ and 8 hex chars of the branch's SHA-1", () => {
    const branch =
      "feat/this-is-an-extremely-long-branch-name-that-will-definitely-exceed-the-postgres-limit";

    // Hand-derived independently of databaseName, applying the rule TEST-2
    // states, not by calling the function under test:
    //   1. sanitized = branch.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_")
    //        = "feat_this_is_an_extremely_long_branch_name_that_will_definitely_exceed_the_postgres_limit"
    //   2. full = "buycarmap_" + sanitized, 99 bytes — over the 63-byte Postgres limit.
    //   3. sha1("feat/this-is-an-extremely-long-branch-name-that-will-definitely-exceed-the-postgres-limit")
    //        = "a5269c52d5eb420dc27974fee98e8ca31e4d5893" -> first 8 hex chars: "a5269c52"
    //   4. result = full.slice(0, 54) + "_" + "a5269c52"
    //        = "buycarmap_feat_this_is_an_extremely_long_branch_name_t" + "_a5269c52"
    const expected = "buycarmap_feat_this_is_an_extremely_long_branch_name_t_a5269c52";
    expect(expected).toHaveLength(63);
    expect(createHash("sha1").update(branch).digest("hex").slice(0, 8)).toBe("a5269c52");

    expect(databaseName(branch)).toBe(expected);
  });
});

// TEST-3 (docs/specs/core-testing.md), worked examples: `pnpm db:branch` and
// `pnpm db:branch:rm` must never connect to a non-local host.
describe("assertLocalUrl", () => {
  it("TEST-3: allows a localhost URL", () => {
    expect(() =>
      assertLocalUrl("postgresql://postgres:postgres@localhost:5433/buycarmap_x"),
    ).not.toThrow();
  });

  it("TEST-3: allows a 127.0.0.1 URL", () => {
    expect(() =>
      assertLocalUrl("postgresql://postgres:postgres@127.0.0.1:5433/buycarmap_x"),
    ).not.toThrow();
  });

  it("TEST-3: refuses a Neon host, naming it in the error", () => {
    const url = "postgresql://u:p@ep-dawn-recipe.c-2.eu-central-1.aws.neon.tech/neondb";

    expect(() => assertLocalUrl(url)).toThrow(/ep-dawn-recipe\.c-2\.eu-central-1\.aws\.neon\.tech/);
  });
});

// TEST-2/TEST-3: `main` with every side effect injected as a fake — no real
// git, Docker or Postgres. Hand-derived expected values:
//   databaseName("feature/x")     = "buycarmap_feature_x"
//   withDatabase(default, that)   = "postgresql://postgres:postgres@localhost:5433/buycarmap_feature_x"
describe("main", () => {
  const TARGET_URL = "postgresql://postgres:postgres@localhost:5433/buycarmap_feature_x";

  it("TEST-2: creates a missing database, migrates it and writes the worktree .env", async () => {
    const h = makeHarness({ branch: "feature/x", databaseExists: false });

    await main({
      argv: [],
      exec: h.exec,
      fileExists: h.fileExists,
      readFile: h.readFile,
      writeFile: h.writeFile,
      env: {},
      log: h.log,
      error: h.error,
      exit: h.exit,
    });

    expect(h.exec).toHaveBeenCalledWith(
      "docker",
      expect.arrayContaining(["-c", 'CREATE DATABASE "buycarmap_feature_x"']),
      expect.anything(),
    );
    expect(h.exec).toHaveBeenCalledWith(
      "pnpm",
      ["exec", "prisma", "migrate", "deploy"],
      expect.objectContaining({ env: expect.objectContaining({ DATABASE_URL: TARGET_URL }) }),
    );
    expect(h.writeFile).toHaveBeenCalledWith(
      LOCAL_ENV_PATH,
      setEnvValue(MAIN_ENV_RAW, "DATABASE_URL", TARGET_URL),
      "utf8",
    );
    expect(h.log.mock.calls.flat().join("\n")).toContain('created database "buycarmap_feature_x"');
    expect(h.exit).not.toHaveBeenCalled();
  });

  it("TEST-2: reuses an existing database instead of creating it", async () => {
    const h = makeHarness({ branch: "feature/x", databaseExists: true });

    await main({
      exec: h.exec,
      fileExists: h.fileExists,
      readFile: h.readFile,
      writeFile: h.writeFile,
      env: {},
      log: h.log,
      error: h.error,
      exit: h.exit,
    });

    expect(h.exec).not.toHaveBeenCalledWith(
      "docker",
      expect.arrayContaining(["-c", expect.stringContaining("CREATE DATABASE")]),
      expect.anything(),
    );
    expect(h.log.mock.calls.flat().join("\n")).toContain(
      'reusing existing database "buycarmap_feature_x"',
    );
    // Reusing still migrates and writes .env — only the create step is skipped.
    expect(h.exec).toHaveBeenCalledWith(
      "pnpm",
      ["exec", "prisma", "migrate", "deploy"],
      expect.anything(),
    );
  });

  it("TEST-2: --delete drops the current branch's database and does not migrate or write .env", async () => {
    const h = makeHarness({ branch: "feature/x" });

    await main({
      argv: ["--delete"],
      exec: h.exec,
      fileExists: h.fileExists,
      readFile: h.readFile,
      writeFile: h.writeFile,
      env: {},
      log: h.log,
      error: h.error,
      exit: h.exit,
    });

    expect(h.exec).toHaveBeenCalledWith(
      "docker",
      expect.arrayContaining(["-c", 'DROP DATABASE IF EXISTS "buycarmap_feature_x" WITH (FORCE)']),
      expect.anything(),
    );
    expect(h.exec).not.toHaveBeenCalledWith("pnpm", expect.anything(), expect.anything());
    expect(h.writeFile).not.toHaveBeenCalled();
    expect(h.log.mock.calls.flat().join("\n")).toContain('dropped database "buycarmap_feature_x"');
  });

  it("TEST-2: --delete <name> drops the named branch's database, not the current one", async () => {
    const h = makeHarness({ branch: "feature/x" });

    await main({
      argv: ["--delete", "other-branch"],
      exec: h.exec,
      fileExists: h.fileExists,
      readFile: h.readFile,
      writeFile: h.writeFile,
      env: {},
      log: h.log,
      error: h.error,
      exit: h.exit,
    });

    // Hand-derived: databaseName("other-branch") = "buycarmap_other_branch".
    expect(h.exec).toHaveBeenCalledWith(
      "docker",
      expect.arrayContaining([
        "-c",
        'DROP DATABASE IF EXISTS "buycarmap_other_branch" WITH (FORCE)',
      ]),
      expect.anything(),
    );
  });

  it('TEST-3: compose not running fails with "Run `pnpm db:up` first" and touches neither create nor migrate', async () => {
    const h = makeHarness({ branch: "feature/x", composeRunning: false });

    await main({
      exec: h.exec,
      fileExists: h.fileExists,
      readFile: h.readFile,
      writeFile: h.writeFile,
      env: {},
      log: h.log,
      error: h.error,
      exit: h.exit,
    });

    expect(h.error.mock.calls.flat().join("\n")).toContain("Run `pnpm db:up` first");
    expect(h.exit).toHaveBeenCalledWith(1);
    expect(h.exec).not.toHaveBeenCalledWith("pnpm", expect.anything(), expect.anything());
    expect(h.writeFile).not.toHaveBeenCalled();
  });

  it("fails when the main checkout has no .env, without reading or writing anything", async () => {
    const h = makeHarness({ mainEnvExists: false });

    await main({
      exec: h.exec,
      fileExists: h.fileExists,
      readFile: h.readFile,
      writeFile: h.writeFile,
      env: {},
      log: h.log,
      error: h.error,
      exit: h.exit,
    });

    expect(h.error.mock.calls.flat().join("\n")).toContain("No .env found in the main checkout");
    expect(h.exit).toHaveBeenCalledWith(1);
    expect(h.readFile).not.toHaveBeenCalled();
  });

  it("TEST-3: rejects instead of connecting when LOCAL_DATABASE_ADMIN_URL overrides to a non-local host", async () => {
    const h = makeHarness({ branch: "feature/x" });

    await expect(
      main({
        exec: h.exec,
        fileExists: h.fileExists,
        readFile: h.readFile,
        writeFile: h.writeFile,
        env: {
          LOCAL_DATABASE_ADMIN_URL: "postgresql://u:p@ep-x.eu-central-1.aws.neon.tech/neondb",
        },
        log: h.log,
        error: h.error,
        exit: h.exit,
      }),
    ).rejects.toThrow(/ep-x\.eu-central-1\.aws\.neon\.tech/);
  });

  it("writes the worktree's own existing .env as the base, not the main checkout's, preserving a secret only the worktree has", async () => {
    const h = makeHarness({
      branch: "feature/x",
      localEnvExists: true,
      localEnvRaw: 'NEXTAUTH_SECRET="worktree-only-secret-32-characters"\n',
    });

    await main({
      exec: h.exec,
      fileExists: h.fileExists,
      readFile: h.readFile,
      writeFile: h.writeFile,
      env: {},
      log: h.log,
      error: h.error,
      exit: h.exit,
    });

    expect(h.writeFile).toHaveBeenCalledWith(
      LOCAL_ENV_PATH,
      setEnvValue(
        'NEXTAUTH_SECRET="worktree-only-secret-32-characters"\n',
        "DATABASE_URL",
        TARGET_URL,
      ),
      "utf8",
    );
  });
});
