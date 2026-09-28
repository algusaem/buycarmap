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
const SCRIPT_EXTENSIONS = new Set([".ts", ".tsx", ".mjs", ".cjs", ".js"]);
const TRACKED_EXTENSIONS = new Set([...SCRIPT_EXTENSIONS, ".css"]);

/** @typedef {{ path: string, text: string }} TodoCheckFile */
/** @typedef {{ path: string, line: number }} TodoCheckHit */
/** @typedef {{ pos: number, end: number }} TextRange */

/**
 * A `ts.LanguageServiceHost` over a single in-memory file, so
 * `getSyntacticClassifications` can run on a path this process never wrote to disk.
 *
 * @param {string} path
 * @param {string} text
 * @returns {import("typescript").LanguageServiceHost}
 */
function singleFileHost(path, text) {
  const snapshot = ts.ScriptSnapshot.fromString(text);
  return {
    getScriptFileNames: () => [path],
    getScriptVersion: () => "0",
    getScriptSnapshot: (fileName) => (fileName === path ? snapshot : undefined),
    getCurrentDirectory: () => "",
    getCompilationSettings: () => ({ allowJs: true, jsx: ts.JsxEmit.Preserve }),
    getDefaultLibFileName: () => "lib.d.ts",
    fileExists: (fileName) => fileName === path,
    readFile: (fileName) => (fileName === path ? text : undefined),
  };
}

/**
 * Every comment range in a script file, found through TypeScript's own syntactic
 * classification — the same classifier editors use to colour comments — rather than by
 * pattern over the text or by walking the parsed AST: a regex cannot tell a comment
 * from a regex literal or a string, and an AST walk misses a comment sitting right
 * before a closing bracket or inside a JSX expression container, because no AST node
 * starts there for the comment to attach to.
 *
 * @param {string} path
 * @param {string} text
 * @returns {TextRange[]}
 */
function scriptCommentRanges(path, text) {
  const service = ts.createLanguageService(singleFileHost(path, text));
  const spans = service.getSyntacticClassifications(path, { start: 0, length: text.length });
  return spans
    .filter((span) => span.classificationType === ts.ClassificationTypeNames.comment)
    .map((span) => ({ pos: span.textSpan.start, end: span.textSpan.start + span.textSpan.length }));
}

/**
 * Every `/* ... *\/` span in a CSS file. A `/*` inside a quoted CSS value would be read
 * as a comment start too, but the repo's CSS has none, so a pattern over the text is
 * enough.
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
 * The 1-based physical line number of an offset into `text`. Delegates to a parsed
 * source file so `\r\n` and a lone `\r` both count as one line break.
 *
 * @param {string} text
 * @param {number} offset
 * @returns {number}
 */
function lineAt(text, offset) {
  const sourceFile = ts.createSourceFile("line-lookup.ts", text, ts.ScriptTarget.Latest, false);
  return sourceFile.getLineAndCharacterOfPosition(offset).line + 1;
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
 * TypeScript's syntactic classification for script files and by `/* *\/` spans for CSS.
 * A path whose extension is neither reports no hits.
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
    const extension = path.slice(path.lastIndexOf("."));
    if (!SCRIPT_EXTENSIONS.has(extension)) continue;
    for (const range of scriptCommentRanges(path, text)) {
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
