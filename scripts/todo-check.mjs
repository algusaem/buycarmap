// Fails when a code comment holds the to-do marker with no issue reference. Biome has
// no rule for this, so it runs as its own step in `lint`. See
// docs/specs/core-tooling.md TOOLING-12 for the worked examples.

import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const TODO_COMMENT = /(\/\/|\/\*|^\s*\*)\s*.*\bTODO\b/;
const ISSUE_REFERENCE = /#\d+/;
const TRACKED_EXTENSIONS = new Set([".ts", ".tsx", ".mjs", ".cjs", ".js", ".css"]);

/**
 * @typedef {{ path: string, text: string }} TodoCheckFile
 * @typedef {{ path: string, line: number }} TodoCheckHit
 */

/**
 * The lines across the given files whose comment holds the to-do marker with no issue
 * reference (`#<number>` on the same line).
 *
 * @param {TodoCheckFile[]} files
 * @returns {TodoCheckHit[]}
 */
export function findUnreferencedTodos(files) {
  const hits = [];
  for (const { path, text } of files) {
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (TODO_COMMENT.test(line) && !ISSUE_REFERENCE.test(line)) {
        hits.push({ path, line: i + 1 });
      }
    }
  }
  return hits;
}

function trackedFiles() {
  const output = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" });
  return output
    .split("\0")
    .filter(Boolean)
    .filter((path) => TRACKED_EXTENSIONS.has(path.slice(path.lastIndexOf("."))));
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
