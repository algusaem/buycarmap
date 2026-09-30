// Checks that the documentation still points at things that exist.
//
// Four checks, all mechanical:
//
//   1. Every internal markdown link resolves — the file exists, and the #anchor
//      exists in it.
//   2. Every source path a doc names in backticks exists.
//   3. Every .md under docs/ is reachable by links from the root README.md.
//   4. The ownership map in README.md resolves, and claims every tracked
//      source file — not merely every top-level directory, which was the
//      original rule and let 38 files go unclaimed while this reported green.
//
// What it deliberately does NOT do is fail because a change touched no doc: a
// script cannot tell which changes need one. That judgment, and whether prose is
// still *true*, lives in the check-docs review that /check-all runs;
// this script only catches what a script can actually know.
//
// Kept dependency-free, like spec-check.mjs and db-branch.mjs, so it runs in a
// fresh worktree with no node_modules.

import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { trackedFiles as gitTrackedFiles } from "./git-files.mjs";

const DOC_DIR = "docs";
// The documentation index: every doc under docs/ must be reachable from it, and
// it carries the ownership map under its "Ownership map" heading.
export const INDEX = "README.md";
// Docs are scanned for both links and source references. CLAUDE.md is in here
// deliberately: it carries more path references than any doc, and the 2026-08-03
// audit found two of them stale.
const SCANNED = [INDEX, "CLAUDE.md"];

// Backticked paths are only checked when they start with one of these. Anything
// else is prose, an upstream URL path, or a doc that a plan says will exist
// later — none of which this script has any business asserting about.
const SOURCE_ROOTS = [
  ".claude",
  ".github",
  "app",
  "components",
  "e2e",
  "interfaces",
  "lib",
  "prisma",
  "scripts",
  "server",
  "test",
  "types",
];

// Root-level files are owned too — proxy.ts is route protection, the configs
// decide how the app builds, tests and deploys, and .env.example is the
// reference every deployment copies from. Every SOURCE_ROOTS directory is
// owned as well, `.claude/commands` and `.github/workflows` included: both are
// committed, both change how the project behaves, both are described by a doc.
const OWNED_ROOT_FILE = /^([^/]+\.(tsx?|mjs|cjs)|\.env\.example)$/;

// Assets have no prose to govern them.
const NOT_SOURCE = /\.(ico|png|jpe?g|gif|svg|woff2?|ttf|webp)$/i;

// Generated and gitignored, so it is legitimately absent from a fresh clone
// until `prisma generate` runs.
const ALLOWED_MISSING = [/^app\/generated\//];

const EXTENSION = /\.(tsx?|mjs|cjs|jsx?|json|md|prisma|css|ya?ml|example|sql)$/;

// A backticked path is skipped when it is a pattern rather than a path: globs
// (`components/ui/*`), brace sets (`locales/{en,es}.ts`) and placeholders
// (`docs/specs/<area>.md`) all name a shape, not a file.
const IS_PATTERN = /[*{}<>$]/;

/** @typedef {{ glob: string, doc: string }} OwnershipEntry */

/**
 * @param {string} p
 * @returns {string}
 */
const posix = (p) => p.replace(/\\/g, "/");

/**
 * Strips fenced code blocks.
 *
 * The directory trees in CLAUDE.md live in fences and are written relative to
 * their parent (`wallapop/search/route.ts`), so scanning them would produce
 * nothing but false positives.
 *
 * @param {string} markdown
 * @returns {string}
 */
export function stripFences(markdown) {
  const out = [];
  let fenced = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      continue;
    }
    out.push(fenced ? "" : line);
  }
  return out.join("\n");
}

/**
 * GitHub's heading-slug rules: lowercase, drop punctuation, spaces to hyphens.
 *
 * Each whitespace character becomes its own hyphen — runs are **not** collapsed.
 * Removing punctuation leaves the spaces around it behind, so "Data & contracts"
 * anchors as `#data--contracts` with two. Collapsing here would reject that
 * perfectly valid link as pointing at a heading that does not exist.
 *
 * @param {string} heading
 * @returns {string}
 */
export function slugify(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s/g, "-");
}

/**
 * @param {string} markdown
 * @returns {Set<string>}
 */
export function headingSlugs(markdown) {
  const slugs = new Set();
  /** @type {Map<string, number>} */
  const seen = new Map();
  for (const [, text] of stripFences(markdown).matchAll(/^#{1,6}\s+(.+?)\s*$/gm)) {
    const base = slugify(text.replace(/`/g, ""));
    // Repeated headings get -1, -2, … appended, same as GitHub.
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    slugs.add(n === 0 ? base : `${base}-${n}`);
  }
  return slugs;
}

/**
 * `[text](target)` links, excluding external schemes and bare anchors handled separately.
 *
 * @param {string} markdown
 * @returns {string[]}
 */
export function extractLinks(markdown) {
  const links = [];
  for (const [, , target] of stripFences(markdown).matchAll(
    /\[((?:[^\]\\]|\\.)*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
  )) {
    if (/^(https?:|mailto:|tel:|#)/.test(target)) continue;
    links.push(decodeURI(target));
  }
  return links;
}

/**
 * Backticked strings that look like a path into this repository.
 *
 * @param {string} markdown
 * @returns {Set<string>}
 */
export function extractSourcePaths(markdown) {
  const paths = new Set();
  for (const [, code] of stripFences(markdown).matchAll(/`([^`\n]+)`/g)) {
    const candidate = code.trim().replace(/[.,;:)]+$/, "");
    if (IS_PATTERN.test(candidate)) continue;
    if (!candidate.includes("/")) continue;
    if (!SOURCE_ROOTS.some((root) => candidate.startsWith(`${root}/`))) continue;
    // Either a file with a recognised extension, or a directory reference.
    if (!EXTENSION.test(candidate) && !candidate.endsWith("/")) continue;
    paths.add(candidate.replace(/\/$/, ""));
  }
  return paths;
}

/**
 * Converts a glob with `*` and `**` into an anchored regular expression.
 *
 * @param {string} glob
 * @returns {RegExp}
 */
export function globToRegExp(glob) {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i];
    if (char === "*") {
      if (glob[i + 1] === "*") {
        out += ".*";
        i++;
        if (glob[i + 1] === "/") i++;
      } else {
        out += "[^/]*";
      }
      continue;
    }
    out += /[.+?^${}()|[\]\\]/.test(char) ? `\\${char}` : char;
  }
  return new RegExp(`^${out}$`);
}

/**
 * Reads the ownership table from the index, the root README.md.
 *
 * Rows look like `| \`lib/wallapop/**\` | [docs/specs/data-sources.md](…) |`, under
 * a heading whose slug contains "ownership".
 *
 * @param {string} markdown
 * @returns {OwnershipEntry[]}
 */
export function parseOwnership(markdown) {
  const lines = stripFences(markdown).split("\n");

  // Narrow to the section under the "Ownership…" heading, so an unrelated table
  // elsewhere in the index cannot be mistaken for the map.
  const start = lines.findIndex((line) => /^#{1,6}\s+.*ownership/i.test(line));
  const scope =
    start === -1
      ? lines
      : lines.slice(start + 1).slice(
          0,
          (() => {
            const level = lines[start].match(/^#+/)[0].length;
            const end = lines
              .slice(start + 1)
              .findIndex((line) => new RegExp(`^#{1,${level}}\\s`).test(line));
            return end === -1 ? undefined : end;
          })(),
        );

  /** @type {OwnershipEntry[]} */
  const entries = [];
  for (const line of scope) {
    const match = line.match(/^\|\s*`([^`]+)`\s*\|\s*(.+?)\s*\|/);
    if (!match) continue;
    const doc = match[2].match(/\]\(([^)\s]+)\)/)?.[1] ?? match[2].replace(/`/g, "");
    entries.push({ glob: match[1].trim(), doc: doc.trim() });
  }
  return entries;
}

/**
 * Whether an ownership row declares "not documented yet" rather than a doc.
 *
 * The alternative — pointing an undocumented area at some loosely related file
 * so the check goes green — would make the map lie, and the map is what
 * /check-all reads to decide which docs a change must touch. An explicit gap is
 * honest, stays visible in every run's output, and can be counted down.
 *
 * @param {string} doc
 * @returns {boolean}
 */
export const isGap = (doc) => /^(—|-{1,2}|tbd|none)$/i.test(doc.trim());

/**
 * Whether a doc is a spec that describes software which does not exist yet.
 *
 * A spec names the models, actions and routes it proposes before any of them are
 * written — that is the entire point of writing it first. So path checking keys
 * off `Status`, and only `Implemented` is checked:
 *
 *   Draft        proposed, nothing built
 *   Approved     agreed and tests written, still nothing built
 *   Implemented  built and green — a path that does not resolve is a real error
 *   Superseded   describes code that has since been removed
 *
 * `Approved` is the one that looks safe to check and is not. Per the status
 * table in the root README.md it means the failing tests have landed and the
 * implementation has not, which is precisely when the paths named in Data
 * model and Contracts are all absent.
 *
 * @param {string} file
 * @param {string} text
 * @returns {boolean}
 */
export function isUnbuiltSpec(file, text) {
  if (!posix(file).startsWith("docs/specs/")) return false;
  return !/^Status:\s*Implemented\s*$/im.test(text);
}

/**
 * Whether a doc is a dated record whose source paths are not checked: an ADR under
 * `docs/decisions/`. See docs/specs/core-layout.md LAYOUT-4.
 *
 * @param {string} file
 * @returns {boolean}
 */
export function isDatedRecord(file) {
  return posix(file).startsWith("docs/decisions/");
}

/**
 * The docs not reached by following `linkGraph` outward from `roots`, out of
 * the given `docs`, in input order.
 *
 * A breadth-first walk: each file in `linkGraph` maps to the files it links to.
 * Kept pure so it can be exercised on an in-memory graph.
 *
 * @param {Map<string, string[]>} linkGraph
 * @param {string[]} roots
 * @param {string[]} docs
 * @returns {string[]}
 */
export function unreachableDocs(linkGraph, roots, docs) {
  /** @type {Set<string>} */
  const reachable = new Set(roots);
  /** @type {string[]} */
  const queue = [...reachable];
  // An array iterator re-reads the length on every step, so targets pushed
  // during the walk are visited in turn: breadth-first.
  for (const current of queue) {
    for (const target of linkGraph.get(current) ?? []) {
      if (reachable.has(target)) continue;
      reachable.add(target);
      queue.push(target);
    }
  }
  return docs.filter((doc) => !reachable.has(doc));
}

/**
 * The repo-relative posix path a `doc` cell in the ownership map resolves to,
 * relative to `indexPath`'s directory — the same resolution a markdown link
 * written in the index would get. The single source of truth both
 * `unresolvedOwnershipDocs` and `existingOwnershipDocs` resolve against, so
 * the two can never disagree about what a row points at.
 *
 * @param {string} indexPath
 * @param {string} doc
 * @returns {string}
 */
function ownershipDocPath(indexPath, doc) {
  return posix(relative(process.cwd(), resolve(dirname(posix(indexPath)), doc)));
}

/**
 * One problem per ownership row whose `doc` is not in `existing`.
 *
 * Declared gaps (`—`) name no doc and are skipped.
 *
 * @param {OwnershipEntry[]} entries
 * @param {string} indexPath
 * @param {Set<string>} existing
 * @returns {string[]}
 */
export function unresolvedOwnershipDocs(entries, indexPath, existing) {
  return entries
    .filter(({ doc }) => !isGap(doc) && !existing.has(ownershipDocPath(indexPath, doc)))
    .map(({ glob, doc }) => `${indexPath} maps \`${glob}\` to ${doc}, which does not exist.`);
}

/**
 * @param {string} path
 * @returns {Promise<boolean>}
 */
async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

// `.claude/worktrees/` holds entire checkouts, node_modules and all — walking it
// from the main checkout would traverse tens of thousands of irrelevant files.
const SKIP_DIRS = new Set([
  "node_modules",
  "worktrees",
  "generated",
  ".next",
  "coverage",
  "test-results",
  "playwright-report",
  "blob-report",
]);

/**
 * @param {string} dir
 * @param {string[]} [out]
 * @returns {Promise<string[]>}
 */
async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walk(path, out);
    } else {
      out.push(posix(path));
    }
  }
  return out;
}

/** @returns {Promise<string[]>} */
async function listRepoFiles() {
  /** @type {string[]} */
  const files = [];
  for (const root of SOURCE_ROOTS) {
    if (await exists(root)) await walk(root, files);
  }
  return files;
}

/**
 * Tracked files the ownership map is responsible for.
 *
 * `git ls-files` rather than a filesystem walk: it is exactly "what is in the
 * repository", so generated and gitignored output cannot drift into the list and
 * demand a doc. The same reasoning `db-branch.mjs` uses for shelling out to git.
 *
 * @param {string[]} tracked
 * @returns {string[]}
 */
export function ownableFiles(tracked) {
  return tracked.filter(
    (file) =>
      !NOT_SOURCE.test(file) &&
      !file.startsWith("app/generated/") &&
      (SOURCE_ROOTS.some((root) => file.startsWith(`${root}/`)) || OWNED_ROOT_FILE.test(file)),
  );
}

/** @returns {string[]} */
function trackedFiles() {
  return gitTrackedFiles().map(posix);
}

/**
 * The file a colocated test covers, or null when this is not a test.
 *
 * Tests sit next to their subject by house convention, so they inherit its
 * governing doc. Without this, every single-file ownership row would need a twin
 * for its test — and the twin would be forgotten.
 *
 * @param {string} file
 * @returns {string | null}
 */
export function testSubject(file) {
  const match = file.match(/^(.*?)\.(?:node\.)?(?:test|spec)\.(tsx?)$/);
  if (!match) return null;
  return `${match[1]}.${match[2]}`;
}

/** @typedef {(path: string) => Promise<Set<string>>} SlugsFor */

/** @returns {Promise<{ markdownDocs: string[], sources: Map<string, string> }>} */
async function loadScannedSources() {
  const docFiles = (await exists(DOC_DIR)) ? await walk(DOC_DIR) : [];
  const markdownDocs = docFiles.filter((f) => f.endsWith(".md"));
  const scanned = [...SCANNED, ...markdownDocs];

  // Read every scanned file once.
  /** @type {Map<string, string>} */
  const sources = new Map();
  for (const file of scanned) {
    if (!(await exists(file))) continue;
    sources.set(posix(file), await readFile(file, "utf8"));
  }

  return { markdownDocs, sources };
}

/**
 * @param {Map<string, string>} sources
 * @returns {SlugsFor}
 */
function createSlugsFor(sources) {
  /** @type {Map<string, Set<string>>} */
  const slugCache = new Map();
  return async (path) => {
    const cached = slugCache.get(path);
    if (cached) return cached;
    const text = sources.get(path) ?? (await readFile(path, "utf8"));
    const slugs = headingSlugs(text);
    slugCache.set(path, slugs);
    return slugs;
  };
}

/**
 * @param {string} file
 * @param {string} link
 * @param {SlugsFor} slugsFor
 * @param {string[]} targets
 * @param {string[]} problems
 * @returns {Promise<void>}
 */
async function checkLink(file, link, slugsFor, targets, problems) {
  const [rawPath, anchor] = link.split("#");
  const target = rawPath ? posix(relative(process.cwd(), resolve(dirname(file), rawPath))) : file;

  if (!(await exists(target))) {
    problems.push(`${file} links to ${link}, which does not exist.`);
    return;
  }
  targets.push(target);

  if (anchor && target.endsWith(".md")) {
    const slugs = await slugsFor(target);
    if (!slugs.has(anchor.toLowerCase())) {
      problems.push(`${file} links to ${link}, but ${target} has no heading "#${anchor}".`);
    }
  }
}

// --- 1. Internal links resolve, anchors included ---------------------------
/**
 * @param {Map<string, string>} sources
 * @param {SlugsFor} slugsFor
 * @param {string[]} problems
 * @returns {Promise<Map<string, string[]>>}
 */
async function checkLinks(sources, slugsFor, problems) {
  /** @type {Map<string, string[]>} */
  const linkGraph = new Map();
  for (const [file, text] of sources) {
    /** @type {string[]} */
    const targets = [];
    for (const link of extractLinks(text)) {
      await checkLink(file, link, slugsFor, targets, problems);
    }
    linkGraph.set(file, targets);
  }
  return linkGraph;
}

// --- 2. Backticked source paths exist ---------------------------------------
/**
 * @param {Map<string, string>} sources
 * @param {string[]} problems
 * @returns {Promise<void>}
 */
async function checkSourcePaths(sources, problems) {
  for (const [file, text] of sources) {
    if (isUnbuiltSpec(file, text)) continue;
    if (isDatedRecord(file)) continue;
    for (const path of extractSourcePaths(text)) {
      if (ALLOWED_MISSING.some((pattern) => pattern.test(path))) continue;
      if (!(await exists(path))) {
        problems.push(
          `${file} refers to \`${path}\`, which does not exist. Was it moved or deleted?`,
        );
      }
    }
  }
}

// --- 3. No orphaned docs -----------------------------------------------------
/**
 * @param {string[]} markdownDocs
 * @param {Map<string, string[]>} linkGraph
 * @param {string[]} problems
 * @returns {Promise<void>}
 */
async function checkOrphanedDocs(markdownDocs, linkGraph, problems) {
  if (!(await exists(INDEX))) {
    problems.push(`${INDEX} is missing — it is the documentation index.`);
    return;
  }

  const roots = [INDEX];
  for (const doc of unreachableDocs(linkGraph, roots, markdownDocs)) {
    problems.push(
      `${doc} is not reachable by links from ${INDEX}. ` +
        `An unlinked doc stops being read and starts being wrong — ` +
        `add it to the index or delete it.`,
    );
  }
}

/**
 * @param {OwnershipEntry} entry
 * @param {string[]} repoFiles
 * @param {string[]} problems
 * @param {string[]} gaps
 * @param {RegExp[]} patterns
 * @returns {void}
 */
function processOwnershipEntry(entry, repoFiles, problems, gaps, patterns) {
  const { glob, doc } = entry;
  const pattern = globToRegExp(glob);
  if (!repoFiles.some((file) => pattern.test(file))) {
    problems.push(`${INDEX} maps \`${glob}\` to ${doc}, but that pattern matches no file.`);
  }
  if (isGap(doc)) gaps.push(glob);
  patterns.push(pattern);
}

/**
 * The docs the ownership map names that exist on disk, as paths relative to
 * the repository root — the set `unresolvedOwnershipDocs` checks against.
 *
 * @param {OwnershipEntry[]} entries
 * @param {string} indexPath
 * @returns {Promise<Set<string>>}
 */
async function existingOwnershipDocs(entries, indexPath) {
  /** @type {Set<string>} */
  const existing = new Set();
  for (const { doc } of entries) {
    if (isGap(doc)) continue;
    const target = ownershipDocPath(indexPath, doc);
    if (await exists(target)) existing.add(target);
  }
  return existing;
}

/**
 * @param {string[]} tracked
 * @param {RegExp[]} patterns
 * @param {string[]} problems
 * @returns {void}
 */
function reportUnclaimedFiles(tracked, patterns, problems) {
  // Every tracked source file, not merely every top-level directory. A
  // colocated test is claimed by whatever claims the file it tests.
  /** @param {string} file */
  const isClaimed = (file) => patterns.some((pattern) => pattern.test(file));
  const unclaimed = ownableFiles(tracked).filter((file) => {
    if (isClaimed(file)) return false;
    const subject = testSubject(file);
    return !(subject && isClaimed(subject));
  });

  if (unclaimed.length > 0) {
    const shown = unclaimed.slice(0, 12);
    problems.push(
      `${unclaimed.length} tracked source file(s) are covered by no entry in ` +
        `${INDEX}'s ownership map:\n` +
        shown.map((f) => `      ${f}`).join("\n") +
        (unclaimed.length > shown.length
          ? `\n      … and ${unclaimed.length - shown.length} more`
          : "") +
        `\n    Add a row naming the governing doc, or \`—\` if there is none yet.`,
    );
  }
}

// --- 4. The ownership map is complete and resolves ---------------------------
/**
 * @param {Map<string, string>} sources
 * @param {string[]} problems
 * @param {string[]} gaps
 * @returns {Promise<void>}
 */
async function checkOwnershipMap(sources, problems, gaps) {
  const index = sources.get(INDEX);
  if (!index) return;

  const ownership = parseOwnership(index);
  if (ownership.length === 0) {
    problems.push(
      `${INDEX} declares no ownership map. /check-all reads it to work out ` +
        `which docs govern a change.`,
    );
  }

  // Tracked files, plus anything walked from the source roots — the latter
  // keeps a row valid when it names something legitimately untracked.
  const tracked = trackedFiles();
  const repoFiles = [...new Set([...tracked, ...(await listRepoFiles())])];
  /** @type {RegExp[]} */
  const patterns = [];

  for (const entry of ownership) {
    processOwnershipEntry(entry, repoFiles, problems, gaps, patterns);
  }
  problems.push(
    ...unresolvedOwnershipDocs(ownership, INDEX, await existingOwnershipDocs(ownership, INDEX)),
  );

  reportUnclaimedFiles(tracked, patterns, problems);
}

/**
 * @param {string[]} problems
 * @param {string[]} gaps
 * @param {Map<string, string>} sources
 * @param {string[]} markdownDocs
 * @returns {void}
 */
function reportResult(problems, gaps, sources, markdownDocs) {
  if (problems.length > 0) {
    console.error("docs:check failed\n");
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error(`\n${problems.length} problem(s).`);
    process.exit(1);
  }

  console.log(
    `docs:check passed - ${sources.size} file(s) scanned, ` +
      `${markdownDocs.length} doc(s) under ${DOC_DIR}/.`,
  );

  if (gaps.length > 0) {
    console.log(`\n${gaps.length} area(s) declared undocumented in ${INDEX}:`);
    for (const glob of gaps) console.log(`  - ${glob}`);
  }
}

/** @returns {Promise<void>} */
async function main() {
  /** @type {string[]} */
  const problems = [];
  /** @type {string[]} */
  const gaps = [];

  const { markdownDocs, sources } = await loadScannedSources();
  const slugsFor = createSlugsFor(sources);

  const linkGraph = await checkLinks(sources, slugsFor, problems);
  await checkSourcePaths(sources, problems);
  await checkOrphanedDocs(markdownDocs, linkGraph, problems);
  await checkOwnershipMap(sources, problems, gaps);

  reportResult(problems, gaps, sources, markdownDocs);
}

// Guarded so the helpers above can be imported by the colocated test without
// the check running as a side effect of `import`.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
