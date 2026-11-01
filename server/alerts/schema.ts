import { z } from "zod";
import type { AppError } from "@/lib/result";
import { hasPlace, KEYWORDS_MAX_LENGTH, searchSchema, type SearchInput } from "@/lib/search/schema";

// Codes, not sentences — same reasoning as FAVORITE_ERROR and AUTH_ERROR: a
// server action cannot read the client's i18n context, and the default locale
// is Spanish. The UI resolves these into copy at render time.
export const ALERT_ERROR = {
  unauthenticated: "unauthenticated",
  invalidCriteria: "invalidCriteria",
  criteriaTooBroad: "criteriaTooBroad",
  tooManyAlerts: "tooManyAlerts",
} as const;

export type AlertErrorCode = (typeof ALERT_ERROR)[keyof typeof ALERT_ERROR];

export type AlertError = AppError<AlertErrorCode>;

// MAPUI-43 (docs/specs/redesign-map.md › Contracts): `created` is false when
// the caller already had a live alert on these criteria, and true for a new
// one, a paused one reactivated or a soft-deleted one restored.
export interface CreateAlertOutcome {
  created: boolean;
}

// PLAT-27 (docs/specs/core-platform.md): createAlert's own label shape.
export const alertLabelSchema = z.string().trim().min(1);

// docs/specs/redesign-map.md (MAPUI-44): the create dialog's form, the same
// label rule the action applies.
export const createAlertFormSchema = z.object({ label: alertLabelSchema });

// LAYOUT-5 (docs/decisions/0007-adopt-core-rules.md): the form values type
// is exported from here, next to the schema, so CreateAlert.tsx never needs
// its own `z.infer` — only server/*/schema.ts, lib/search/schema.ts,
// lib/env.ts, lib/ids.ts and tests may import zod.
export type CreateAlertFormValues = z.infer<typeof createAlertFormSchema>;

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
  return Boolean(criteria.brand) || criteria.maxPrice != null || hasPlace(criteria);
}

/**
 * The criteria an alert stores (MAPUI-42, reversed for the `?q=` text by
 * docs/specs/map-description-search.md, DESC-22): never «Publicado»
 * (`timeFilter`). The text is kept and hashed with the rest — an alert is a
 * saved search, and must not promise less than the search it came from.
 * Stripped here, on the server's own parse, so a direct call carrying
 * `timeFilter` stores and hashes exactly what the dialog would have sent.
 */
export function withoutUnsavedCriteria(criteria: SearchInput): SearchInput {
  const { timeFilter: _timeFilter, ...saved } = criteria;
  return saved;
}

/**
 * Normalises `keywords` for storage (DESC-22, DESC-23): trimmed, and dropped
 * entirely once trimming leaves nothing — so a blank text hashes exactly as
 * no text at all, and an existing alert is still «Ya tienes esta alerta».
 */
function withNormalizedKeywords(criteria: SearchInput): SearchInput {
  if (criteria.keywords === undefined) return criteria;
  const trimmed = criteria.keywords.trim();
  if (trimmed === "") {
    const { keywords: _keywords, ...rest } = criteria;
    return rest;
  }
  return { ...criteria, keywords: trimmed };
}

// DESC-31: a NUL byte or a lone (unpaired) surrogate are both text a
// Postgres `jsonb` column refuses to store. Split in two, not one
// `/[\u0000\p{Cs}]/u` literal — Biome's noControlCharactersInRegex rejects a
// control character inside a `/…/` pattern even escaped, and its own
// useRegexLiterals rejects building the same pattern from a string instead,
// so the NUL check is a plain string method and only the surrogate check,
// which names no control character, stays a regex literal.
function hasJsonbUnsafeText(text: string): boolean {
  return text.includes("\u0000") || /\p{Cs}/u.test(text);
}

/**
 * The criteria an alert can be created with: the search schema without the
 * criteria an alert never saves, its text normalised and length-checked
 * (DESC-25), refined by the specificity rule (ALERT-38). The create dialog
 * (MAPUI-41) and `createAlert` both parse with it, so they cannot disagree; a
 * too-broad set fails with the single issue `criteriaTooBroad`, and text over
 * the limit fails as invalid criteria — `createAlert` reports `invalidCriteria`
 * for any issue that is not `criteriaTooBroad`.
 */
export const alertCriteriaSchema = searchSchema
  .transform(withoutUnsavedCriteria)
  .transform(withNormalizedKeywords)
  .refine((criteria) => (criteria.keywords?.length ?? 0) <= KEYWORDS_MAX_LENGTH, {
    error: ALERT_ERROR.invalidCriteria,
  })
  .refine((criteria) => !hasJsonbUnsafeText(criteria.keywords ?? ""), {
    error: ALERT_ERROR.invalidCriteria,
  })
  .refine(isSpecificEnough, {
    error: ALERT_ERROR.criteriaTooBroad,
  });

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

/**
 * docs/specs/redesign-alerts.md (ALERTUI-46, ALERTUI-47; Contracts › Server):
 * `createAlert`'s optional third argument, the place chosen in «Dónde»,
 * trimmed, then at most `ALERT_PLACE_NAME_MAX` characters, and null when
 * empty or missing.
 */
export const ALERT_PLACE_NAME_MAX = 200;

export const alertPlaceNameSchema = z
  .string()
  .trim()
  .max(ALERT_PLACE_NAME_MAX)
  .optional()
  .transform((value) => value || null);
