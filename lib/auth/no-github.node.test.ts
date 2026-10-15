import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// docs/specs/redesign-entry.md (ENTRY-18). A source-level sweep rather than a
// runtime check, so it proves the provider, its env vars and its copy are
// gone from the files themselves, independent of any test harness fixture.
const ROOT = join(__dirname, "..", "..");

function read(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf-8");
}

describe("ENTRY-18: the app has no GitHub sign-in", () => {
  it("ENTRY-18: lib/auth/auth.ts registers no GitHub provider", () => {
    expect(read("lib/auth/auth.ts")).not.toMatch(/github/i);
  });

  it("ENTRY-18: the env schema (lib/env.ts) declares no GitHub variables", () => {
    expect(read("lib/env.ts")).not.toMatch(/github/i);
  });

  it("ENTRY-18: .env.example documents no GitHub variables", () => {
    expect(read(".env.example")).not.toMatch(/github/i);
  });

  it("ENTRY-18: no English message key or text names GitHub", () => {
    expect(read("messages/en.json")).not.toMatch(/github/i);
  });

  it("ENTRY-18: no Spanish message key or text names GitHub", () => {
    expect(read("messages/es.json")).not.toMatch(/github/i);
  });
});
