import { describe, expect, it } from "vitest";

import { specStatus } from "./spec-status.mjs";

describe("specStatus", () => {
  const header = (status: string) => `# X\n\nKey: X\nStatus: ${status}\nLast updated: 2026-10-11\n`;

  it.each([
    ["Implemented", "Implemented"],
    ["**Implemented**", "Implemented"],
    ["Implemented (2026-10-11)", "Implemented"],
    ["Approved", "Approved"],
    ["**Approved**", "Approved"],
    ["Draft", "Draft"],
  ])("DOCS-13: reads Status: %s as %s", (status, expected) => {
    expect(specStatus(header(status))).toBe(expected);
  });

  it("DOCS-13: returns undefined when there is no Status line", () => {
    expect(specStatus("# X\n\nKey: X\n")).toBeUndefined();
  });
});
