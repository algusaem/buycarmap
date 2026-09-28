import { describe, expect, it } from "vitest";

import { findUnreferencedTodos } from "./todo-check.mjs";

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
