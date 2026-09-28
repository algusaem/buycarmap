import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// Mastermind lives in prose: CLAUDE.md and the command files. These tests read
// them, because the way it fails is a command that tells the main session to
// "maybe" delegate, or none at all. See docs/specs/core-mastermind.md.

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const COMMANDS = ".claude/commands";
// The 17 check commands, plus daily, diff, spec and spec-tests.
const MIN_COMMANDS = 21;
// MASTER-2's alternative to delegating: the command runs whole in one read-only call.
const RUNS_WHOLE = /runs whole in one read-only call/;

const read = (path: string) => readFileSync(join(ROOT, path), "utf8").replace(/\r\n/g, "\n");
const commands = () =>
  readdirSync(join(ROOT, COMMANDS))
    .filter((name) => name.endsWith(".md"))
    .map((name) => `${COMMANDS}/${name}`);
const ruleFiles = () => ["CLAUDE.md", ...commands()];
/** Prose is hand-wrapped: compare phrases with every run of whitespace as one space. */
const flat = (text: string) => text.replace(/\s+/g, " ");

/** The paragraph that opens with "Delegation", up to the next blank line. */
function delegationParagraph(markdown: string): string | null {
  const paragraphs = markdown.split(/\n\s*\n/);
  return paragraphs.find((paragraph) => /^Delegation\b/.test(paragraph.trim())) ?? null;
}

/** From the "## Model delegation" heading up to the next "## " heading, or "" if absent. */
function delegationSection(claude: string): string {
  const start = claude.search(/^## Model delegation /m);
  if (start === -1) return "";
  const section = claude.slice(start);
  const next = section.indexOf("\n## ", 1);
  return next === -1 ? section : section.slice(0, next);
}

describe("mastermind delegation", () => {
  it("MASTER-1: CLAUDE.md has the mastermind delegation section", () => {
    const raw = delegationSection(read("CLAUDE.md"));
    const section = flat(raw);

    expect(raw.split("\n")[0]).toMatch(/^## Model delegation .*\(mastermind\)$/);
    expect(section).toMatch(/main session runs on it and does the analysis, decisions/);
    expect(section).toContain('subagent_type: "lacayo-sonnet"` — the default for anything already decided');
    expect(section).toContain('subagent_type: "lacayo-opus"` — only when the brief itself requires judgement');
    expect(section).toContain("Verification never runs in the main session");
    expect(section).toContain("At the end of each task the mastermind reports the split in one line");
    expect(section).toContain("«Lacayos:");
  });

  it("MASTER-2: every command carries a Delegation paragraph that names mastermind", () => {
    const files = commands();
    const missing = files.filter((file) => {
      const paragraph = delegationParagraph(read(file));
      if (paragraph === null) return true;
      const delegates = paragraph.includes("mastermind") && paragraph.includes('subagent_type: "lacayo-');
      return !delegates && !RUNS_WHOLE.test(flat(paragraph));
    });

    expect(files.length).toBeGreaterThanOrEqual(MIN_COMMANDS);
    expect(missing).toEqual([]);
  });

  it("MASTER-3: nothing delegates in the conditional", () => {
    const conditional = ruleFiles().filter((file) => /\b(may|might)\s+go\s+to\b/i.test(read(file)));

    expect(conditional).toEqual([]);
  });

  it("MASTER-4: no lacayo is picked by model name", () => {
    const byModel = ruleFiles().filter((file) => read(file).includes('model: "'));

    expect(byModel).toEqual([]);
  });

  it("MASTER-5: every command that delegates ends its report with the Lacayos line", () => {
    const paragraphs = commands().map((file) => ({ file, paragraph: delegationParagraph(read(file)) ?? "" }));
    const delegating = paragraphs.filter(({ paragraph }) => /subagent_type: "lacayo-(sonnet|opus)"/.test(paragraph));
    const runningWhole = paragraphs.filter(({ paragraph }) => RUNS_WHOLE.test(flat(paragraph)));
    const withoutLine = delegating
      .filter(({ paragraph }) => !paragraph.includes("«Lacayos:"))
      .map(({ file }) => file);

    expect(delegating.length).toBe(paragraphs.length - runningWhole.length);
    expect(delegating.length).toBeGreaterThan(0);
    expect(withoutLine).toEqual([]);
  });
});
