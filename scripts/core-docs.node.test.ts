import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// Reads the working tree directly against docs/specs/core-docs.md (DOCS-1..10).
// No stubs here: the spec's checks are about the actual spec files and docs
// tree, not about a script's parsing logic (that half lives in
// spec-check.node.test.ts and docs-check.node.test.ts).

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (path: string) => readFileSync(join(ROOT, path), "utf8").replace(/\r\n/g, "\n");
const exists = (path: string) => existsSync(join(ROOT, path));
const readIfExists = (path: string) => (exists(path) ? read(path) : "");

const SPEC_DIR = "docs/specs";

const FIXED_HEADINGS = [
  "Problem",
  "Acceptance criteria",
  "Worked examples",
  "Data model",
  "Permissions",
  "Edge cases",
  "Out of scope",
];
const OPTIONAL_HEADINGS = ["Contracts", "Decisions and rationale", "Open questions"];
const CHECKLIST_ITEM =
  /^- \[( |x)\] [A-Z][A-Z0-9]{1,7}-\d+ · (?:unit|node|component|contract|e2e)(?: \+ (?:unit|node|component|contract|e2e))* — \S/;

function specMarkdownFiles(): string[] {
  return readdirSync(join(ROOT, SPEC_DIR))
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => `${SPEC_DIR}/${name}`);
}

function specFiles(): string[] {
  return specMarkdownFiles().filter((path) => !path.endsWith("_template.md"));
}

interface ParsedSection {
  heading: string;
  body: string;
}

interface ParsedSpec {
  preamble: string[];
  rawHeadings: string[];
  sections: ParsedSection[];
}

interface SectionDraft {
  heading: string;
  body: string[];
}

/** Splits a spec's markdown on `## ` headings outside fenced code blocks. */
function parseSpec(markdown: string): ParsedSpec {
  const preamble: string[] = [];
  const rawHeadings: string[] = [];
  const sections: SectionDraft[] = [];
  let current: SectionDraft | null = null;
  let fenced = false;

  for (const line of markdown.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      (current ? current.body : preamble).push(line);
      continue;
    }
    if (!fenced && /^## /.test(line)) {
      rawHeadings.push(line.trimEnd());
      current = { heading: line.replace(/^## /, "").trim(), body: [] };
      sections.push(current);
      continue;
    }
    (current ? current.body : preamble).push(line);
  }

  return {
    preamble,
    rawHeadings,
    sections: sections.map((s) => ({ heading: s.heading, body: s.body.join("\n") })),
  };
}

/** The order problems in a spec's heading list: wrong fixed prefix, an optional heading out of its relative order, or a numbered heading. */
function headingOffenses(rawHeadings: string[]): string[] {
  const offenses: string[] = [];
  const names = rawHeadings.map((h) => h.replace(/^## /, "").trim());

  for (const raw of rawHeadings) {
    if (/^## \d/.test(raw)) offenses.push(`numbered heading "${raw}"`);
  }

  const fixedPart = names.slice(0, FIXED_HEADINGS.length);
  if (JSON.stringify(fixedPart) !== JSON.stringify(FIXED_HEADINGS)) {
    offenses.push(
      `fixed headings are ${JSON.stringify(fixedPart)}, expected ${JSON.stringify(FIXED_HEADINGS)}`,
    );
  }

  let cursor = -1;
  for (const heading of names.slice(FIXED_HEADINGS.length)) {
    const idx = OPTIONAL_HEADINGS.indexOf(heading);
    if (idx === -1) {
      offenses.push(`unexpected trailing heading "${heading}"`);
      continue;
    }
    if (idx <= cursor) {
      offenses.push(`heading "${heading}" out of the Contracts / Decisions / Open order`);
      continue;
    }
    cursor = idx;
  }

  return offenses;
}

function tableRows(text: string): string[][] {
  return text
    .split("\n")
    .filter((line) => /^\|/.test(line))
    .map((line) => line.split("|").map((cell) => cell.trim().replace(/`/g, "")));
}

/** DOCS-1 offenders for one spec: title, preamble lines, heading order, empty sections. */
function specOffenders(path: string): string[] {
  const offenders: string[] = [];
  const source = read(path);
  const firstLine = source.split("\n")[0] ?? "";

  if (!/^# (?!Spec:)\S/.test(firstLine)) {
    offenders.push(`${path}: title is "${firstLine}", expected "# <Feature>"`);
  }

  const { preamble, rawHeadings, sections } = parseSpec(source);

  for (const prefix of ["Key: ", "Status: ", "Last updated: "]) {
    if (!preamble.some((line) => line.startsWith(prefix))) {
      offenders.push(`${path}: missing a "${prefix.trim()}" line before the first section`);
    }
  }

  for (const offense of headingOffenses(rawHeadings)) {
    offenders.push(`${path}: ${offense}`);
  }

  for (const section of sections) {
    if (section.body.trim().length === 0) {
      offenders.push(`${path}: section "${section.heading}" is empty`);
    }
  }

  return offenders;
}

/** DOCS-2 offenders: a spec still keeping the old `| AC | ... |` table header. */
function tableRowOffenders(path: string): string[] {
  return read(path)
    .split("\n")
    .filter((line) => /^\| *AC *\|/.test(line))
    .map((line) => `${path}: ${line.trim()}`);
}

/** DOCS-2 offenders: a checklist item in Acceptance criteria that does not match the format. */
function checklistFormatOffenders(path: string): string[] {
  const { sections } = parseSpec(read(path));
  const criteria = sections.find((s) => s.heading === "Acceptance criteria");
  if (!criteria) return [];

  return criteria.body
    .split("\n")
    .filter((line) => line.startsWith("- [") && !CHECKLIST_ITEM.test(line))
    .map((line) => `${path}: ${line.trim()}`);
}

/** DOCS-10 offenders: a doc still describing the table format instead of the checklist. */
function formatOffenders(path: string): string[] {
  const source = readIfExists(path);
  const offenders: string[] = [];

  if (source.includes("Verified by")) {
    offenders.push(`${path}: still mentions "Verified by"`);
  }
  if (/^\| *AC *\|/m.test(source)) {
    offenders.push(`${path}: still keeps a criteria table header`);
  }

  return offenders;
}

/** DOCS-10 offenders: a doc path the file names in backticks that does not resolve. */
function docPathOffenders(path: string): string[] {
  const DOC_PATH = /docs\/[A-Za-z0-9_\-/]+\.md/g;
  const source = readIfExists(path);
  const offenders: string[] = [];

  for (const match of source.matchAll(DOC_PATH)) {
    if (!exists(match[0])) {
      offenders.push(`${path}: refers to ${match[0]}, which does not exist`);
    }
  }

  return offenders;
}

describe("docs tree and spec format", () => {
  it("DOCS-1: every spec has the fixed section order, with no numbered or empty heading", () => {
    expect(specFiles().flatMap(specOffenders)).toEqual([]);
  });

  it("DOCS-1: _template.md has the same seven fixed headings, in order", () => {
    const { rawHeadings } = parseSpec(read(`${SPEC_DIR}/_template.md`));
    const names = rawHeadings.map((h) => h.replace(/^## /, "").trim());

    expect(names.slice(0, FIXED_HEADINGS.length)).toEqual(FIXED_HEADINGS);
  });

  it("DOCS-2: no spec keeps a criteria table, and every checklist item matches the format", () => {
    const files = specMarkdownFiles();

    expect(files.flatMap(tableRowOffenders)).toEqual([]);
    expect(files.flatMap(checklistFormatOffenders)).toEqual([]);
  });

  it("DOCS-5: every critical-list criterion has a worked example naming it", () => {
    // The critical list from docs/specs/core-docs.md › Contracts: permission
    // boundaries and bug fixes.
    const CRITICAL_IDS = [
      "ALERT-4",
      "ALERT-5",
      "ALERT-9",
      "ALERT-26",
      "ALERT-27",
      "FAV-5",
      "FAV-6",
      "FAV-8",
      "AUTH-1",
      "AUTH-2",
      "AUTH-5",
      "AUTH-6",
      "AUTH-7",
      "AUTH-8",
      "AUTH-10",
      "AUTH-11",
      "AUTH-12",
      "AUTH-13",
      "AUTH-14",
      "MAP-7",
      "MAP-16",
      "MAP-17",
      "MAP-18",
      "MAP-19",
      "FAV-18",
      "SRC-12",
      "SRC-14",
    ];

    const byKey = new Map<string, ParsedSpec>();
    for (const path of specFiles()) {
      const source = read(path);
      const key = source.match(/^Key:\s*([A-Z][A-Z0-9]{1,7})\s*$/m)?.[1];
      if (key) byKey.set(key, parseSpec(source));
    }

    const missing = CRITICAL_IDS.filter((id) => {
      const key = id.slice(0, id.lastIndexOf("-"));
      const parsed = byKey.get(key);
      const worked = parsed?.sections.find((s) => s.heading === "Worked examples");
      return !worked || !new RegExp(`\\b${id}\\b`).test(worked.body);
    });

    expect(missing).toEqual([]);
  });

  it("DOCS-6: every file under docs/ matches an allowed path shape", () => {
    const ALLOWED = [
      /^docs\/ARCHITECTURE\.md$/,
      /^docs\/decisions\/\d{4}-[a-z0-9-]+\.md$/,
      /^docs\/specs\/[a-z0-9-]+\.md$/,
      /^docs\/specs\/_template\.md$/,
      /^docs\/privacy\/(data-inventory|processors|deletion)\.md$/,
      /^docs\/operations\/backups\.md$/,
      /^docs\/images\/[^/]+$/,
    ];

    function walk(dir: string, out: string[] = []): string[] {
      for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(path, out);
        else out.push(path);
      }
      return out;
    }

    const offenders = walk("docs").filter((f) => !ALLOWED.some((pattern) => pattern.test(f)));

    expect(offenders).toEqual([]);
  });

  it("DOCS-8: docs/privacy/data-inventory.md lists every personal field from prisma/schema.prisma", () => {
    const PAIRS: [string, string][] = [
      ["User", "email"],
      ["User", "password"],
      ["User", "name"],
      ["User", "image"],
      ["User", "emailVerified"],
      ["User", "locale"],
      ["User", "twoFactorSecret"],
      ["User", "twoFactorEnabledAt"],
      ["User", "twoFactorLastStep"],
      ["User", "passwordChangedAt"],
      ["User", "createdAt"],
      ["TwoFactorRecoveryCode", "codeHash"],
      ["TwoFactorRecoveryCode", "usedAt"],
      ["Account", "providerAccountId"],
      ["Account", "refresh_token"],
      ["Account", "access_token"],
      ["Account", "id_token"],
      ["Session", "sessionToken"],
      ["VerificationToken", "identifier"],
      ["VerificationToken", "token"],
      ["PasswordResetToken", "tokenHash"],
      ["PendingRegistration", "email"],
      ["PendingRegistration", "password"],
      ["PendingRegistration", "name"],
      ["PendingRegistration", "tokenHash"],
      ["EmailVerificationToken", "tokenHash"],
      ["EmailVerificationToken", "newEmail"],
      ["RateLimit", "key"],
      ["Favorite", "userId"],
      ["AlertCriteria", "criteria"],
      ["Alert", "label"],
      ["Alert", "unsubscribeTokenHash"],
      ["SearchHistory", "query"],
    ];

    const source = readIfExists("docs/privacy/data-inventory.md");
    expect(source).toMatch(/^\| *Model *\| *Field *\| *Purpose *\| *Retention *\|/m);

    const rows = tableRows(source);
    const missing = PAIRS.filter(
      ([model, field]) => !rows.some((cells) => cells[1] === model && cells[2] === field),
    ).map(([model, field]) => `${model}.${field}`);

    expect(missing).toEqual([]);
  });

  it("DOCS-8: docs/privacy/processors.md lists every processor, and the Neon row names its region", () => {
    const PROCESSORS = [
      "Neon",
      "Vercel",
      "Resend",
      "Google",
      "GitHub",
      "Have I Been Pwned",
      "OpenStreetMap Nominatim",
      "CARTO",
      "Wallapop",
      "coches.net",
      "Milanuncios",
      "Upstash",
    ];

    const source = readIfExists("docs/privacy/processors.md");
    expect(source).toMatch(/^\| *Processor *\| *Region *\| *Data received *\| *DPA *\|/m);

    const rows = tableRows(source);
    const missing = PROCESSORS.filter((name) => !rows.some((cells) => cells[1] === name));
    expect(missing).toEqual([]);

    const neonRow = rows.find((cells) => cells[1] === "Neon");
    expect(neonRow?.join("|") ?? "").toContain("aws-eu-central-1");
  });

  it("DOCS-8: docs/privacy/deletion.md covers account deletion, what survives it, and the restore window", () => {
    const source = readIfExists("docs/privacy/deletion.md");

    expect(source).toContain("deleteAccount");
    expect(source).toContain("AlertCriteria");
    expect(source).toContain("6 hours");
  });

  it("DOCS-9: docs/operations/backups.md names the Neon region and the 6-hour history window", () => {
    expect(exists("docs/operations/backups.md")).toBe(true);

    const source = readIfExists("docs/operations/backups.md");
    expect(source).toContain("aws-eu-central-1");
    expect(source).toContain("6 hours");
  });

  it("DOCS-10: /spec, /spec-tests, _template.md and CLAUDE.md describe the checklist format, and every doc path they name resolves", () => {
    const files = [
      ".claude/commands/spec.md",
      ".claude/commands/spec-tests.md",
      "docs/specs/_template.md",
      "CLAUDE.md",
    ];

    for (const path of files) {
      expect(exists(path)).toBe(true);
    }

    expect(files.flatMap(formatOffenders)).toEqual([]);
    expect(files.flatMap(docPathOffenders)).toEqual([]);

    for (const path of [".claude/commands/spec.md", "docs/specs/_template.md"]) {
      const lines = readIfExists(path).split("\n");
      expect(lines.some((line) => CHECKLIST_ITEM.test(line))).toBe(true);
    }

    expect(read("CLAUDE.md")).toContain("- [ ] KEY-n · <level> — <statement>");
    expect(read(".claude/commands/spec-tests.md")).toContain("criteria checklist");
  });
});

// Negative fixtures for the local parsing helpers above, built by hand rather
// than read off a real spec file, so a broken check is caught even when every
// spec in docs/specs currently happens to be well-formed.
describe("local format helpers (negative fixtures)", () => {
  it("DOCS-1: headingOffenses reports a numbered heading", () => {
    const headings = [
      "## 1. Problem",
      "## Acceptance criteria",
      "## Worked examples",
      "## Data model",
      "## Permissions",
      "## Edge cases",
      "## Out of scope",
    ];

    expect(headingOffenses(headings)).toContain('numbered heading "## 1. Problem"');
  });

  it("DOCS-1: headingOffenses reports Worked examples and Data model swapped as a fixed-order offense", () => {
    const headings = [
      "## Problem",
      "## Acceptance criteria",
      "## Data model",
      "## Worked examples",
      "## Permissions",
      "## Edge cases",
      "## Out of scope",
    ];

    expect(
      headingOffenses(headings).some((offense) => offense.startsWith("fixed headings are")),
    ).toBe(true);
  });

  it("DOCS-1: headingOffenses reports Open questions before Contracts as an optional-order offense", () => {
    const headings = [
      ...FIXED_HEADINGS.map((heading) => `## ${heading}`),
      "## Open questions",
      "## Contracts",
    ];

    expect(
      headingOffenses(headings).some((offense) =>
        offense.includes('heading "Contracts" out of the Contracts / Decisions / Open order'),
      ),
    ).toBe(true);
  });
});
