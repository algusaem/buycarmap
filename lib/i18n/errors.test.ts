import { describe, expect, it } from "vitest";
import { en } from "./locales/en";
import { es } from "./locales/es";
import { AUTH_ERROR } from "@/lib/auth/errors";
import * as errorsModule from "./errors";
import { translateAuthError } from "./errors";

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
