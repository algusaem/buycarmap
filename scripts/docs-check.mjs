// Checks that the documentation still points at things that exist.
//
// Four checks, all mechanical:
//
//   1. Every internal markdown link resolves — the file exists, and the #anchor
//      exists in it.
//   2. Every source path a doc names in backticks exists.
//   3. Every .md under docs/ is reachable by links from docs/README.md.
//   4. The ownership map in docs/README.md resolves, and claims every tracked
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

import { execFileSync } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Docs are scanned for both links and source references. CLAUDE.md is in here
// deliberately: it carries more path references than any doc, and the 2026-08-03
// audit found two of them stale.
const SCANNED = ["README.md", "CLAUDE.md"];
const DOC_DIR = "docs";
const INDEX = "docs/README.md";

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

// Generated at build time and gitignored, so it is legitimately absent in a
// fresh clone — which is exactly when this check runs in CI.
const ALLOWED_MISSING = [/^app\/generated\//];

const EXTENSION = /\.(tsx?|mjs|cjs|jsx?|json|md|prisma|css|ya?ml|example|sql)$/;

// A backticked path is skipped when it is a pattern rather than a path: globs
// (`components/ui/*`), brace sets (`locales/{en,es}.ts`) and placeholders
// (`docs/specs/<area>.md`) all name a shape, not a file.
const IS_PATTERN = /[*{}<>$]/;

const posix = (p) => p.replace(/\\/g, "/");

/**
 * Strips fenced code blocks.
 *
 * The directory trees in CLAUDE.md live in fences and are written relative to
 * their parent (`wallapop/search/route.ts`), so scanning them would produce
 * nothing but false positives.
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
 */
export function slugify(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s/g, "-");
}

export function headingSlugs(markdown) {
  const slugs = new Set();
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

/** `[text](target)` links, excluding external schemes and bare anchors handled separately. */
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

/** Backticked strings that look like a path into this repository. */
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

/** Converts a glob with `*` and `**` into an anchored regular expression. */
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
 * Reads the ownership table from docs/README.md.
 *
 * Rows look like `| \`lib/wallapop/**\` | [integrations/wallapop.md](…) |`, under
 * a heading whose slug contains "ownership".
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
 * table in docs/specs/README.md it means the failing tests have landed and the
 * implementation has not, which is precisely when §5's paths are all absent.
 */
export function isUnbuiltSpec(file, text) {
  if (!posix(file).startsWith("docs/specs/")) return false;
  return !/^Status:\s*Implemented\s*$/im.test(text);
}

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

async function listRepoFiles() {
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
 */
export function ownableFiles(tracked) {
  return tracked.filter(
    (file) =>
      !NOT_SOURCE.test(file) &&
      !file.startsWith("app/generated/") &&
      (SOURCE_ROOTS.some((root) => file.startsWith(`${root}/`)) || OWNED_ROOT_FILE.test(file)),
  );
}

function trackedFiles() {
  return execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean)
    .map(posix);
}

/**
 * The file a colocated test covers, or null when this is not a test.
 *
 * Tests sit next to their subject by house convention, so they inherit its
 * governing doc. Without this, every single-file ownership row would need a twin
 * for its test — and the twin would be forgotten.
 */
export function testSubject(file) {
  const match = file.match(/^(.*?)\.(?:node\.)?(?:test|spec)\.(tsx?)$/);
  if (!match) return null;
  return `${match[1]}.${match[2]}`;
}

async function loadScannedSources() {
  const docFiles = (await exists(DOC_DIR)) ? await walk(DOC_DIR) : [];
  const markdownDocs = docFiles.filter((f) => f.endsWith(".md"));
  const scanned = [...SCANNED, ...markdownDocs];

  // Read every scanned file once.
  const sources = new Map();
  for (const file of scanned) {
    if (!(await exists(file))) continue;
    sources.set(posix(file), await readFile(file, "utf8"));
  }

  return { markdownDocs, sources };
}

function createSlugsFor(sources) {
  const slugCache = new Map();
  return async (path) => {
    if (slugCache.has(path)) return slugCache.get(path);
    const text = sources.get(path) ?? (await readFile(path, "utf8"));
    const slugs = headingSlugs(text);
    slugCache.set(path, slugs);
    return slugs;
  };
}

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
async function checkLinks(sources, slugsFor, problems) {
  const linkGraph = new Map();
  for (const [file, text] of sources) {
    const targets = [];
    for (const link of extractLinks(text)) {
      await checkLink(file, link, slugsFor, targets, problems);
    }
    linkGraph.set(file, targets);
  }
  return linkGraph;
}

// --- 2. Backticked source paths exist ---------------------------------------
async function checkSourcePaths(sources, problems) {
  for (const [file, text] of sources) {
    if (isUnbuiltSpec(file, text)) continue;
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
async function checkOrphanedDocs(sources, markdownDocs, linkGraph, problems) {
  if (!(await exists(INDEX))) {
    problems.push(`${INDEX} is missing — it is the documentation index.`);
    return;
  }

  const reachable = new Set();
  const queue = [INDEX, ...SCANNED.filter((f) => sources.has(f))];
  while (queue.length > 0) {
    const current = queue.pop();
    if (reachable.has(current)) continue;
    reachable.add(current);
    for (const target of linkGraph.get(current) ?? []) queue.push(target);
  }
  for (const doc of markdownDocs) {
    if (reachable.has(doc)) continue;
    problems.push(
      `${doc} is not reachable by links from ${INDEX}. ` +
        `An unlinked doc stops being read and starts being wrong — ` +
        `add it to the index or delete it.`,
    );
  }
}

async function processOwnershipEntry(entry, repoFiles, problems, gaps, patterns) {
  const { glob, doc } = entry;
  const pattern = globToRegExp(glob);
  if (!repoFiles.some((file) => pattern.test(file))) {
    problems.push(`${INDEX} maps \`${glob}\` to ${doc}, but that pattern matches no file.`);
  }
  if (isGap(doc)) {
    gaps.push(glob);
  } else {
    const target = posix(relative(process.cwd(), resolve(dirname(INDEX), doc)));
    if (!(await exists(target))) {
      problems.push(`${INDEX} maps \`${glob}\` to ${doc}, which does not exist.`);
    }
  }
  patterns.push(pattern);
}

function reportUnclaimedFiles(tracked, patterns, problems) {
  // Every tracked source file, not merely every top-level directory. A
  // colocated test is claimed by whatever claims the file it tests.
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
  const patterns = [];

  for (const entry of ownership) {
    await processOwnershipEntry(entry, repoFiles, problems, gaps, patterns);
  }

  reportUnclaimedFiles(tracked, patterns, problems);
}

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

async function main() {
  const problems = [];
  const gaps = [];

  const { markdownDocs, sources } = await loadScannedSources();
  const slugsFor = createSlugsFor(sources);

  const linkGraph = await checkLinks(sources, slugsFor, problems);
  await checkSourcePaths(sources, problems);
  await checkOrphanedDocs(sources, markdownDocs, linkGraph, problems);
  await checkOwnershipMap(sources, problems, gaps);

  reportResult(problems, gaps, sources, markdownDocs);
}

// Guarded so the helpers above can be imported by the colocated test without
// the check running as a side effect of `import`.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
