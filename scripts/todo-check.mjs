// Fails when a code comment holds the to-do marker with no issue reference. Biome has
// no rule for this, so it runs as its own step in `lint`. See
// docs/specs/core-tooling.md TOOLING-12 for the worked examples.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { trackedFiles as gitTrackedFiles } from "./git-files.mjs";

const TODO_WORD = /\bTODO\b/;
const ISSUE_REFERENCE = /#\d+/;
const TRACKED_EXTENSIONS = new Set([".ts", ".tsx", ".mjs", ".cjs", ".js", ".css"]);

/**
 * @typedef {{ path: string, text: string }} TodoCheckFile
 * @typedef {{ path: string, line: number }} TodoCheckHit
 * @typedef {"code" | "line-comment" | "block-comment" | "string"} ScanState
 * @typedef {{
 *   state: ScanState,
 *   quote: string,
 *   line: number,
 *   atLineStart: boolean,
 *   heuristicLine: boolean,
 *   perLine: Map<number, string>,
 * }} ScanContext
 */

/**
 * @param {ScanContext} ctx
 * @param {string} ch
 * @returns {void}
 */
function append(ctx, ch) {
  ctx.perLine.set(ctx.line, (ctx.perLine.get(ctx.line) ?? "") + ch);
}

/**
 * A physical line whose only content, once its leading whitespace is skipped, starts
 * with `*` (and not `*\/ `) is treated as a JSDoc continuation line — the convention
 * inside a `/** ... *\/` block — even without a matching opener earlier in the file, so
 * an isolated continuation line still counts as a comment.
 *
 * @param {ScanContext} ctx
 * @param {string} ch
 * @param {string | undefined} next
 * @returns {boolean} whether this character was already handled
 */
function handleLineStart(ctx, ch, next) {
  if (!ctx.atLineStart || ctx.state !== "code") return false;
  if (/\s/.test(ch)) return true;
  ctx.atLineStart = false;
  if (ch === "*" && next !== "/") {
    ctx.heuristicLine = true;
    append(ctx, ch);
    return true;
  }
  return false;
}

/**
 * @param {ScanContext} ctx
 * @param {string} ch
 * @param {string | undefined} next
 * @returns {number} extra characters this consumed
 */
function handleCode(ctx, ch, next) {
  if (ch === "/" && next === "/") {
    ctx.state = "line-comment";
    return 1;
  }
  if (ch === "/" && next === "*") {
    ctx.state = "block-comment";
    return 1;
  }
  if (ch === '"' || ch === "'" || ch === "`") {
    ctx.state = "string";
    ctx.quote = ch;
  }
  return 0;
}

/**
 * @param {ScanContext} ctx
 * @param {string} ch
 * @param {string | undefined} next
 * @returns {number}
 */
function handleBlockComment(ctx, ch, next) {
  if (ch === "*" && next === "/") {
    ctx.state = "code";
    return 1;
  }
  append(ctx, ch);
  return 0;
}

/**
 * Closes on its own quote, honouring a backslash escape.
 *
 * @param {ScanContext} ctx
 * @param {string} ch
 * @returns {number}
 */
function handleString(ctx, ch) {
  if (ch === "\\") return 1;
  if (ch === ctx.quote) {
    ctx.state = "code";
    ctx.quote = "";
  }
  return 0;
}

/**
 * A non-backtick string does not survive a newline; a line comment always ends there.
 * A block comment does survive — that is the one state that spans lines.
 *
 * @param {ScanContext} ctx
 * @returns {void}
 */
function handleNewline(ctx) {
  if (ctx.state === "line-comment") ctx.state = "code";
  if (ctx.state === "string" && ctx.quote !== "`") ctx.state = "code";
  ctx.heuristicLine = false;
  ctx.line++;
  ctx.atLineStart = true;
}

/**
 * The comment text found on each line of a file's text: the content of every `//` and
 * `/* ... *\/` comment (block comments may span lines), plus a bare JSDoc continuation
 * line (see `handleLineStart`). String contents are never comment text, even a string
 * that happens to contain the to-do marker.
 *
 * @param {string} text
 * @returns {Map<number, string>}
 */
function scanComments(text) {
  /** @type {ScanContext} */
  const ctx = {
    state: "code",
    quote: "",
    line: 1,
    atLineStart: true,
    heuristicLine: false,
    perLine: new Map(),
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === "\n") {
      handleNewline(ctx);
      continue;
    }
    if (handleLineStart(ctx, ch, next)) continue;
    if (ctx.heuristicLine) {
      append(ctx, ch);
      continue;
    }

    if (ctx.state === "code") i += handleCode(ctx, ch, next);
    else if (ctx.state === "line-comment") append(ctx, ch);
    else if (ctx.state === "block-comment") i += handleBlockComment(ctx, ch, next);
    else if (ctx.state === "string") i += handleString(ctx, ch);
  }

  return ctx.perLine;
}

/**
 * The lines across the given files whose comment holds the to-do marker with no issue
 * reference (`#<number>` on the same line, inside the comment).
 *
 * @param {TodoCheckFile[]} files
 * @returns {TodoCheckHit[]}
 */
export function findUnreferencedTodos(files) {
  const hits = [];
  for (const { path, text } of files) {
    const perLine = scanComments(text);
    const lineCount = text.split("\n").length;
    for (let lineNo = 1; lineNo <= lineCount; lineNo++) {
      const comment = perLine.get(lineNo);
      if (comment && TODO_WORD.test(comment) && !ISSUE_REFERENCE.test(comment)) {
        hits.push({ path, line: lineNo });
      }
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
  const paths = trackedFiles();
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
