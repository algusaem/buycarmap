import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Translations } from "./types";
import { AUTH_ERROR } from "@/lib/auth/errors";
import * as errorsModule from "./errors";
import { translateAuthError, translateError } from "./errors";

// FRONT-8 (docs/specs/core-frontend.md) deletes the hand-rolled locale
// objects (`lib/i18n/locales/*.ts`); copy now lives in `messages/en.json`
// and `messages/es.json`, read here the same way FRONT-12's block below
// already did before those files existed.
function readMessages(locale: "en" | "es"): Translations {
  const path = join(__dirname, "..", "..", "messages", `${locale}.json`);
  return JSON.parse(readFileSync(path, "utf-8")) as Translations;
}

const en = readMessages("en");
const es = readMessages("es");

describe("translateAuthError", () => {
  it("resolves a code to the copy for the active locale", () => {
    expect(translateAuthError(en, AUTH_ERROR.tokenInvalid)).toBe(
      "This link is invalid or has expired",
    );
    expect(translateAuthError(es, AUTH_ERROR.tokenInvalid)).toBe(
      "Este enlace no es válido o ha caducado",
    );
  });

  it("returns undefined for no code, so a field renders no error at all", () => {
    // The forms pass `errors.password?.message` straight through; an empty
    // string here would render an empty error paragraph under every field.
    expect(translateAuthError(en, undefined)).toBeUndefined();
  });

  it("falls back to the generic message for an unrecognized code", () => {
    // A raw identifier leaking into the UI is worse than a vague sentence.
    expect(translateAuthError(en, "somethingNobodyDefined")).toBe(
      "Something went wrong. Please try again.",
    );
  });

  it("falls back rather than echoing an already-translated sentence", () => {
    // The failure mode this guards: a form translating a code before calling
    // setError, so the field receives prose and looks it up as if it were a
    // code. It must not render that prose back as though it were valid.
    expect(translateAuthError(en, "This link is invalid or has expired")).toBe(
      "Something went wrong. Please try again.",
    );
  });

  it("DATA-16: has non-generic copy for the 'conflict' code in both locales", () => {
    const enResult = translateAuthError(en, "conflict");
    const esResult = translateAuthError(es, "conflict");

    expect(enResult).toBeTruthy();
    expect(enResult).not.toBe(en.authErrors.generic);
    expect(esResult).toBeTruthy();
    expect(esResult).not.toBe(es.authErrors.generic);
  });

  it("has copy for every error code the server can return", () => {
    // A code with no entry renders as "generic", which silently loses the
    // actual reason — so adding to AUTH_ERROR must mean adding to both locales.
    const missing = Object.values(AUTH_ERROR).filter(
      (code) => !(code in en.authErrors) || !(code in es.authErrors),
    );

    expect(missing).toEqual([]);
  });
});

// PLAT-13 (docs/specs/core-platform.md): translateAlertError is replaced by a
// single translateError(t, messageKey) that resolves a "<namespace>.<key>"
// path and falls back to a generic message for an unknown key.
describe("translateError", () => {
  it("PLAT-13: resolves a namespaced messageKey to the copy for the active locale", () => {
    expect(errorsModule.translateError(en, "alertErrors.criteriaTooBroad")).toBe(
      en.alertErrors.criteriaTooBroad,
    );
  });

  it("PLAT-13: falls back to a generic message for an unrecognized key", () => {
    expect(errorsModule.translateError(en, "alertErrors.nope")).toBe(
      "Something went wrong. Please try again.",
    );
  });

  it("PLAT-13: translateAlertError is removed", () => {
    expect("translateAlertError" in errorsModule).toBe(false);
  });

  it("PLAT-13: favoriteErrors.unauthenticated exists as non-empty copy in both locales", () => {
    expect(en.favoriteErrors?.unauthenticated).toBeTruthy();
    expect(es.favoriteErrors?.unauthenticated).toBeTruthy();
  });

  it("PLAT-13: favoriteErrors.invalidListing exists as non-empty copy in both locales", () => {
    expect(en.favoriteErrors?.invalidListing).toBeTruthy();
    expect(es.favoriteErrors?.invalidListing).toBeTruthy();
  });
});

// FRONT-12 (docs/specs/core-frontend.md): translateError/translateAuthError
// must resolve through next-intl's message files once they land. next-intl
// is not installed yet and messages/en.json does not exist yet (FRONT-8), so
// this reads it directly with fs rather than through next-intl's own loader —
// the earliest point this criterion can be asserted without inventing a
// signature change `server/search/actions.ts`'s "decided surfaces" never
// authorised. Decision recorded here rather than guessed silently: the
// current `translateError(t: Translations, messageKey)` signature is left
// unchanged; this test treats the parsed JSON as if it already were a
// `Translations` object, which is the shape FRONT-8 commits messages/en.json
// to having. Until that file exists, every assertion below fails at the
// `readFileSync` call.
describe("FRONT-12: resolving through next-intl's message files", () => {
  function readEnMessages(): Translations {
    const path = join(__dirname, "..", "..", "messages", "en.json");
    return JSON.parse(readFileSync(path, "utf-8")) as Translations;
  }

  it("FRONT-12: translateError returns messages/en.json's own value for authErrors.conflict", () => {
    const messages = readEnMessages();

    expect(translateError(messages, "authErrors.conflict")).toBe(messages.authErrors.conflict);
  });

  it("FRONT-12: translateAuthError also resolves against messages/en.json", () => {
    const messages = readEnMessages();

    expect(translateAuthError(messages, "conflict")).toBe(messages.authErrors.conflict);
  });
});
