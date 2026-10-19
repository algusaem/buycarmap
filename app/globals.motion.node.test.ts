import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// docs/specs/motion.md (Key MOTION, Approved), MOTION-1 and the spec's
// Contracts section: app/globals.css sets Tailwind's default transition to
// the state timing (120ms, the ease-out curve) plus the named durations
// `fast`/`base`/`sheet` and the named ease `out`, read by every `transition-*`
// utility and by lib/animations.ts's presets. A sibling of
// scripts/redesign-foundation.node.test.ts's LOOK-1 describe, which already
// reads this same file for the colour/radius/shadow tokens; kept in its own
// file rather than appended there since it is owned by a different,
// concurrently edited spec.

const ROOT = join(__dirname, "..");
const GLOBALS_CSS_PATH = join(ROOT, "app/globals.css");

/** `--name: value;` pairs anywhere in the file, whitespace-collapsed and
 * lower-cased, the same comparison rule LOOK-1's cssVars uses — scanning the
 * whole file rather than one block, since the spec does not pin these six
 * variables to `:root` or `@theme inline` specifically. */
function cssVars(source: string): Map<string, string> {
  const map = new Map<string, string>();
  const pattern = /--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
  for (const match of source.matchAll(pattern)) {
    map.set(match[1].toLowerCase(), match[2].trim().replace(/\s+/g, " ").toLowerCase());
  }
  return map;
}

function collapse(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

describe("MOTION-1: app/globals.css sets the state timing and the named motion tokens", () => {
  // Comments are stripped first so a documentation example inside /* ... */
  // cannot satisfy the assertion in place of a real declaration.
  const css = readFileSync(GLOBALS_CSS_PATH, "utf-8").replace(/\/\*[\s\S]*?\*\//g, "");
  const vars = cssVars(css);

  it("MOTION-1: retimes Tailwind's default transition to 120ms with the ease-out curve", () => {
    expect(vars.get("default-transition-duration")).toBe(collapse("120ms"));
    expect(vars.get("default-transition-timing-function")).toBe(
      collapse("cubic-bezier(0.23, 1, 0.32, 1)"),
    );
  });

  it("MOTION-1: defines the named durations fast (120ms), base (180ms) and sheet (240ms)", () => {
    expect(vars.get("transition-duration-fast")).toBe(collapse("120ms"));
    expect(vars.get("transition-duration-base")).toBe(collapse("180ms"));
    expect(vars.get("transition-duration-sheet")).toBe(collapse("240ms"));
  });

  it("MOTION-1: defines the named ease out with the same curve", () => {
    expect(vars.get("ease-out")).toBe(collapse("cubic-bezier(0.23, 1, 0.32, 1)"));
  });
});
