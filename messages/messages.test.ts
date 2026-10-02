import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// FRONT-8 (docs/specs/core-frontend.md). `messages/en.json` and
// `messages/es.json` do not exist yet (migration phase 9 moves copy there
// from the hand-rolled `lib/i18n/locales/*.ts`), so every assertion below
// fails structurally — reading them throws — until they are created.
//
// NOTE: this file is not yet included in any Vitest project's `include`
// glob. The "unit" project only picks up
// "{lib,components,app,server}/**/*.test.{ts,tsx}"; a top-level `messages/`
// directory matches none of those, so `pnpm test:unit`/`pnpm test` currently
// skip this file entirely until vitest.config.ts is updated — a config
// change outside this brief's authorised stubs.

type MessageTree = { [key: string]: string | MessageTree };

/**
 * Flattens a nested message tree into dot-joined leaf keys, e.g.
 * `{ favorites: { empty: "x" } }` → `["favorites.empty"]`. A pure,
 * test-local utility — not the production code under test.
 */
function flattenKeys(tree: MessageTree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? [path] : flattenKeys(value, path);
  });
}

/**
 * FRONT-8 worked example as a pure, test-local helper: a key present in `a`
 * and absent from `b` is reported by name. Hand-derived, not computed by
 * calling production code — there is no production equivalent of this
 * function; it exists only to drive the assertion below.
 */
function missingKeys(a: MessageTree, b: MessageTree): string[] {
  const bKeys = new Set(flattenKeys(b));
  return flattenKeys(a).filter((key) => !bKeys.has(key));
}

function readMessages(locale: "en" | "es"): MessageTree {
  const path = join(__dirname, `${locale}.json`);
  return JSON.parse(readFileSync(path, "utf-8")) as MessageTree;
}

function flattenValues(tree: MessageTree, prefix = ""): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string"
      ? [[path, value] as [string, string]]
      : flattenValues(value, path);
  });
}

describe("missingKeys", () => {
  it("FRONT-8: reports by name a key present in one tree and absent from the other", () => {
    // The spec's literal worked example: en has favorites.empty, es does not.
    const en: MessageTree = { favorites: { empty: "Nothing saved yet" } };
    const es: MessageTree = { favorites: {} };

    expect(missingKeys(en, es)).toEqual(["favorites.empty"]);
  });

  it("FRONT-8: reports nothing when both trees have the same keys", () => {
    const en: MessageTree = { map: { empty: "No results" } };
    const es: MessageTree = { map: { empty: "Sin resultados" } };

    expect(missingKeys(en, es)).toEqual([]);
  });
});

describe("message files", () => {
  it("FRONT-8: en.json and es.json exist at messages/ and declare the same key set", () => {
    const en = readMessages("en");
    const es = readMessages("es");

    expect(missingKeys(en, es)).toEqual([]);
    expect(missingKeys(es, en)).toEqual([]);
  });

  it("FRONT-8: every key in both locales has a non-empty string value", () => {
    const en = readMessages("en");
    const es = readMessages("es");

    const emptyEn = flattenValues(en).filter(([, value]) => value.trim() === "");
    const emptyEs = flattenValues(es).filter(([, value]) => value.trim() === "");

    expect(emptyEn).toEqual([]);
    expect(emptyEs).toEqual([]);
  });
});

describe("the hand-rolled i18n modules are removed", () => {
  it("FRONT-8: lib/i18n/translations.ts no longer exists", () => {
    expect(existsSync(join(__dirname, "..", "lib", "i18n", "translations.ts"))).toBe(false);
  });

  it("FRONT-8: lib/i18n/client.tsx no longer exists", () => {
    expect(existsSync(join(__dirname, "..", "lib", "i18n", "client.tsx"))).toBe(false);
  });

  it("FRONT-8: lib/i18n/server.ts no longer exists", () => {
    expect(existsSync(join(__dirname, "..", "lib", "i18n", "server.ts"))).toBe(false);
  });
});
