import { createHash } from "node:crypto";
import { searchSchema, type SearchInput } from "@/server/search/schema";

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
 * A proxy for the real constraint, which is total distinct criteria sets —
 * that is what the upstreams see. Each alert is a standing claim on a
 * rate-limited API, so an unbounded count lets one account consume the shared
 * budget that protects search.
 */
export const MAX_ALERTS_PER_USER = 20;

/**
 * Whether a criteria set is specific enough to be worth watching.
 *
 * Nothing else stops someone saving "every car in Spain": its seed poll is
 * thousands of listings, it matches on nearly every lap, and it is useless as
 * an alert because an alert that fires constantly is noise.
 *
 * A deliberately low bar — any alert a person actually wants clears it without
 * thinking, and only the degenerate case is rejected. Capping matches per run
 * instead would silently drop listings the user asked to be told about, which
 * is the one thing this feature must not do.
 */
export function isSpecificEnough(criteria: SearchInput): boolean {
  const hasLocation = criteria.latitude != null && criteria.longitude != null;
  return Boolean(criteria.brand) || criteria.maxPrice != null || hasLocation;
}

/**
 * Recursively sorts object keys and drops `undefined`.
 *
 * Two users building the same filters through different UI paths produce
 * objects with different key order and different absent-vs-undefined fields.
 * Hashing them raw would give two criteria rows for one question, and the
 * upstream saving from deduplication is the whole reason this feature scales.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    // Arrays here are unordered sets (`engine`, `gearbox`), so ["a","b"] and
    // ["b","a"] are the same filter and must hash alike.
    return [...value].map(canonicalize).sort();
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .reduce<Record<string, unknown>>((out, [key, entry]) => {
        out[key] = canonicalize(entry);
        return out;
      }, {});
  }
  return value;
}

/** Stable identity for a criteria set, so equivalent filters share one row. */
export function hashCriteria(criteria: SearchInput): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(criteria)))
    .digest("hex");
}

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
