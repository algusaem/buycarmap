import { searchSchema, type SearchInput } from "@/lib/search/schema";

// Codes, not sentences — same reasoning as FAVORITE_ERROR and AUTH_ERROR: a
// server action cannot read the client's i18n context, and the default locale
// is Spanish. The UI resolves these into copy at render time.
export const ALERT_ERROR = {
  unauthenticated: "unauthenticated",
  invalidCriteria: "invalidCriteria",
  criteriaTooBroad: "criteriaTooBroad",
  tooManyAlerts: "tooManyAlerts",
  unexpected: "unexpected",
} as const;

export type AlertErrorCode = (typeof ALERT_ERROR)[keyof typeof ALERT_ERROR];

/**
 * Re-validates criteria read back from the database.
 *
 * The column is `Json`, so what comes out is not typed just because what went
 * in was. A migration, a manual edit or an older shape would otherwise be
 * handed straight to the source clients.
 */
export function parseStoredCriteria(value: unknown): SearchInput | null {
  const parsed = searchSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
