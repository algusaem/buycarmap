import type { Translations } from "./types";

// Bridges the locale-free error codes produced by Zod schemas and server
// actions (lib/validations/auth.ts) to localized copy. Server code cannot read
// the client i18n context, so it returns codes and the form translates them
// here at render time.
export function translateAuthError(t: Translations, code: string | undefined): string | undefined {
  if (!code) return undefined;

  const messages: Record<string, string> = t.authErrors;

  // An unrecognized code means a message escaped the code system — show the
  // generic fallback rather than leaking a raw identifier into the UI.
  return messages[code] ?? t.authErrors.generic;
}

export function translateAlertError(t: Translations, code: string | undefined): string {
  if (!code) return t.alertErrors.unexpected;

  const messages: Record<string, string> = t.alertErrors;

  return messages[code] ?? t.alertErrors.unexpected;
}
