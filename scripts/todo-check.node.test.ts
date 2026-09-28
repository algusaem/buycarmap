import { describe, expect, it } from "vitest";

import { findUnreferencedTodos } from "./todo-check.mjs";

// scripts/todo-check.mjs flags a `TODO` comment with no issue reference. See
// docs/specs/core-tooling.md TOOLING-12 for the worked examples below.

describe("todo:check — unreferenced TODO comments", () => {
  it("TOOLING-12: // TODO: handle retries is reported", () => {
    const result = findUnreferencedTodos([{ path: "x.ts", text: "// TODO: handle retries" }]);
    expect(result).toEqual([{ path: "x.ts", line: 1 }]);
  });

  it("TOOLING-12: // TODO(#42): handle retries is accepted", () => {
    const result = findUnreferencedTodos([{ path: "x.ts", text: "// TODO(#42): handle retries" }]);
    expect(result).toEqual([]);
  });

  it("TOOLING-12: /* TODO see #7 */ is accepted", () => {
    const result = findUnreferencedTodos([{ path: "x.ts", text: "/* TODO see #7 */" }]);
    expect(result).toEqual([]);
  });

  it('TOOLING-12: const doc = "TODO.md"; is accepted (not a comment)', () => {
    const result = findUnreferencedTodos([{ path: "x.ts", text: 'const doc = "TODO.md";' }]);
    expect(result).toEqual([]);
  });

  it("TOOLING-12: * TODO: tidy inside a JSDoc block is reported", () => {
    const result = findUnreferencedTodos([{ path: "x.ts", text: " * TODO: tidy" }]);
    expect(result).toEqual([{ path: "x.ts", line: 1 }]);
  });

  it("TOOLING-12: reports the exact list of {path, line} across several files and lines, in order", () => {
    const result = findUnreferencedTodos([
      {
        path: "a.ts",
        text: ["const x = 1;", "// TODO: fix this", "const y = 2;", "// TODO(#1): done later"].join(
          "\n",
        ),
      },
      {
        path: "b.ts",
        text: ["/* TODO see #7 */", " * TODO: tidy", 'const doc = "TODO.md";'].join("\n"),
      },
    ]);

    expect(result).toEqual([
      { path: "a.ts", line: 2 },
      { path: "b.ts", line: 2 },
    ]);
  });
});
