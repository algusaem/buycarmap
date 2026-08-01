// Helpers for reading FormData into a Zod-parseable shape.
//
// `FormData.get` returns `string | File | null`. Casting that straight to
// `string` (as the actions used to) hands Zod a `null` whenever a field is
// absent — and `.optional()` accepts `undefined`, not `null`, so the parse
// fails with a raw untranslated Zod message instead of one of our error codes.
// A `File` would be even worse. Normalizing here keeps every action's parse
// input honest.

/** Absent or non-text fields become `undefined`, which `.optional()` accepts. */
export function optionalString(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * Absent or non-text fields become `""`, so the schema's own `min(1)` rule
 * produces a proper error code rather than a type complaint.
 */
export function requiredString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}
