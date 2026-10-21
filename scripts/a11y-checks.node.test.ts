import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// docs/specs/a11y-checks.md (Key A11Y). A11Y-14, A11Y-15 and A11Y-16's
// structural halves: whether the repo's own config and scripts wire up the
// NVDA suite and the WebKit projects the way the spec's Contracts section
// describes. None of it exists yet (grep confirms it before writing this
// file), so every assertion below is expected to fail on a missing file, a
// missing script or a missing project — never on a read error, since
// `readFileSync`/`existsSync` on a path that is simply absent is exactly the
// signal these tests are written to catch.
//
// Reads with `fs` from `process.cwd()`, as the brief asks — every other
// scripts/*.node.test.ts in this repo instead resolves ROOT from
// `import.meta.url`/`__dirname` (see core-layout.node.test.ts,
// redesign-navigation.node.test.ts) because Vitest's node project does not
// guarantee the worker's cwd is the repo root. `process.cwd()` is used here
// literally per the brief; if a run's cwd is not the repo root, every
// existsSync below reads false and every read throws, which would misreport
// "file missing" for a file that exists — noted in the report rather than
// silently working around it.
const ROOT = process.cwd();
// A Windows checkout with core.autocrlf has CRLF files; the checks match LF.
const read = (path: string): string =>
  readFileSync(join(ROOT, path), "utf8").replaceAll("\r\n", "\n");
const exists = (path: string): boolean => existsSync(join(ROOT, path));
const readIfExists = (path: string): string => (exists(path) ? read(path) : "");

describe("A11Y-14: the screen-reader suite lives outside pnpm test:e2e and check:full", () => {
  it("A11Y-14: package.json declares a test:sr script running Playwright against its own config", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts?: Record<string, string> };
    const script = pkg.scripts?.["test:sr"];
    expect(script, 'package.json has no "test:sr" script').toBeDefined();
    expect(script ?? "").toContain("playwright test");
    expect(script ?? "").toMatch(/--config[= ]playwright\.sr\.config\.ts/);
  });

  it("A11Y-14: playwright.sr.config.ts exists, runs serially and points testDir at e2e-sr", () => {
    expect(exists("playwright.sr.config.ts"), "playwright.sr.config.ts is missing").toBe(true);
    const config = readIfExists("playwright.sr.config.ts");
    expect(config).toMatch(/testDir\s*:\s*["']\.?\/?e2e-sr["']/);
    // Guidepup forces serial, headed runs (spec Decisions › "Outside
    // check:full"): either an explicit workers: 1, or fullyParallel: false
    // paired with no workers override, satisfies that — accept either
    // spelling rather than one exact token.
    const isSerial = /workers\s*:\s*1\b/.test(config) || /fullyParallel\s*:\s*false\b/.test(config);
    expect(isSerial, "playwright.sr.config.ts does not force a serial run").toBe(true);
  });

  it("A11Y-14: playwright.sr.config.ts drives NVDA through Guidepup, headed", () => {
    const config = readIfExists("playwright.sr.config.ts");
    const usesGuidepup = /withGuidepup|@guidepup\/playwright/.test(config);
    const headed = /headless\s*:\s*false/.test(config);
    expect(
      usesGuidepup || headed,
      "playwright.sr.config.ts names neither withGuidepup/@guidepup/playwright nor headless: false",
    ).toBe(true);
  });

  it("A11Y-14: test:e2e and check:full never reach e2e-sr or test:sr", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts?: Record<string, string> };
    const testE2e = pkg.scripts?.["test:e2e"] ?? "";
    const checkFull = pkg.scripts?.["check:full"] ?? "";
    expect(testE2e).not.toMatch(/e2e-sr|test:sr/);
    expect(checkFull).not.toMatch(/e2e-sr|test:sr/);
  });

  it("A11Y-14: playwright.config.ts's own projects never match e2e-sr", () => {
    const config = read("playwright.config.ts");
    expect(config).not.toMatch(/e2e-sr/);
  });

  it("A11Y-14: a GitHub Actions workflow runs the NVDA suite on windows-2025", () => {
    const dir = join(ROOT, ".github/workflows");
    const files = existsSync(dir) ? readdirSync(dir) : [];
    const srWorkflow = files
      .map((file) => ({ file, content: readIfExists(`.github/workflows/${file}`) }))
      .find(({ content }) => /windows-2025/.test(content) && /test:sr/.test(content));

    expect(
      srWorkflow,
      `no workflow under .github/workflows runs both on windows-2025 and pnpm test:sr (found: ${files.join(", ")})`,
    ).toBeDefined();

    const content = srWorkflow?.content ?? "";
    expect(content).toMatch(/@guidepup\/setup/);
    expect(content).toContain("pnpm test:sr");
    expect(content).toMatch(/pull_request\s*:/);
    expect(content).toMatch(/workflow_dispatch\s*:/);
    expect(content).toMatch(/app\/\*\*/);
    expect(content).toMatch(/components\/\*\*/);
    expect(content).toMatch(/messages\/\*\*/);
  });
});

describe("A11Y-15: two WebKit projects run the map and navigation e2e flows", () => {
  it("A11Y-15: playwright.config.ts defines an iPhone WebKit project matching map.spec.ts and navigation.spec.ts", () => {
    const config = read("playwright.config.ts");
    // devices["iPhone …"] spread into a project's `use`, the way the
    // existing "mobile" project spreads devices["Pixel 7"]
    // (playwright.config.ts:162).
    const iphoneProjectMatch = /devices\[\s*["']iPhone[^"'\]]*["']\s*\]/.exec(config);
    expect(iphoneProjectMatch, 'no project spreads devices["iPhone …"]').not.toBeNull();

    const testMatchForIphone = nearestTestMatch(config, iphoneProjectMatch?.index ?? -1);
    expect(testMatchForIphone, "the iPhone project declares no testMatch").toMatch(/map\.spec\.ts/);
    expect(testMatchForIphone, "the iPhone project declares no testMatch").toMatch(
      /navigation\.spec\.ts/,
    );
  });

  it("A11Y-15: playwright.config.ts defines a 1440x900 Desktop Safari project matching map.spec.ts and navigation.spec.ts", () => {
    const config = read("playwright.config.ts");
    const safariProjectMatch = /devices\[\s*["']Desktop Safari["']\s*\]/.exec(config);
    expect(safariProjectMatch, 'no project spreads devices["Desktop Safari"]').not.toBeNull();

    // 1440x900 is explicit on the project (Desktop Safari's own device
    // descriptor is 1280x720), so the viewport override must be nearby.
    const nearby = config.slice(
      Math.max(0, (safariProjectMatch?.index ?? 0) - 400),
      (safariProjectMatch?.index ?? 0) + 400,
    );
    expect(nearby, "no 1440x900 viewport override near the Desktop Safari project").toMatch(
      /width:\s*1440/,
    );
    expect(nearby).toMatch(/height:\s*900/);

    const testMatchForSafari = nearestTestMatch(config, safariProjectMatch?.index ?? -1);
    expect(testMatchForSafari).toMatch(/map\.spec\.ts/);
    expect(testMatchForSafari).toMatch(/navigation\.spec\.ts/);
  });

  it("A11Y-15: CI runs the WebKit projects in their own End-to-end (WebKit) job, and the required e2e job runs the others on Chromium alone", () => {
    const workflow = read(".github/workflows/test.yml");
    const job = (name: string) => {
      const start = workflow.indexOf(`name: ${name}\n`);
      expect(start, `no job named ${name}`).toBeGreaterThanOrEqual(0);
      const next = workflow.slice(start).search(/\n {2}[a-z][\w-]*:\n/);
      return next === -1 ? workflow.slice(start) : workflow.slice(start, start + next);
    };

    const webkit = job("End-to-end (WebKit)");
    expect(webkit).toMatch(/playwright install --with-deps webkit\b/);
    expect(webkit).toMatch(/--project=webkit-iphone/);
    expect(webkit).toMatch(/--project=webkit-desktop/);

    const required = job("End-to-end (Playwright)");
    expect(required).toMatch(/playwright install --with-deps chromium\n/);
    expect(required).toMatch(/--project=chromium/);
    expect(required).not.toMatch(/--project=webkit/);
  });
});

/**
 * The nearest `testMatch` value following `fromIndex` in `config`, within
 * 400 characters — close enough to belong to the same project object
 * without parsing the config as a module. Returns "" when none is found,
 * which fails every `toMatch` above with a readable diff instead of a
 * TypeError.
 */
function nearestTestMatch(config: string, fromIndex: number): string {
  if (fromIndex < 0) return "";
  const after = config.slice(fromIndex, fromIndex + 400);
  const match = /testMatch\s*:\s*(\/[^/\n]*\/[a-z]*|\[[^\]]*\])/.exec(after);
  return match?.[1] ?? "";
}

interface WebkitSkip {
  file: string;
  /** The enclosing test's title, read from the nearest `test("…"` line above the skip. */
  test: string;
  /** The WebKit project the skip names. */
  project: string;
  /** The reason the skip gives. */
  reason: string;
}

/** Whether `window` (a `test.skip(` line plus its next couple of lines) conditions on WebKit. */
function isWebkitConditioned(window: string): boolean {
  return /webkit/i.test(window) && /project|browserName/i.test(window);
}

/** The title of the nearest `test("…"` call at or above `index`, or "" when there is none. */
function enclosingTestTitle(lines: string[], index: number): string {
  for (let line = index; line >= 0; line--) {
    const match = /\btest\("([^"]+)"/.exec(lines[line]);
    if (match) return match[1];
  }
  return "";
}

/** Every `test.skip(` in `file` whose condition (joined across up to 3 lines) mentions WebKit. */
function webkitSkipsIn(file: string): WebkitSkip[] {
  const lines = read(file).split(/\r?\n/);
  const found: WebkitSkip[] = [];
  for (let index = 0; index < lines.length; index++) {
    if (!lines[index].includes("test.skip(")) continue;
    // A skip's condition spans this line and, for a multi-line call, the
    // next couple of lines — joined so a wrapped condition still matches.
    const window = lines.slice(index, index + 4).join(" ");
    if (!isWebkitConditioned(window)) continue;
    found.push({
      file,
      test: enclosingTestTitle(lines, index),
      project: /["'](webkit-[a-z]+)["']/.exec(window)?.[1] ?? "",
      reason: /,\s*"([^"]+)"/.exec(window)?.[1] ?? "",
    });
  }
  return found;
}

const NO_FAST_DRAG =
  "Playwright's mobile WebKit can deliver the last move and the release in one frame, so Motion never starts the gesture (A11Y-16)";

// A11Y-16 (amended 2026-10-20, owner): the only tests that run on Chromium
// alone, each for an input Playwright's WebKit does not provide.
const EXPECTED_WEBKIT_SKIPS: WebkitSkip[] = [
  {
    file: "e2e/map.spec.ts",
    test: "MOTION-20: at 390×844, on an idle page, a fast 60px drag of the handle down, drawn in one frame, closes the BUSCAR sheet",
    project: "webkit-iphone",
    reason: NO_FAST_DRAG,
  },
  {
    file: "e2e/map.spec.ts",
    test: "MAPUI-66: at 1440×900, focusing the first card's link with the keyboard draws the photo's lime ring and no outline around the card",
    project: "webkit-desktop",
    reason: "Safari's Tab skips links by default (A11Y-16)",
  },
  {
    file: "e2e/map.spec.ts",
    test: "MAPUI-60: a fast 60px drag of the handle down from middle, shorter than half of P−M, ends at peeked",
    project: "webkit-iphone",
    reason: NO_FAST_DRAG,
  },
  {
    file: "e2e/map.spec.ts",
    test: "MAPUI-60: a fast 60px drag of the header up from middle, shorter than half of M−F, ends at full",
    project: "webkit-iphone",
    reason: NO_FAST_DRAG,
  },
  {
    file: "e2e/map.spec.ts",
    test: "MAPUI-60: a fast 60px drag of the handle up from middle, shorter than half of M−F, ends at full",
    project: "webkit-iphone",
    reason: NO_FAST_DRAG,
  },
  {
    file: "e2e/map.spec.ts",
    test: "MAPUI-60: a fast 60px drag of the handle down from full, shorter than half of M−F, ends at middle",
    project: "webkit-iphone",
    reason: NO_FAST_DRAG,
  },
  {
    file: "e2e/map.spec.ts",
    test: "MAPUI-60: a fast drag of the handle down from peeked leaves the sheet at peeked, its offset still P",
    project: "webkit-iphone",
    reason: NO_FAST_DRAG,
  },
  {
    file: "e2e/map.spec.ts",
    test: "MAPUI-59: at full, scrolling inside the list scrolls the list and leaves the sheet at full",
    project: "webkit-iphone",
    reason:
      "MAPUI-59 scrolls with the mouse wheel, which Playwright's mobile WebKit does not provide (A11Y-16)",
  },
];

describe("A11Y-16: only the inputs Playwright's WebKit lacks keep a test on Chromium alone", () => {
  it("A11Y-16: e2e/map.spec.ts and e2e/navigation.spec.ts skip WebKit exactly on MAPUI-59, MOTION-20, the MAPUI-60 fast drags and MAPUI-66, each with its reason", () => {
    const files = ["e2e/map.spec.ts", "e2e/navigation.spec.ts"];
    const webkitSkips = files.flatMap(webkitSkipsIn);

    expect(webkitSkips).toEqual(EXPECTED_WEBKIT_SKIPS);
  });
});
