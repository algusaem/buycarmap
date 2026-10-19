import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import tokens from "@/docs/design/system/tokens.json";

// docs/specs/redesign-foundation.md (Key LOOK, Approved): the static half of
// the F1 redesign — tokens, fonts and the two style-guide pages — that a
// node test can prove by reading the files, without a browser computing
// styles. LOOK-3/4/7/9..14/17 (need a real browser) are e2e/foundation.spec.ts;
// LOOK-5 and LOOK-18 belong to a concurrently edited file and are not here.

const ROOT = join(__dirname, "..");
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "app/generated"]);
const TEST_FILE = /\.(test|node\.test|integration\.test)\.[tj]sx?$/;

function walk(dir: string, exts: string[]): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }

  return entries.flatMap((entry) => {
    if (SKIP_DIRS.has(entry) || entry.startsWith(".")) return [];
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) return walk(full, exts);
    if (!exts.some((ext) => entry.endsWith(ext))) return [];
    if (TEST_FILE.test(entry)) return [];
    return [full];
  });
}

function rel(files: string[]): string[] {
  return files.map((file) => relative(ROOT, file).replace(/\\/g, "/")).sort();
}

/** Returns the content between the first `{` after `marker` and its matching `}`. */
function extractBlock(source: string, marker: string): string {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) return "";
  const braceStart = source.indexOf("{", markerIndex);
  if (braceStart === -1) return "";
  let depth = 0;
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(braceStart + 1, i);
    }
  }
  return "";
}

/** `--name: value;` pairs, whitespace-collapsed and lower-cased (LOOK-1's comparison rule). */
function cssVars(block: string): Map<string, string> {
  const map = new Map<string, string>();
  const pattern = /--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
  let match: RegExpExecArray | null;
  // biome-ignore lint: standard exec-loop over a global regex.
  while ((match = pattern.exec(block))) {
    map.set(match[1].toLowerCase(), match[2].trim().replace(/\s+/g, " ").toLowerCase());
  }
  return map;
}

function collapse(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

const GLOBALS_CSS_PATH = join(ROOT, "app/globals.css");

describe("LOOK-1: app/globals.css defines the design tokens", () => {
  const css = readFileSync(GLOBALS_CSS_PATH, "utf-8");
  const rootVars = cssVars(extractBlock(css, ":root"));
  const designTokens = [...tokens.color.tokens, ...tokens.radius.tokens, ...tokens.shadow.tokens];

  it("LOOK-1: :root defines every colour, radius and shadow token of tokens.json with the exact value", () => {
    const wrong = designTokens
      .filter((token) => rootVars.get(token.name.toLowerCase()) !== collapse(token.value))
      .map((token) => token.name);

    expect(wrong).toEqual([]);
  });

  it("LOOK-1: spot checks from the worked example", () => {
    expect(rootVars.get("bg")).toBe("#0f0f10");
    expect(rootVars.get("surface-strong")).toBe("#1e1e22");
    expect(rootVars.get("scrim")).toBe("rgba(15, 15, 16, 0.85)");
    expect(rootVars.get("radius-panel")).toBe("28px");
    expect(rootVars.get("shadow-pin-active")).toBe("0 0 0 7px rgba(198, 255, 61, 0.2)");
  });

  it("LOOK-1: the file contains no .light block and no oklch( value", () => {
    expect(css).not.toContain(".light");
    expect(css.toLowerCase()).not.toContain("oklch(");
  });
});

describe("LOOK-2: the Tailwind @theme inline block aliases each utility colour to its design token", () => {
  const css = readFileSync(GLOBALS_CSS_PATH, "utf-8");
  const themeVars = cssVars(extractBlock(css, "@theme inline"));

  // The spec's LOOK-2 table, keyed by the @theme inline variable name.
  const expectedAliases: Record<string, string> = {
    "color-background": "var(--bg)",
    "color-foreground": "var(--text)",
    "color-card": "var(--surface)",
    "color-popover": "var(--surface)",
    "color-muted": "var(--surface)",
    "color-secondary": "var(--surface)",
    "color-accent": "var(--surface)",
    "color-border": "var(--line)",
    "color-input": "var(--line)",
    "color-muted-foreground": "var(--text-muted)",
    "color-primary": "var(--lime)",
    "color-primary-foreground": "var(--on-lime)",
    "color-destructive": "var(--danger)",
    "color-ring": "var(--lime)",
  };

  it("LOOK-2: every utility colour token resolves to the design token the spec's table names", () => {
    const mismatches = Object.entries(expectedAliases)
      .filter(([name, expected]) => themeVars.get(name) !== expected)
      .map(([name]) => name);

    expect(mismatches).toEqual([]);
  });
});

describe("LOOK-6: the root layout self-hosts Rethink Sans and Unbounded", () => {
  const layout = readFileSync(join(ROOT, "app/layout.tsx"), "utf-8");

  it("LOOK-6: app/layout.tsx imports next/font/local and declares --font-sans for Rethink Sans and --font-display for Unbounded", () => {
    expect(layout).toContain('from "next/font/local"');
    // Loose enough to survive variable naming, strict enough to prove the
    // family and the CSS variable are wired to the same declaration.
    expect(layout).toMatch(/rethink-sans[\s\S]{0,200}?variable:\s*"--font-sans"/);
    expect(layout).toMatch(/unbounded[\s\S]{0,200}?variable:\s*"--font-display"/);
  });

  it("LOOK-6: both font files and their OFL licence exist under app/fonts/", () => {
    const files = [
      "app/fonts/rethink-sans/rethink-sans-latin-wght-normal.woff2",
      "app/fonts/rethink-sans/OFL.txt",
      "app/fonts/unbounded/unbounded-latin-wght-normal.woff2",
      "app/fonts/unbounded/OFL.txt",
    ];

    for (const file of files) {
      expect(existsSync(join(ROOT, file)), `${file} is missing`).toBe(true);
    }
  });

  it("LOOK-6: no tracked source file imports next/font/google", () => {
    const files = [
      ...walk(join(ROOT, "app"), [".ts", ".tsx"]),
      ...walk(join(ROOT, "components"), [".ts", ".tsx"]),
      ...walk(join(ROOT, "lib"), [".ts", ".tsx"]),
    ];
    const offenders = files.filter((file) =>
      readFileSync(file, "utf-8").includes("next/font/google"),
    );

    expect(rel(offenders)).toEqual([]);
  });

  it("LOOK-6: no file under app/fonts/ has 'jakarta' or 'jetbrains' in its path", () => {
    const fontFiles = walk(join(ROOT, "app/fonts"), [".woff2", ".txt"]);
    const offenders = fontFiles.filter((file) => /jakarta|jetbrains/i.test(file));

    expect(rel(offenders)).toEqual([]);
  });
});

describe("LOOK-8: font-mono resolves to the sans family", () => {
  it("LOOK-8: @theme inline sets --font-mono to var(--font-sans)", () => {
    const css = readFileSync(GLOBALS_CSS_PATH, "utf-8");
    const themeVars = cssVars(extractBlock(css, "@theme inline"));

    expect(themeVars.get("font-mono")).toBe("var(--font-sans)");
  });
});

describe("FRONT-29: the root layout renders MotionProvider", () => {
  // The render check lives in components/MotionProvider.test.tsx (jsdom); reading the layout
  // source needs Node, so it is here.
  it("FRONT-29: app/layout.tsx renders the page through MotionProvider", () => {
    const layout = readFileSync(join(ROOT, "app/layout.tsx"), "utf-8");

    expect(layout).toContain("MotionProvider");
  });
});

describe("LOOK-19: DESIGN.md and its sidecar reflect the current system", () => {
  // Normalised to LF so a Windows checkout with core.autocrlf parses the same.
  const design = readFileSync(join(ROOT, "DESIGN.md"), "utf-8").replace(/\r\n/g, "\n");
  const frontmatterMatch = design.match(/^---\n([\s\S]*?)\n---/);
  const frontmatter = frontmatterMatch?.[1] ?? "";

  /** Flat key: value pairs directly under the `colors:` top-level key. */
  function parseFrontmatterColors(yaml: string): Map<string, string> {
    const lines = yaml.split("\n");
    const colorsIndex = lines.findIndex((line) => /^colors:\s*$/.test(line));
    const map = new Map<string, string>();
    if (colorsIndex === -1) return map;

    for (let i = colorsIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (/^\S/.test(line)) break; // back to a top-level key
      const pair = line.match(/^\s+([\w-]+):\s*(.+?)\s*$/);
      if (!pair) continue;
      map.set(pair[1], pair[2].replace(/^["']|["']$/g, ""));
    }
    return map;
  }

  const frontmatterColors = parseFrontmatterColors(frontmatter);

  it("LOOK-19: the ## sections follow the canonical order", () => {
    const expectedOrder = [
      "Overview",
      "Colors",
      "Typography",
      "Layout",
      "Elevation & Depth",
      "Shapes",
      "Components",
      "Do's and Don'ts",
      "Email",
    ];
    const headings = [...design.matchAll(/^## (.+)$/gm)]
      .map((m) => m[1].trim())
      .filter((heading) => expectedOrder.includes(heading));

    expect(headings).toEqual(expectedOrder);
  });

  it("LOOK-19: the frontmatter colour map has every colour token of tokens.json with the same value", () => {
    expect(frontmatterMatch, "DESIGN.md has no YAML frontmatter").toBeTruthy();

    const missing = tokens.color.tokens
      .filter((token) => frontmatterColors.get(token.name) !== token.value)
      .map((token) => token.name);

    expect(missing).toEqual([]);
  });

  it("LOOK-19: spot checks lime, violet and on-violet", () => {
    expect(frontmatterColors.get("lime")).toBe("#C6FF3D");
    expect(frontmatterColors.get("violet")).toBe("#7C4DFF");
    expect(frontmatterColors.get("on-violet")).toBe("#FAF9F8");
  });

  it("LOOK-19: names Unbounded and Rethink Sans", () => {
    expect(design).toContain("Unbounded");
    expect(design).toContain("Rethink Sans");
  });

  it("LOOK-19: says nothing of a light theme", () => {
    const lowered = design.toLowerCase();
    expect(lowered).not.toContain("light theme");
    expect(lowered).not.toContain("tema claro");
    expect(design).not.toContain(".light");
  });

  it("LOOK-19: the Email section still names react-email", () => {
    const emailSection = design.match(/^## Email\n([\s\S]*?)(?=\n## |$)/m);
    expect(emailSection, "no ## Email section found").toBeTruthy();
    expect(emailSection?.[1] ?? "").toContain("react-email");
  });

  it("LOOK-19: .impeccable/design.json exists and parses as JSON", () => {
    const path = join(ROOT, ".impeccable/design.json");
    expect(existsSync(path), "missing .impeccable/design.json").toBe(true);

    expect(() => JSON.parse(readFileSync(path, "utf-8"))).not.toThrow();
  });
});

describe("LOOK-20: the style-guide pages show the current system", () => {
  /** The page's own source plus the source of any `@/...` module it imports (one level). */
  function resolvableSources(entryFile: string): string {
    const content = readFileSync(entryFile, "utf-8");
    const importPaths = [...content.matchAll(/from ["']@\/([^"']+)["']/g)].map((m) => m[1]);
    const pieces = [content];

    for (const importPath of importPaths) {
      const base = join(ROOT, importPath);
      const candidate = [
        `${base}.ts`,
        `${base}.tsx`,
        join(base, "index.ts"),
        join(base, "index.tsx"),
      ].find((file) => existsSync(file));
      if (candidate) pieces.push(readFileSync(candidate, "utf-8"));
    }
    return pieces.join("\n");
  }

  it("LOOK-20: /palette mentions every colour token of app/globals.css :root with its value", () => {
    const css = readFileSync(GLOBALS_CSS_PATH, "utf-8");
    const rootVars = cssVars(extractBlock(css, ":root"));
    const paletteSource = resolvableSources(join(ROOT, "app/palette/page.tsx"));

    const missing = [...rootVars.entries()]
      .filter(([name, value]) => {
        const nameMentioned = paletteSource.includes(`--${name}`);
        const valueMentioned = paletteSource.toLowerCase().includes(value);
        return !(nameMentioned && valueMentioned);
      })
      .map(([name]) => name);

    expect(missing).toEqual([]);
  });

  it("LOOK-20: neither /palette nor /typography mentions the old 'Cartographic Modern' system", () => {
    const palette = readFileSync(join(ROOT, "app/palette/page.tsx"), "utf-8");
    const typography = readFileSync(join(ROOT, "app/typography/page.tsx"), "utf-8");
    const forbidden = ["Cartographic Modern", "Plus Jakarta", "Jakarta Sans", "JetBrains Mono"];

    for (const text of [palette, typography]) {
      for (const phrase of forbidden) {
        expect(text).not.toContain(phrase);
      }
    }
  });
});
