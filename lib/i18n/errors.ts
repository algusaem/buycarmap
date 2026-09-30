import type { Translations } from "./types";

// Bridges the locale-free error codes produced by Zod schemas and server
// actions (lib/auth/errors.ts) to localized copy. Server code cannot read
// the client i18n context, so it returns codes and the form translates them
// here at render time.
export function translateAuthError(t: Translations, code: string | undefined): string | undefined {
  if (!code) return undefined;

  const messages: Record<string, string> = t.authErrors;

  // An unrecognized code means a message escaped the code system — show the
  // generic fallback rather than leaking a raw identifier into the UI.
  return messages[code] ?? t.authErrors.generic;
}

// The namespaces translateError is allowed to index into dynamically. Kept
// as a closed list, rather than widening Translations with an index
// signature, so every other property on Translations still narrows to its
// own type at every existing call site.
type ErrorNamespace = "alertErrors" | "favoriteErrors" | "localeErrors" | "authErrors";

const ERROR_NAMESPACES: readonly ErrorNamespace[] = [
  "alertErrors",
  "favoriteErrors",
  "localeErrors",
  "authErrors",
];

function isErrorNamespace(value: string): value is ErrorNamespace {
  return (ERROR_NAMESPACES as readonly string[]).includes(value);
}

/**
 * Resolves a `"<namespace>.<code>"` messageKey (PLAT-10/PLAT-13,
 * docs/specs/core-platform.md) — the shape every converted Server Action's
 * `Result` error carries — to the copy for the active locale.
 *
 * Falls back to `alertErrors.unexpected` for a namespace or code that either
 * does not exist or does not resolve to a string, so an unrecognized key
 * never leaks a raw identifier into the UI. Replaces `translateAlertError`.
 */
export function translateError(t: Translations, messageKey: string | undefined): string {
  if (!messageKey) return t.alertErrors.unexpected;

  const [namespace, code] = messageKey.split(".");
  if (!namespace || !code || !isErrorNamespace(namespace)) return t.alertErrors.unexpected;

  const bucket: Record<string, string> = t[namespace];
  const message = bucket[code];
  return typeof message === "string" ? message : t.alertErrors.unexpected;
}
