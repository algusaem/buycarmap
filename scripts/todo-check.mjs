// Fails when a code comment holds the to-do marker with no issue reference. Biome has
// no rule for this, so it runs as its own step in `lint`. See
// docs/specs/core-tooling.md TOOLING-12 for the worked examples.

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import ts from "typescript";

import { trackedFiles as gitTrackedFiles } from "./git-files.mjs";

const TODO_WORD = /\bTODO\b/;
const ISSUE_REFERENCE = /#\d+/;
const CSS_COMMENT = /\/\*[\s\S]*?\*\//g;
const TRACKED_EXTENSIONS = new Set([".ts", ".tsx", ".mjs", ".cjs", ".js", ".css"]);

/** @typedef {{ path: string, text: string }} TodoCheckFile */
/** @typedef {{ path: string, line: number }} TodoCheckHit */
/** @typedef {{ pos: number, end: number }} TextRange */

/**
 * The `ts.ScriptKind` a path's extension parses as, or `undefined` for an extension
 * `findUnreferencedTodos` does not scan as a script (CSS, or an unknown extension).
 *
 * @param {string} path
 * @returns {import("typescript").ScriptKind | undefined}
 */
function scriptKindForPath(path) {
  if (path.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (path.endsWith(".ts")) return ts.ScriptKind.TS;
  if (path.endsWith(".mjs") || path.endsWith(".cjs") || path.endsWith(".js")) {
    return ts.ScriptKind.JS;
  }
  return undefined;
}

/**
 * @param {Map<number, TextRange>} rangesByPos
 * @param {readonly TextRange[] | undefined} ranges
 * @returns {void}
 */
function addRanges(rangesByPos, ranges) {
  for (const range of ranges ?? []) {
    if (!rangesByPos.has(range.pos)) rangesByPos.set(range.pos, range);
  }
}

/**
 * Every comment range in a script file, found by walking the parsed AST rather than by
 * pattern over the text: a regex cannot tell a comment from a regex literal, a string,
 * or a lone `*` that looks like a JSDoc continuation but is code (a multiplication with
 * a missing left operand). Trailing comments on the last real token are only reachable
 * through the source file's `endOfFileToken`, which `ts.forEachChild` does not visit.
 *
 * @param {string} path
 * @param {string} text
 * @param {import("typescript").ScriptKind} scriptKind
 * @returns {TextRange[]}
 */
function scriptCommentRanges(path, text, scriptKind) {
  const sourceFile = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, scriptKind);

  /** @type {Map<number, TextRange>} */
  const rangesByPos = new Map();

  /** @param {import("typescript").Node} node */
  function visit(node) {
    addRanges(rangesByPos, ts.getLeadingCommentRanges(text, node.getFullStart()));
    addRanges(rangesByPos, ts.getTrailingCommentRanges(text, node.getEnd()));
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  const eof = sourceFile.endOfFileToken;
  addRanges(rangesByPos, ts.getLeadingCommentRanges(text, eof.getFullStart()));
  addRanges(rangesByPos, ts.getTrailingCommentRanges(text, eof.getEnd()));

  return [...rangesByPos.values()].sort((a, b) => a.pos - b.pos);
}

/**
 * Every `/* ... *\/` span in a CSS file. CSS has no line comments and no strings a
 * `/*` could hide inside, so a pattern over the text is enough.
 *
 * @param {string} text
 * @returns {TextRange[]}
 */
function cssCommentRanges(text) {
  return [...text.matchAll(CSS_COMMENT)].map((match) => ({
    pos: match.index,
    end: match.index + match[0].length,
  }));
}

/**
 * The 1-based physical line number of an offset into `text`.
 *
 * @param {string} text
 * @param {number} offset
 * @returns {number}
 */
function lineAt(text, offset) {
  let line = 1;
  for (let i = 0; i < offset; i++) {
    if (text[i] === "\n") line++;
  }
  return line;
}

/**
 * The hits a single comment range holds: every physical line inside it whose text
 * carries the to-do marker with no issue reference on that same line.
 *
 * @param {string} path
 * @param {string} text
 * @param {TextRange} range
 * @returns {TodoCheckHit[]}
 */
function hitsInRange(path, text, range) {
  const startLine = lineAt(text, range.pos);
  const lines = text.slice(range.pos, range.end).split(/\r?\n/);
  const hits = [];
  lines.forEach((lineText, index) => {
    if (TODO_WORD.test(lineText) && !ISSUE_REFERENCE.test(lineText)) {
      hits.push({ path, line: startLine + index });
    }
  });
  return hits;
}

/**
 * The lines across the given files whose comment holds the to-do marker with no issue
 * reference (`#<number>` in the same comment, on the same line). Comments are found by
 * parsing, not by pattern: TypeScript's own scanner for script files, `/* *\/` spans for
 * CSS. A path whose extension is neither reports no hits.
 *
 * @param {TodoCheckFile[]} files
 * @returns {TodoCheckHit[]}
 */
export function findUnreferencedTodos(files) {
  const hits = [];
  for (const { path, text } of files) {
    if (path.endsWith(".css")) {
      for (const range of cssCommentRanges(text)) hits.push(...hitsInRange(path, text, range));
      continue;
    }
    const scriptKind = scriptKindForPath(path);
    if (scriptKind === undefined) continue;
    for (const range of scriptCommentRanges(path, text, scriptKind)) {
      hits.push(...hitsInRange(path, text, range));
    }
  }
  return hits;
}

/** @returns {string[]} */
function trackedFiles() {
  return gitTrackedFiles().filter((path) =>
    TRACKED_EXTENSIONS.has(path.slice(path.lastIndexOf("."))),
  );
}

async function main() {
  const paths = trackedFiles().filter((path) => existsSync(path));
  const files = await Promise.all(
    paths.map(async (path) => ({ path, text: await readFile(path, "utf8") })),
  );

  const hits = findUnreferencedTodos(files);

  if (hits.length > 0) {
    for (const { path, line } of hits) {
      console.error(`${path}:${line}  TODO without an issue reference`);
    }
    process.exit(1);
  }

  console.log(`todo:check passed - ${files.length} file(s) scanned.`);
}

// Guarded so `findUnreferencedTodos` can be imported by the colocated test
// without the check running as a side effect of `import`.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
