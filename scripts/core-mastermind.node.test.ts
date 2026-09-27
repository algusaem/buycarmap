import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// Mastermind lives in prose: CLAUDE.md and the command files. These tests read
// them, because the way it fails is a command that tells the main session to
// "maybe" delegate, or none at all. See docs/specs/core-mastermind.md.

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const COMMANDS = ".claude/commands";

const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const commands = () =>
  readdirSync(join(ROOT, COMMANDS))
    .filter((name) => name.endsWith(".md"))
    .map((name) => `${COMMANDS}/${name}`);

/** The paragraph that opens with "Delegation", up to the next blank line. */
function delegationParagraph(markdown: string): string | null {
  const paragraphs = markdown.replace(/\r\n/g, "\n").split(/\n\s*\n/);
  return paragraphs.find((paragraph) => /^Delegation\b/.test(paragraph.trim())) ?? null;
}

describe("mastermind delegation", () => {
  it("MASTER-1: CLAUDE.md has the mastermind delegation section", () => {
    const claude = read("CLAUDE.md");

    expect(claude).toMatch(/^## Model delegation .*mastermind/m);
    expect(claude).toContain('subagent_type: "lacayo-sonnet"');
    expect(claude).toContain('subagent_type: "lacayo-opus"');
    expect(claude).toContain("Verification never runs in the main session");
    expect(claude).toContain("Lacayos:");
  });

  it("MASTER-2: every command carries a Delegation paragraph that names mastermind", () => {
    const files = commands();
    const missing = files.filter((file) => {
      const paragraph = delegationParagraph(read(file));
      return paragraph === null || !paragraph.includes("mastermind");
    });

    expect(files.length).toBeGreaterThanOrEqual(21);
    expect(missing).toEqual([]);
  });

  it("MASTER-3: nothing delegates in the conditional", () => {
    const conditional = ["CLAUDE.md", ...commands()].filter((file) =>
      /\b(may|might) go to\b/i.test(read(file)),
    );

    expect(conditional).toEqual([]);
  });

  it("MASTER-4: no lacayo is picked by model name", () => {
    const byModel = ["CLAUDE.md", ...commands()].filter((file) => read(file).includes('model: "'));

    expect(byModel).toEqual([]);
  });

  it("MASTER-5: every command that delegates ends its report with the Lacayos line", () => {
    const delegating = commands().filter((file) =>
      /lacayo-(sonnet|opus)/.test(delegationParagraph(read(file)) ?? ""),
    );
    const withoutLine = delegating.filter((file) => !read(file).includes("Lacayos:"));

    expect(delegating.length).toBeGreaterThan(0);
    expect(withoutLine).toEqual([]);
  });
});
