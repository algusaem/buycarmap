import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cn } from "./utils";

// docs/specs/redesign-map.md (Contracts › Type scale): the named type styles
// of app/globals.css merge as font sizes, not as colours.
describe("cn — the theme's named type styles", () => {
  it("a named style overrides an earlier font size", () => {
    expect(cn("h-11 text-sm", "w-full text-body-15")).toBe("h-11 w-full text-body-15");
  });

  it("a named style and a text colour both stay", () => {
    expect(cn("text-small", "text-text-muted")).toBe("text-small text-text-muted");
  });

  it("a later named style drops an earlier line height, as any font size does", () => {
    expect(cn("text-sm leading-none", "text-field-label leading-normal")).toBe(
      "text-field-label leading-normal",
    );
  });

  it("the tab-bar clearance merges as padding", () => {
    expect(cn("pb-8", "pb-tab-clearance")).toBe("pb-tab-clearance");
  });
});

// Every type style, spacing token and border width app/globals.css declares
// in its `@theme` blocks has to be registered with `cn`, or tailwind-merge
// reads it as a colour (or not at all) and keeps or drops the wrong class.
// Read from the stylesheet itself, so the list cannot drift.
function themeNames(prefix: string): string[] {
  const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf-8");
  const blocks = [...css.matchAll(/@theme[^{]*\{([\s\S]*?)\r?\n\}/g)].map((match) => match[1]);
  const pattern = new RegExp(String.raw`^\s*--${prefix}-([a-z0-9-]+?):`, "gm");
  const names = blocks.flatMap((block) => [...block.matchAll(pattern)].map((match) => match[1]));
  // `--text-hero--line-height` and its kin are a style's parts, not names.
  return [...new Set(names.filter((name) => !name.includes("--") && !name.endsWith("-")))];
}

describe("cn — every theme name in app/globals.css is registered", () => {
  it("the stylesheet declares type styles, spacing tokens and a border width", () => {
    expect(themeNames("text")).toContain("body-15");
    expect(themeNames("spacing")).toContain("tab-clearance");
    expect(themeNames("spacing")).toContain("filters-max");
    expect(themeNames("border-width")).toEqual(["thin"]);
  });

  it.each(themeNames("text"))("text-%s merges as a font size", (name) => {
    expect(cn("text-sm", `text-${name}`)).toBe(`text-${name}`);
    expect(cn(`text-${name}`, "text-text-muted")).toBe(`text-${name} text-text-muted`);
  });

  it.each(themeNames("spacing"))("%s merges as spacing", (name) => {
    expect(cn("p-4", `p-${name}`)).toBe(`p-${name}`);
  });

  it.each(themeNames("border-width"))("border-%s merges as a border width", (name) => {
    expect(cn("border-2", `border-${name}`)).toBe(`border-${name}`);
    expect(cn(`border-${name}`, "border-line")).toBe(`border-${name} border-line`);
  });
});
