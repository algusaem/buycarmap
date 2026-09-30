// Checks that specs and tests still agree with each other.
//
// For every spec in docs/specs whose Status is Approved or Implemented, each
// acceptance criterion (KEY-n, declared by a `- [ ]`/`- [x] KEY-n · <level> —
// <statement>` checklist item) must be named by at least one test title. The
// reverse is also checked: a test naming KEY-n that no spec declares means a
// criterion was renumbered or deleted and left a dangling reference behind.
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
// The single source for both level regexes and the message hint below, so
// none of the three can ever list the levels differently.
const LEVELS = ["unit", "node", "component", "contract", "e2e"];
const LEVEL_ALTERNATION = LEVELS.join("|");
const LEVEL_CLAUSE = `(?:${LEVEL_ALTERNATION})(?: \\+ (?:${LEVEL_ALTERNATION}))*`;
// A valid level, immediately followed by a non-space statement.
const LEVEL_WITH_STATEMENT = new RegExp(`^ · ${LEVEL_CLAUSE} — \\S`);
// A valid level with nothing, or only a blank statement, after it — anything
// left over (an invalid level, or extra text before " — ") fails this too, so
// it falls through to "has no level" rather than being mistaken for a blank
// statement.
const LEVEL_WITHOUT_STATEMENT = new RegExp(`^ · ${LEVEL_CLAUSE}(?: —\\s*)?$`);
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
/** @typedef {{ name: string, key: string, status: string, declared: Set<string> }} ParsedSpec */

/**
 * The `Key:` and `Status:` header lines of a spec, however the caller needs
 * them: to decide whether it's enforced, or to explain why it isn't.
 *
 * @param {string} source
 * @returns {{ key: string | undefined, status: string | undefined }}
 */
function specHeader(source) {
  return {
    key: source.match(KEY_LINE)?.[1],
    status: source.match(STATUS_LINE)?.[1],
  };
}

/**
 * The checklist criteria a spec declares for its own key: every
 * `- [ ]`/`- [x] <key>-<n> …` line, with its checkbox state and whatever
 * follows the id on that line (the ` · <level> — <statement>` tail, checked
 * separately).
 *
 * @param {string} source
 * @param {string} key
 * @returns {{ id: string, checked: boolean, rest: string }[]}
 */
function checklistItemsIn(source, key) {
  const pattern = new RegExp(`^- \\[( |x)\\] (${key}-\\d+)(.*)$`, "gm");
  return [...source.matchAll(pattern)].map(([, box, id, rest]) => ({
    id,
    checked: box === "x",
    rest,
  }));
}

/**
 * One enforced spec's criteria, given the header its caller already parsed.
 * Pushes the per-criterion problems a checklist item can carry on its own,
 * independent of any test: a missing level, a level with no statement after
 * it, or an unchecked box in an `Implemented` spec.
 *
 * Takes `{ key, status }` rather than re-reading the header: `checkSpecs`
 * already parsed it once to decide this spec is enforced, and re-parsing it
 * here would make that two parses of the same spec.
 *
 * @param {SpecCheckSpecInput} spec
 * @param {{ key: string, status: string }} header
 * @param {string[]} problems
 * @returns {ParsedSpec}
 */
function parseEnforcedSpec(spec, { key, status }, problems) {
  const declared = new Set();
  for (const { id, checked, rest } of checklistItemsIn(spec.source, key)) {
    declared.add(id);

    if (!checked && status === "Implemented") {
      problems.push(
        `${id} (${spec.name}) is unchecked in an Implemented spec. Tick it once its test is green, or set Status back to Approved.`,
      );
    }

    if (LEVEL_WITH_STATEMENT.test(rest)) continue;

    if (LEVEL_WITHOUT_STATEMENT.test(rest)) {
      problems.push(
        `${id} (${spec.name}) has no statement. Write it as "- [ ] ${id} · <level> — <statement>".`,
      );
    } else {
      problems.push(
        `${id} (${spec.name}) has no level. Write it as "- [ ] ${id} · <${LEVEL_ALTERNATION}>[ + <level>…] — <statement>".`,
      );
    }
  }

  return { name: spec.name, key, status, declared };
}

/**
 * The criterion ids named by test titles, keyed to every test path that
 * names each one.
 *
 * @param {SpecCheckTestInput[]} tests
 * @returns {Map<string, Set<string>>}
 */
function referencedCriteria(tests) {
  const referenced = new Map();
  for (const test of tests) {
    for (const id of criteriaIdsIn(test.source)) {
      if (!referenced.has(id)) referenced.set(id, new Set());
      referenced.get(id).add(test.path);
    }
  }
  return referenced;
}

/**
 * A key used by two specs is ambiguous — a criterion id alone can't say which
 * spec declared it.
 *
 * @param {ParsedSpec[]} specs
 * @param {string[]} problems
 * @returns {Map<string, ParsedSpec>}
 */
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

/**
 * Every criterion an enforced spec declares must be named by at least one
 * test title, and a spec with none at all is reported outright.
 *
 * @param {ParsedSpec[]} specs
 * @param {Map<string, Set<string>>} referenced
 * @param {string[]} problems
 * @returns {void}
 */
function checkDeclaredCriteria(specs, referenced, problems) {
  for (const spec of specs) {
    if (spec.declared.size === 0) {
      problems.push(
        `${spec.name} is ${spec.status} but declares no acceptance criteria. ` +
          `Add checklist criteria, or set Status back to Draft.`,
      );
      continue;
    }
    for (const id of spec.declared) {
      if (!referenced.has(id)) {
        problems.push(
          `${id} (${spec.name}) is not named by any test title. ` +
            `Add a test titled "${id}: …", or remove the criterion.`,
        );
      }
    }
  }
}

/**
 * Dangling references: a test names KEY-n for a key we know, but the spec no
 * longer declares it. Unknown prefixes are ignored — they belong to something
 * else entirely (a ticket id, "SHA-1", a spec still in Draft). A spec that
 * declares nothing at all is also skipped here: `checkDeclaredCriteria`
 * already reports it outright, and re-flagging every id its tests happen to
 * mention would just pile noise on top of that one problem.
 *
 * @param {Map<string, Set<string>>} referenced
 * @param {Map<string, ParsedSpec>} byKey
 * @param {string[]} problems
 * @returns {void}
 */
function checkDanglingReferences(referenced, byKey, problems) {
  for (const [id, files] of referenced) {
    const key = id.slice(0, id.lastIndexOf("-"));
    const spec = byKey.get(key);
    if (!spec || spec.declared.size === 0 || spec.declared.has(id)) continue;
    problems.push(
      `${id} is named by ${[...files].join(", ")} but ${spec.name} does not ` +
        `declare it. Criteria are append-only — was it renumbered?`,
    );
  }
}

/**
 * `spec:check`'s single pass over the given specs and tests, read from
 * in-memory sources rather than the working tree: every problem, plus the
 * enforced/skipped split the report line needs. One parse per spec — nothing
 * downstream reparses it to get the counts.
 *
 * @param {SpecCheckSpecInput[]} specs
 * @param {SpecCheckTestInput[]} tests
 * @returns {{ problems: string[], enforced: ParsedSpec[], skipped: { name: string, reason: string }[] }}
 */
export function checkSpecs(specs, tests) {
  const problems = [];
  const enforced = [];
  const skipped = [];

  for (const spec of specs) {
    const { key, status } = specHeader(spec.source);
    if (key && ENFORCED_STATUSES.has(status ?? "")) {
      enforced.push(parseEnforcedSpec(spec, { key, status }, problems));
      continue;
    }
    skipped.push({
      name: spec.name,
      reason: key ? `status ${status ?? "missing"}` : "no Key: header (legacy format)",
    });
  }

  const byKey = checkDuplicateKeys(enforced, problems);
  const referenced = referencedCriteria(tests);

  checkDeclaredCriteria(enforced, referenced, problems);
  checkDanglingReferences(referenced, byKey, problems);

  return { problems, enforced, skipped };
}

/**
 * @param {string} base The repository root to walk from — readdir'd against,
 *   but never itself part of a returned path, so paths stay repo-relative
 *   (`app/foo.test.ts`) exactly as they were before `base` was injectable.
 * @param {string} dir
 * @param {string[]} out
 * @returns {Promise<string[]>}
 */
async function walk(base, dir = ".", out = []) {
  for (const entry of await readdir(join(base, dir), { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".github") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walk(base, path, out);
    } else if (TEST_FILE.test(entry.name)) {
      out.push(path);
    }
  }
  return out;
}

/**
 * The spec files `spec:check` considers — `docs/specs/*.md`, excluding `_*`
 * templates and `README.md` — read into the shape `checkSpecs` takes.
 *
 * @param {string} cwd
 * @returns {Promise<SpecCheckSpecInput[]>}
 */
async function readSpecFiles(cwd) {
  const specs = [];
  for (const file of await readdir(join(cwd, SPEC_DIR))) {
    if (!file.endsWith(".md") || file.startsWith("_") || file === "README.md") continue;
    const path = join(SPEC_DIR, file);
    specs.push({ name: posix(path), source: await readFile(join(cwd, path), "utf8") });
  }
  return specs;
}

/**
 * Every walked test file, read into the shape `checkSpecs` takes.
 *
 * @param {string[]} paths
 * @param {string} cwd
 * @returns {Promise<SpecCheckTestInput[]>}
 */
async function readTestFiles(paths, cwd) {
  return Promise.all(
    paths.map(async (path) => ({
      path: posix(path),
      source: await readFile(join(cwd, path), "utf8"),
    })),
  );
}

/**
 * @param {string[]} problems
 * @param {ParsedSpec[]} enforced
 * @param {{ name: string, reason: string }[]} skipped
 * @param {{ log: (message: string) => void, error: (message: string) => void, exit: (code: number) => void }} deps
 * @returns {void}
 */
function reportSpecCheckResult(problems, enforced, skipped, { log, error, exit }) {
  const counted = enforced.reduce((n, spec) => n + spec.declared.size, 0);

  if (problems.length > 0) {
    error("spec:check failed\n");
    for (const problem of problems) error(`  - ${problem}`);
    error(`\n${problems.length} problem(s) across ${enforced.length} enforced spec(s).`);
    exit(1);
    return;
  }

  log(`spec:check passed - ${counted} criteria across ${enforced.length} enforced spec(s).`);

  for (const { name, reason } of skipped) {
    log(`  skipped ${name} (${reason})`);
  }
}

/**
 * TOOLING-safe seam: `cwd` and the reporting functions are injected, real
 * implementation as default, so the colocated test can run the whole check
 * against a throwaway fixture repository instead of this one.
 *
 * @param {{ cwd?: string, log?: (message: string) => void, error?: (message: string) => void, exit?: (code: number) => void }} [deps]
 */
export async function main({
  cwd = process.cwd(),
  log = console.log,
  error = console.error,
  exit = process.exit,
} = {}) {
  const specFiles = await readSpecFiles(cwd);
  const testFiles = await readTestFiles(await walk(cwd), cwd);

  const { problems, enforced, skipped } = checkSpecs(specFiles, testFiles);

  reportSpecCheckResult(problems, enforced, skipped, { log, error, exit });
}

// Guarded so `criteriaIdsIn` and `checkSpecs` can be imported by the colocated
// test without the check running as a side effect of `import`.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
