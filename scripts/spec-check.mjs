// Checks that specs and tests still agree with each other.
//
// For every spec in docs/specs whose Status is Approved or Implemented, each
// acceptance criterion (KEY-n, declared in the leading cell of a table row)
// must be named by at least one test title. The reverse is also checked: a test
// naming KEY-n that no spec declares means a criterion was renumbered or
// deleted and left a dangling reference behind.
//
// This proves an id is *mentioned*, not that the assertion behind it is
// meaningful — /check-tests is the real quality gate. What it buys is that a
// criterion cannot be quietly dropped.

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SPEC_DIR = "docs/specs";
const ENFORCED_STATUSES = new Set(["Approved", "Implemented"]);
const TEST_FILE = /\.(test\.tsx?|spec\.ts)$/;
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  ".claude",
  "coverage",
  "test-results",
  "playwright-report",
  "blob-report",
  "generated",
]);

const KEY_LINE = /^Key:\s*([A-Z][A-Z0-9]{1,7})\s*$/m;
const STATUS_LINE = /^Status:\s*\**\s*([A-Za-z]+)/m;
const ID = /\b([A-Z][A-Z0-9]{1,7}-\d+)\b/g;
// `it("…")`, `test("…")`, `test.skip("…")`, `it.each([…])("…")`, `dbTest("…")`.
//
// Two forms this has to cope with, both load-bearing:
//
// The optional `(…)` before the title is the **curried** `it.each` call. The
// original pattern claimed to support `it.each` but only matched when the title
// followed the callee directly, so `it.each([…])("KEY-n: …")` — the ordinary
// way anyone writes a table test — was silently invisible. A criterion covered
// only that way was reported as having no test at all.
//
// The `dbTest` alias is how `e2e/*.spec.ts` gate the database-backed suite
// (`const dbTest = process.env.E2E_DB ? test : test.skip`). A criterion whose
// truth is a Postgres behaviour — `FOR UPDATE SKIP LOCKED`, say — can be proven
// nowhere else, so without this there is no way to satisfy the check short of
// writing a fake that proves itself.
const TEST_TITLE =
  /\b(?:it|test|dbTest)(?:\.\w+)*\s*(?:\([^()]*\)\s*)?\(\s*(["'`])((?:\\.|(?!\1).)*)\1/g;

const posix = (p) => p.replace(/\\/g, "/");

/**
 * The criterion ids named by test titles in one source file.
 *
 * Exported so the matching is pinned by a test: this regex is the entire
 * mechanism, and quietly narrowing it turns the check green by seeing less.
 */
export function criteriaIdsIn(source) {
  const ids = [];
  for (const [, , title] of source.matchAll(TEST_TITLE)) {
    for (const [, id] of title.matchAll(ID)) ids.push(id);
  }
  return ids;
}

/** @typedef {{ name: string, source: string }} SpecCheckSpecInput */
/** @typedef {{ path: string, source: string }} SpecCheckTestInput */

/**
 * The problems `spec:check` would report for the given specs and tests, read
 * from in-memory sources rather than the working tree.
 *
 * Stub: DOCS-2..4 (`docs/specs/core-docs.md`) call this with fixtures built
 * from the new checklist item format; it will absorb the fs-bound logic above
 * once that format lands.
 *
 * @param {SpecCheckSpecInput[]} _specs
 * @param {SpecCheckTestInput[]} _tests
 * @returns {string[]}
 */
export function findSpecProblems(_specs, _tests) {
  return [];
}

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".github") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walk(path, out);
    } else if (TEST_FILE.test(entry.name)) {
      out.push(path);
    }
  }
  return out;
}

async function readSpecs() {
  const specs = [];
  const skipped = [];

  for (const name of await readdir(SPEC_DIR)) {
    if (!name.endsWith(".md") || name.startsWith("_") || name === "README.md") {
      continue;
    }
    const path = join(SPEC_DIR, name);
    const source = await readFile(path, "utf8");
    const key = source.match(KEY_LINE)?.[1];
    const status = source.match(STATUS_LINE)?.[1];

    if (!key) {
      skipped.push({ name, reason: "no Key: header (legacy format)" });
      continue;
    }
    if (!ENFORCED_STATUSES.has(status ?? "")) {
      skipped.push({ name, reason: `status ${status ?? "missing"}` });
      continue;
    }

    // A criterion is declared by being the first cell of a table row.
    const declared = new Set();
    const rowId = new RegExp(`^\\|\\s*(${key}-\\d+)\\s*\\|`);
    for (const line of source.split("\n")) {
      const match = line.match(rowId);
      if (match) declared.add(match[1]);
    }

    specs.push({ name, path: posix(path), key, status, declared });
  }

  return { specs, skipped };
}

async function readTestReferences(files) {
  // id -> Set of files that name it in a test title.
  const referenced = new Map();

  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const id of criteriaIdsIn(source)) {
      if (!referenced.has(id)) referenced.set(id, new Set());
      referenced.get(id).add(posix(file));
    }
  }

  return referenced;
}

function checkDuplicateKeys(specs, problems) {
  const byKey = new Map();
  for (const spec of specs) {
    const clash = byKey.get(spec.key);
    if (clash) {
      problems.push(
        `Duplicate key ${spec.key}: used by both ${clash.name} and ${spec.name}. ` +
          `Keys must be unique — criterion ids are ambiguous otherwise.`,
      );
    }
    byKey.set(spec.key, spec);
  }
  return byKey;
}

function checkDeclaredCriteria(specs, referenced, problems) {
  for (const spec of specs) {
    if (spec.declared.size === 0) {
      problems.push(
        `${spec.path} is ${spec.status} but declares no acceptance criteria. ` +
          `Add a criteria table, or set Status back to Draft.`,
      );
      continue;
    }
    for (const id of spec.declared) {
      if (!referenced.has(id)) {
        problems.push(
          `${id} (${spec.path}) is not named by any test title. ` +
            `Add a test titled "${id}: …", or remove the criterion.`,
        );
      }
    }
  }
}

// Dangling references: a test names KEY-n for a key we know, but the spec no
// longer declares it. Unknown prefixes are ignored — they belong to something
// else entirely (a ticket id, "SHA-1", a spec still in Draft).
function checkDanglingReferences(referenced, byKey, problems) {
  for (const [id, files] of referenced) {
    const key = id.slice(0, id.lastIndexOf("-"));
    const spec = byKey.get(key);
    if (!spec || spec.declared.has(id)) continue;
    problems.push(
      `${id} is named by ${[...files].join(", ")} but ${spec.path} does not ` +
        `declare it. Criteria are append-only — was it renumbered?`,
    );
  }
}

function reportSpecCheckResult(problems, specs, skipped) {
  const counted = specs.reduce((n, spec) => n + spec.declared.size, 0);

  if (problems.length > 0) {
    console.error("spec:check failed\n");
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error(`\n${problems.length} problem(s) across ${specs.length} enforced spec(s).`);
    process.exit(1);
  }

  console.log(`spec:check passed - ${counted} criteria across ${specs.length} enforced spec(s).`);

  for (const { name, reason } of skipped) {
    console.log(`  skipped ${name} (${reason})`);
  }
}

async function main() {
  const specs = [];
  const problems = [];

  const { specs: parsed, skipped } = await readSpecs();
  specs.push(...parsed);

  const byKey = checkDuplicateKeys(specs, problems);

  const referenced = await readTestReferences(await walk("."));

  checkDeclaredCriteria(specs, referenced, problems);
  checkDanglingReferences(referenced, byKey, problems);

  reportSpecCheckResult(problems, specs, skipped);
}

// Guarded so `criteriaIdsIn` can be imported by the colocated test without the
// check running as a side effect of `import`.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
