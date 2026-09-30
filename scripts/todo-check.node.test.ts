import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { findUnreferencedTodos, main } from "./todo-check.mjs";

// scripts/todo-check.mjs flags an unreferenced marker comment with no issue
// reference. See docs/specs/core-tooling.md TOOLING-12 for the worked
// examples below.

// Built from parts so this file doesn't trip the check it tests.
const TAG = ["TO", "DO"].join("");

describe("todo:check — unreferenced TODO comments", () => {
  it("TOOLING-12: an unreferenced marker in a line comment is reported", () => {
    const result = findUnreferencedTodos([{ path: "x.ts", text: `// ${TAG}: handle retries` }]);
    expect(result).toEqual([{ path: "x.ts", line: 1 }]);
  });

  it("TOOLING-12: a marker with an issue in parentheses is accepted", () => {
    const result = findUnreferencedTodos([
      { path: "x.ts", text: `// ${TAG}(#42): handle retries` },
    ]);
    expect(result).toEqual([]);
  });

  it("TOOLING-12: a marker in a block comment with an issue is accepted", () => {
    const result = findUnreferencedTodos([{ path: "x.ts", text: `/* ${TAG} see #7 */` }]);
    expect(result).toEqual([]);
  });

  it("TOOLING-12: a marker inside a string is accepted (not a comment)", () => {
    const result = findUnreferencedTodos([{ path: "x.ts", text: `const doc = "${TAG}.md";` }]);
    expect(result).toEqual([]);
  });

  it("TOOLING-12: a marker on the second line of a JSDoc block is reported at that line", () => {
    const result = findUnreferencedTodos([{ path: "x.ts", text: `/**\n * ${TAG}: tidy\n */` }]);
    expect(result).toEqual([{ path: "x.ts", line: 2 }]);
  });

  it("TOOLING-12: a marker inside a string URL is accepted (not a comment)", () => {
    const result = findUnreferencedTodos([
      { path: "x.ts", text: `const u = "https://example.test/${TAG}";` },
    ]);
    expect(result).toEqual([]);
  });

  it("TOOLING-12: a marker on the second line of a block comment is reported at that line", () => {
    const result = findUnreferencedTodos([
      {
        path: "x.css",
        text: `/* Leaflet overrides.\n   ${TAG}: drop after phase 9 */`,
      },
    ]);
    expect(result).toEqual([{ path: "x.css", line: 2 }]);
  });

  it("TOOLING-12: an issue reference outside the comment does not count", () => {
    const result = findUnreferencedTodos([
      { path: "x.css", text: `/* ${TAG} tidy */ color: #123456;` },
    ]);
    expect(result).toEqual([{ path: "x.css", line: 1 }]);
  });

  it("TOOLING-12: a marker after a regex literal containing a backtick is reported", () => {
    const result = findUnreferencedTodos([{ path: "x.ts", text: `const r = /\`/;\n// ${TAG}: x` }]);
    expect(result).toEqual([{ path: "x.ts", line: 2 }]);
  });

  it("TOOLING-12: a marker inside a string that merely starts with * is accepted", () => {
    const result = findUnreferencedTodos([{ path: "x.ts", text: `const x = a\n  * b("${TAG}")` }]);
    expect(result).toEqual([]);
  });

  it("TOOLING-12: a marker on the second line of a CSS block comment is reported at that line", () => {
    const result = findUnreferencedTodos([
      { path: "x.css", text: `* { margin: 0; } /* start\n ${TAG} here\n*/` },
    ]);
    expect(result).toEqual([{ path: "x.css", line: 2 }]);
  });

  it("TOOLING-12: a marker inside a string with an escaped quote is accepted", () => {
    const result = findUnreferencedTodos([
      { path: "x.ts", text: `const s = "a \\" // ${TAG}: x";` },
    ]);
    expect(result).toEqual([]);
  });

  it("TOOLING-12: a marker on the middle line of a multi-line template literal is accepted", () => {
    const result = findUnreferencedTodos([
      {
        path: "x.ts",
        text: `const s = \`line one\n// ${TAG}: not a comment\nline three\`;`,
      },
    ]);
    expect(result).toEqual([]);
  });

  it("TOOLING-12: a CRLF file reports only the unreferenced line", () => {
    const result = findUnreferencedTodos([
      { path: "x.ts", text: `// ${TAG}: a\r\n// ${TAG}(#3): b` },
    ]);
    expect(result).toEqual([{ path: "x.ts", line: 1 }]);
  });

  it("TOOLING-12: a marker inside a function body is reported at that line", () => {
    const result = findUnreferencedTodos([
      { path: "x.ts", text: `function f() {\n  // ${TAG}: x\n}` },
    ]);
    expect(result).toEqual([{ path: "x.ts", line: 2 }]);
  });

  it("TOOLING-12: a marker after a statement inside a function body is reported at that line", () => {
    const result = findUnreferencedTodos([
      { path: "x.ts", text: `function f() {\n  g();\n  // ${TAG}: more\n}` },
    ]);
    expect(result).toEqual([{ path: "x.ts", line: 3 }]);
  });

  it("TOOLING-12: a marker before an object literal's closing brace is reported at that line", () => {
    const result = findUnreferencedTodos([
      { path: "x.ts", text: `const o = {\n  // ${TAG}: fill\n};` },
    ]);
    expect(result).toEqual([{ path: "x.ts", line: 2 }]);
  });

  it("TOOLING-12: a marker before an array literal's closing bracket is reported at that line", () => {
    const result = findUnreferencedTodos([
      { path: "x.ts", text: `const a = [\n  1,\n  // ${TAG}: more\n];` },
    ]);
    expect(result).toEqual([{ path: "x.ts", line: 3 }]);
  });

  it("TOOLING-12: a marker inside a call argument's block comment is reported", () => {
    const result = findUnreferencedTodos([{ path: "x.ts", text: `foo(/* ${TAG} */);` }]);
    expect(result).toEqual([{ path: "x.ts", line: 1 }]);
  });

  it("TOOLING-12: a marker inside a JSX expression container is reported", () => {
    const result = findUnreferencedTodos([
      { path: "x.tsx", text: `const e = <div>{/* ${TAG}: x */}</div>;` },
    ]);
    expect(result).toEqual([{ path: "x.tsx", line: 1 }]);
  });

  it("TOOLING-12: a marker-looking word in JSX text is accepted (not a comment)", () => {
    const result = findUnreferencedTodos([
      { path: "x.tsx", text: `const e = <p>// ${TAG} later</p>;` },
    ]);
    expect(result).toEqual([]);
  });

  it("TOOLING-12: an unreferenced marker is reported in a .mjs file", () => {
    const result = findUnreferencedTodos([{ path: "x.mjs", text: `// ${TAG}: x` }]);
    expect(result).toEqual([{ path: "x.mjs", line: 1 }]);
  });

  it("TOOLING-12: an unreferenced marker is reported in a .cjs file", () => {
    const result = findUnreferencedTodos([{ path: "x.cjs", text: `// ${TAG}: x` }]);
    expect(result).toEqual([{ path: "x.cjs", line: 1 }]);
  });

  it("TOOLING-12: an unreferenced marker is reported in a .js file", () => {
    const result = findUnreferencedTodos([{ path: "x.js", text: `// ${TAG}: x` }]);
    expect(result).toEqual([{ path: "x.js", line: 1 }]);
  });

  it("TOOLING-12: a marker in a .md file is accepted (not scanned)", () => {
    const result = findUnreferencedTodos([{ path: "notes.md", text: `// ${TAG}: x` }]);
    expect(result).toEqual([]);
  });

  it("TOOLING-12: a marker in a Makefile is accepted (not scanned)", () => {
    const result = findUnreferencedTodos([{ path: "Makefile", text: `// ${TAG}: x` }]);
    expect(result).toEqual([]);
  });

  it("TOOLING-12: several files report every hit in order", () => {
    const result = findUnreferencedTodos([
      {
        path: "a.ts",
        text: [
          "const x = 1;",
          `// ${TAG}: fix this`,
          "const y = 2;",
          `// ${TAG}(#1): done later`,
        ].join("\n"),
      },
      {
        path: "b.ts",
        text: [
          `/* ${TAG} see #7 */`,
          "/**",
          ` * ${TAG}: tidy`,
          " */",
          `const doc = "${TAG}.md";`,
        ].join("\n"),
      },
    ]);

    expect(result).toEqual([
      { path: "a.ts", line: 2 },
      { path: "b.ts", line: 3 },
    ]);
  });
});

// `main`, called in-process against a throwaway git repository (never this
// one) with `cwd`/`readFileFn`/`log`/`error`/`exit` injected. The child-process
// CLI test (todo-check.cli.node.test.ts) pins the same behaviour as `pnpm
// todo:check` actually runs it; this proves `main` itself, in a form the
// coverage instrumentation can see.
describe("main", () => {
  let repo: string;

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), "todo-check-main-"));
    const run = (...args: string[]) => execFileSync("git", args, { cwd: repo });
    run("init", "-q");
    run("config", "user.email", "guard@example.test");
    run("config", "user.name", "Guard");
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  it("TOOLING-12: reports the unreferenced marker and exits 1", async () => {
    writeFileSync(join(repo, "a.ts"), `// ${TAG}: x`);
    execFileSync("git", ["add", "a.ts"], { cwd: repo });
    const log = vi.fn();
    const error = vi.fn();
    const exit = vi.fn();

    await main({ cwd: repo, log, error, exit });

    expect(error).toHaveBeenCalledWith("a.ts:1  TODO without an issue reference");
    expect(exit).toHaveBeenCalledWith(1);
    expect(log).not.toHaveBeenCalled();
  });

  it("TOOLING-12: passes and reports the scanned file count with an issue reference", async () => {
    writeFileSync(join(repo, "a.ts"), `// ${TAG}(#1): x`);
    execFileSync("git", ["add", "a.ts"], { cwd: repo });
    const log = vi.fn();
    const error = vi.fn();
    const exit = vi.fn();

    await main({ cwd: repo, log, error, exit });

    expect(log).toHaveBeenCalledWith("todo:check passed - 1 file(s) scanned.");
    expect(exit).not.toHaveBeenCalled();
  });

  it("skips a tracked path that no longer exists on disk", async () => {
    // git ls-files can list a path that was deleted but not yet staged as
    // such — main must not throw trying to read it.
    writeFileSync(join(repo, "a.ts"), `// ${TAG}(#1): x`);
    execFileSync("git", ["add", "a.ts"], { cwd: repo });
    execFileSync("git", ["commit", "-q", "-m", "add a.ts"], { cwd: repo });
    rmSync(join(repo, "a.ts"));
    const log = vi.fn();
    const error = vi.fn();
    const exit = vi.fn();

    await main({ cwd: repo, log, error, exit });

    expect(log).toHaveBeenCalledWith("todo:check passed - 0 file(s) scanned.");
    expect(error).not.toHaveBeenCalled();
  });

  it("ignores an extension todo:check does not scan (.md)", async () => {
    writeFileSync(join(repo, "notes.md"), `${TAG}: x`);
    execFileSync("git", ["add", "notes.md"], { cwd: repo });
    const log = vi.fn();
    const exit = vi.fn();

    await main({ cwd: repo, log, exit });

    expect(log).toHaveBeenCalledWith("todo:check passed - 0 file(s) scanned.");
    expect(exit).not.toHaveBeenCalled();
  });
});
