import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Checks docs/specs/core-data-model.md's tree- and text-shaped criteria
// against prisma/schema.prisma and the docs it requires — the halves that
// need no database. DATA-2, DATA-4, DATA-9..16 are behavioural and live in
// their own colocated *.integration.test.ts files instead.

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (path: string) => readFileSync(join(ROOT, path), "utf8").replace(/\r\n/g, "\n");

const SCHEMA_PATH = "prisma/schema.prisma";
const schema = read(SCHEMA_PATH);

function modelNames(text: string): string[] {
  return [...text.matchAll(/^model (\w+) \{/gm)].map((m) => m[1]);
}

/** The text between `model <name> {` and the matching closing `}`. */
function modelBody(text: string, name: string): string {
  const match = text.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`, "m"));
  if (!match) throw new Error(`model ${name} not found in ${SCHEMA_PATH}`);
  return match[1];
}

const PRIMITIVE_TYPES = new Set(["String", "Int", "Float", "Boolean", "DateTime", "Json"]);

/** A field declaration line: two-space indent, name, then its type token. */
function fieldLines(body: string): { line: string; name: string; type: string }[] {
  return body
    .split("\n")
    .map((line) => {
      const match = line.match(/^ {2}(\w+)\s+(\w+)(\?|\[\])?/);
      if (!match) return null;
      return { line, name: match[1], type: match[2] };
    })
    .filter((entry): entry is { line: string; name: string; type: string } => entry !== null);
}

const MODELS = modelNames(schema);

/** The scalar field names a model's `@relation(fields: [...])` lines declare as foreign keys. */
function fkFieldNames(body: string): Set<string> {
  const names = new Set<string>();
  for (const match of body.matchAll(/@relation\(fields:\s*\[([^\]]+)\]/g)) {
    for (const fk of match[1].split(",").map((entry) => entry.trim())) {
      if (fk) names.add(fk);
    }
  }
  return names;
}

describe("DATA-1: every id is a UUIDv7 and every foreign key is @db.Uuid", () => {
  it("DATA-1: no model uses cuid()", () => {
    expect(schema).not.toMatch(/cuid\(\)/);
  });

  it("DATA-1: every model's @id field is String @id @default(uuid(7)) @db.Uuid", () => {
    const violations = MODELS.filter((name) => {
      const body = modelBody(schema, name);
      const idLine = body.split("\n").find((line) => / @id(\s|$)/.test(line));
      if (!idLine) return true;
      return !(idLine.includes("@default(uuid(7))") && idLine.includes("@db.Uuid"));
    });

    expect(violations).toEqual([]);
  });

  it("DATA-1: every <x>Id String relation field is @db.Uuid", () => {
    const violations: string[] = [];
    for (const name of MODELS) {
      const body = modelBody(schema, name);
      const fkNames = fkFieldNames(body);
      for (const { line, name: fieldName, type } of fieldLines(body)) {
        if (!fkNames.has(fieldName) || type !== "String") continue;
        if (!line.includes("@db.Uuid")) violations.push(`${name}.${fieldName}`);
      }
    }

    expect(violations).toEqual([]);
  });

  it("DATA-1: RateLimit.key and SourceHealth.source are @unique", () => {
    const rateLimitKey = modelBody(schema, "RateLimit")
      .split("\n")
      .find((line) => /^ {2}key\s/.test(line));
    const sourceHealthSource = modelBody(schema, "SourceHealth")
      .split("\n")
      .find((line) => /^ {2}source\s/.test(line));

    expect(rateLimitKey).toMatch(/@unique/);
    expect(sourceHealthSource).toMatch(/@unique/);
  });

  it("DATA-1: RateLimit, SourceHealth and VerificationToken each gain a UUID id field", () => {
    for (const name of ["RateLimit", "SourceHealth", "VerificationToken"]) {
      const body = modelBody(schema, name);
      const idLine = body.split("\n").find((line) => / @id(\s|$)/.test(line));
      expect(idLine, `${name} has no @id field`).toBeDefined();
    }
  });

  it("DATA-1 (worked example): a cuid()-defaulted id is named in the failure", () => {
    // The spec's own worked example: `model Favorite { id String @id @default(cuid()) … }`
    // must fail, naming Favorite.
    const favoriteBody = modelBody(schema, "Favorite");
    const favoriteIdLine = favoriteBody.split("\n").find((line) => / @id(\s|$)/.test(line));

    expect(favoriteIdLine).not.toContain("cuid()");
  });
});

describe("DATA-5: snake_case table and column mapping", () => {
  it('DATA-5: every model has @@map("<snake_plural>")', () => {
    const violations = MODELS.filter((name) => !/@@map\("/.test(modelBody(schema, name)));

    expect(violations).toEqual([]);
  });

  it('DATA-5: every multi-word scalar field has @map("<snake_case>")', () => {
    const violations: string[] = [];
    for (const name of MODELS) {
      const body = modelBody(schema, name);
      for (const { line, name: fieldName, type } of fieldLines(body)) {
        const isMultiWord = /^[a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)+$/.test(fieldName);
        if (!PRIMITIVE_TYPES.has(type) || !isMultiWord) continue;
        if (!line.includes('@map("')) violations.push(`${name}.${fieldName}`);
      }
    }

    expect(violations).toEqual([]);
  });

  it("DATA-5 (worked examples): AlertPollJob -> alert_poll_jobs, TwoFactorRecoveryCode -> two_factor_recovery_codes, createdAt -> created_at", () => {
    expect(modelBody(schema, "AlertPollJob")).toContain('@@map("alert_poll_jobs")');
    expect(modelBody(schema, "TwoFactorRecoveryCode")).toContain(
      '@@map("two_factor_recovery_codes")',
    );
    // createdAt -> created_at: at least one field line maps it exactly this way.
    expect(schema).toMatch(/createdAt\s+DateTime[^\n]*@map\("created_at"\)/);
  });
});

describe("DATA-6: every DateTime column is @db.Timestamptz(3)", () => {
  it("DATA-6: no scalar DateTime field is missing @db.Timestamptz(3)", () => {
    const violations: string[] = [];
    for (const name of MODELS) {
      const body = modelBody(schema, name);
      for (const { line, name: fieldName, type } of fieldLines(body)) {
        if (type !== "DateTime") continue;
        if (!line.includes("@db.Timestamptz(3)")) violations.push(`${name}.${fieldName}`);
      }
    }

    expect(violations).toEqual([]);
  });
});

describe("DATA-7: AlertPollJob.status is the AlertPollJobStatus enum", () => {
  it("DATA-7: enum AlertPollJobStatus declares pending, running and failed", () => {
    const match = schema.match(/enum AlertPollJobStatus \{([\s\S]*?)\n\}/);

    expect(match, "enum AlertPollJobStatus not found").toBeDefined();
    const body = match?.[1] ?? "";
    expect(body).toMatch(/\bpending\b/);
    expect(body).toMatch(/\brunning\b/);
    expect(body).toMatch(/\bfailed\b/);
  });

  it("DATA-7: AlertPollJob.status is typed AlertPollJobStatus, not String", () => {
    const body = modelBody(schema, "AlertPollJob");
    const statusLine = body.split("\n").find((line) => /^ {2}status\s/.test(line));

    expect(statusLine).toMatch(/\bAlertPollJobStatus\b/);
  });
});

describe("DATA-8: every model has the six standard columns", () => {
  const STANDARD_COLUMNS = ["createdAt", "updatedAt", "createdById", "updatedById", "deletedAt"];

  it("DATA-8: createdAt, updatedAt, createdById, updatedById and deletedAt are all present", () => {
    const violations: string[] = [];
    for (const name of MODELS) {
      const body = modelBody(schema, name);
      for (const column of STANDARD_COLUMNS) {
        if (!new RegExp(`^ {2}${column}\\s`, "m").test(body)) {
          violations.push(`${name}.${column}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("DATA-8: version Int @default(1) is present on every model", () => {
    const violations = MODELS.filter(
      (name) => !/^ {2}version\s+Int\s+@default\(1\)/m.test(modelBody(schema, name)),
    );

    expect(violations).toEqual([]);
  });
});

describe("DATA-17: every onDelete: Cascade is commented, and no relation lacks onDelete", () => {
  it("DATA-17: a line above every onDelete: Cascade explains why", () => {
    const lines = schema.split("\n");
    const violations: number[] = [];

    lines.forEach((line, index) => {
      if (!line.includes("onDelete: Cascade")) return;
      const previous = lines[index - 1]?.trim() ?? "";
      if (!previous.startsWith("//")) violations.push(index + 1);
    });

    expect(violations).toEqual([]);
  });

  it("DATA-17: every @relation(fields: ...) line declares an onDelete behaviour", () => {
    const relationLines = schema.split("\n").filter((line) => line.includes("@relation(fields:"));
    const violations = relationLines.filter((line) => !line.includes("onDelete:"));

    expect(violations).toEqual([]);
  });
});

describe("DATA-18: docs record the migration's decisions", () => {
  it("DATA-18: docs/decisions/0015-*.md exists", () => {
    const decisionsDir = join(ROOT, "docs/decisions");
    const files = existsSync(decisionsDir) ? readdirSync(decisionsDir) : [];
    const adrFiles = files.filter((name) => /^0015-.*\.md$/.test(name));

    expect(adrFiles.length).toBe(1);
  });

  it("DATA-18: ADR 0007 row 18 ends 'Resolved in phase 8'", () => {
    const adr = read("docs/decisions/0007-adopt-core-rules.md");
    const row = adr.split("\n").find((line) => line.trim().startsWith("| 18 |"));

    expect(row, "row 18 not found").toBeDefined();
    expect(row?.trim().endsWith("Resolved in phase 8 |")).toBe(true);
  });

  it("DATA-18: docs/ARCHITECTURE.md mentions UUIDv7, snake_case, deletedAt, version and 30 days", () => {
    const architecture = read("docs/ARCHITECTURE.md");
    const required = ["UUIDv7", "snake_case", "deletedAt", "version", "30 days"];
    const missing = required.filter((term) => !architecture.includes(term));

    expect(missing).toEqual([]);
  });

  it("DATA-18: docs/privacy/data-inventory.md mentions the 30-day retention", () => {
    expect(read("docs/privacy/data-inventory.md")).toContain("30 days");
  });
});

describe("DATA-3 (static half): no raw string id parameters in service/queries", () => {
  it("DATA-3: no `<x>Id: string` parameter in server/*/service.ts or server/*/queries.ts", () => {
    const serverDir = join(ROOT, "server");
    const violations: string[] = [];

    function checkFile(relPath: string): void {
      if (!/\/(service|queries)\.ts$/.test(relPath)) return;
      if (relPath.includes(".test.")) return;

      const text = read(`server${relPath}`);
      if (/\b\w+Id: string\b/.test(text)) violations.push(relPath);
    }

    function walk(dir: string, prefix: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const relPath = `${prefix}/${entry.name}`;
        if (entry.isDirectory()) {
          walk(join(dir, entry.name), relPath);
        } else {
          checkFile(relPath);
        }
      }
    }

    walk(serverDir, "");

    expect(violations).toEqual([]);
  });
});
