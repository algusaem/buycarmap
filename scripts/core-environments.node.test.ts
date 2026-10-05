import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Static checks against docs/specs/core-environments.md: ENV-1 (withdrawn),
// ENV-2 (region), ENV-6 (CI against the preview), ENV-7 (processor regions)
// and ENV-8 (docs and configuration record the change). None of these need a
// running app or a database — they read the working tree directly, the way
// scripts/core-better-auth.node.test.ts does. ENV-3, ENV-4 and ENV-5 have
// their own homes: scripts/migrate-deploy.node.test.ts, prisma/seed.node.test.ts
// and e2e/preview-smoke.spec.ts.

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (path: string) => readFileSync(join(ROOT, path), "utf8").replace(/\r\n/g, "\n");
const exists = (path: string) => existsSync(join(ROOT, path));
// Reads the file if it exists, "" otherwise, so a missing file fails the
// assertions below cleanly instead of throwing ENOENT out of the test body.
const readIfExists = (path: string) => (exists(path) ? read(path) : "");

/** Filesystem glob for a decisions-directory prefix: ADR 0019 starts life
 * untracked, so `git ls-files` (which only lists committed/staged paths)
 * cannot find it yet. */
function globDecisionFiles(prefix: string): string[] {
  const dir = join(ROOT, "docs/decisions");
  return readdirSync(dir).filter((name) => name.startsWith(prefix) && name.endsWith(".md"));
}

describe("ENV-1: the base branch stays master", () => {
  it("ENV-1: the spec's ENV-1 line says Withdrawn", () => {
    const spec = read("docs/specs/core-environments.md");
    const env1Line = spec.split("\n").find((line) => line.includes("ENV-1")) ?? "";

    expect(env1Line).toContain("Withdrawn");
  });
});

describe("ENV-2: vercel.json pins functions to fra1", () => {
  it("ENV-2: a root vercel.json exists", () => {
    expect(exists("vercel.json")).toBe(true);
  });

  it('ENV-2: its regions is exactly ["fra1"]', () => {
    const raw = readIfExists("vercel.json") || "{}";
    const parsed = JSON.parse(raw) as { regions?: unknown };

    expect(parsed.regions).toEqual(["fra1"]);
  });
});

describe("ENV-6: e2e-preview.yml runs the smoke suite against each preview deployment", () => {
  const WORKFLOW_PATH = ".github/workflows/e2e-preview.yml";
  const workflow = readIfExists(WORKFLOW_PATH);

  it("ENV-6: the workflow file exists", () => {
    expect(exists(WORKFLOW_PATH)).toBe(true);
  });

  it("ENV-6: triggers on deployment_status", () => {
    expect(workflow).toMatch(/(^|\n)on:\s*\n\s*deployment_status:/);
  });

  it("ENV-6: the job runs only when the deployment_status state is success", () => {
    expect(workflow).toMatch(/github\.event\.deployment_status\.state\s*==\s*['"]success['"]/);
  });

  it("ENV-6: the job excludes Production, running only for the Preview environment", () => {
    expect(workflow).toMatch(/Preview/);
    expect(workflow).not.toMatch(/deployment_status\.environment\s*==\s*['"]Production['"]/);
  });

  it("ENV-6: it runs e2e/preview-smoke.spec.ts", () => {
    expect(workflow).toContain("e2e/preview-smoke.spec.ts");
  });

  it("ENV-6: it sets E2E_BASE_URL from the deployment event's environment_url", () => {
    expect(workflow).toMatch(
      /E2E_BASE_URL:\s*\$\{\{\s*github\.event\.deployment_status\.environment_url\s*\}\}/,
    );
  });

  it("ENV-6: its job is named Preview smoke", () => {
    expect(workflow).toMatch(/name:\s*Preview smoke/);
  });
});

describe("ENV-7: every processor row has a region and a DPA", () => {
  const PROCESSORS_PATH = "docs/privacy/processors.md";

  it("ENV-7: no row reads phase 12 any more", () => {
    const processors = read(PROCESSORS_PATH);

    expect(processors.toLowerCase()).not.toContain("phase 12");
  });

  it("ENV-7: every processor row has a non-empty region and DPA cell", () => {
    const lines = read(PROCESSORS_PATH).split("\n");
    const headerIndex = lines.findIndex((line) => line.trim().startsWith("| Processor"));
    expect(headerIndex).toBeGreaterThan(-1);

    const headerCells = (lines[headerIndex] ?? "")
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    const regionIndex = headerCells.findIndex((cell) => /region/i.test(cell));
    const dpaIndex = headerCells.findIndex((cell) => /dpa/i.test(cell));
    expect(regionIndex).toBeGreaterThan(-1);
    expect(dpaIndex).toBeGreaterThan(-1);

    const rows: string[][] = [];
    for (let i = headerIndex + 2; i < lines.length; i++) {
      const line = lines[i] ?? "";
      if (!line.trim().startsWith("|")) break;
      rows.push(
        line
          .split("|")
          .slice(1, -1)
          .map((cell) => cell.trim()),
      );
    }
    expect(rows.length).toBeGreaterThan(0);

    for (const row of rows) {
      expect(row[regionIndex]).not.toBe("");
      expect(row[dpaIndex]).not.toBe("");
    }
  });
});

describe("ENV-8: docs and configuration record the change", () => {
  it("ENV-8: ADR 0007 rows 4 and 26 end 'Resolved in phase 12'", () => {
    const adr = read("docs/decisions/0007-adopt-core-rules.md");
    const row4 = adr.split("\n").find((line) => line.trimStart().startsWith("| 4 ")) ?? "";
    const row26 = adr.split("\n").find((line) => line.trimStart().startsWith("| 26 ")) ?? "";

    expect(row4.trimEnd()).toMatch(/Resolved in phase 12\s*\|$/);
    expect(row26.trimEnd()).toMatch(/Resolved in phase 12\s*\|$/);
  });

  it("ENV-8: ADR 0007 row 6 ends 'Kept permanently (ADR 0019)'", () => {
    const adr = read("docs/decisions/0007-adopt-core-rules.md");
    const row6 = adr.split("\n").find((line) => line.trimStart().startsWith("| 6 ")) ?? "";

    expect(row6.trimEnd()).toMatch(/Kept permanently \(ADR 0019\)\s*\|$/);
  });

  it("ENV-8: an ADR 0019 exists", () => {
    const files = globDecisionFiles("0019-");

    expect(files.length).toBeGreaterThan(0);
  });

  it("ENV-8: docs/ARCHITECTURE.md mentions the shared preview Neon branch", () => {
    const architecture = read("docs/ARCHITECTURE.md");

    expect(architecture).toMatch(/`preview` Neon branch|Neon branch `preview`/);
  });

  it("ENV-8: .env.example documents SEED_TARGET_HOST", () => {
    const envExample = read(".env.example");

    expect(envExample).toMatch(/^#?\s*SEED_TARGET_HOST=/m);
  });
});
