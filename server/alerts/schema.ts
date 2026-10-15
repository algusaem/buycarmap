import { z } from "zod";
import type { AppError } from "@/lib/result";
import { searchSchema, type SearchInput } from "@/lib/search/schema";

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
  const hasLocation = criteria.latitude != null && criteria.longitude != null;
  return Boolean(criteria.brand) || criteria.maxPrice != null || hasLocation;
}

/**
 * The criteria an alert stores (MAPUI-42): never «Publicado» (`timeFilter`)
 * nor the `?q=` text (`keywords`). Stripped here, on the server's own parse,
 * so a direct call carrying either stores and hashes exactly what the dialog
 * would have sent.
 */
export function withoutUnsavedCriteria(criteria: SearchInput): SearchInput {
  const { timeFilter: _timeFilter, keywords: _keywords, ...saved } = criteria;
  return saved;
}

/**
 * The criteria an alert can be created with: the search schema without the
 * criteria an alert never saves, refined by the specificity rule (ALERT-38).
 * The create dialog (MAPUI-41) and `createAlert` both parse with it, so they
 * cannot disagree; a too-broad set fails with the single issue
 * `criteriaTooBroad`.
 */
export const alertCriteriaSchema = searchSchema
  .transform(withoutUnsavedCriteria)
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
