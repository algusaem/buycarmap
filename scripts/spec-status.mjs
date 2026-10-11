// The `Status:` line of a spec, read one way for every script that cares.
//
// spec-check decides whether a spec is enforced from it, and docs-check decides
// whether a spec's source paths must exist. With two parsers they disagreed:
// `Status: **Implemented**` was enforced by one and skipped by the other.
// Kept dependency-free, like the scripts that import it.

// The bold markers are optional, and anything after the word is ignored, so
// `Implemented`, `**Implemented**` and `Implemented (2026-10-11)` all read the same.
const STATUS_LINE = /^Status:\s*\**\s*([A-Za-z]+)/m;

/**
 * The word a spec's `Status:` line declares, or `undefined` when it has none.
 *
 * @param {string} source
 * @returns {string | undefined}
 */
export function specStatus(source) {
  return source.match(STATUS_LINE)?.[1];
}
