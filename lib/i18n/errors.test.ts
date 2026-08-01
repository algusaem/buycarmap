import { describe, expect, it } from "vitest";
import { en } from "./locales/en";
import { es } from "./locales/es";
import { AUTH_ERROR } from "@/lib/validations/auth";
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
    expect(
      translateAuthError(en, "This link is invalid or has expired"),
    ).toBe("Something went wrong. Please try again.");
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
