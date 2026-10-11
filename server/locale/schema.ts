import { z } from "zod";
import { LOCALES } from "@/lib/i18n/config";

// Codes, not sentences — same reasoning as FAVORITE_ERROR and ALERT_ERROR: a
// server action cannot read the client's i18n context, and the default locale
// is Spanish. The UI resolves these into copy at render time.
export const LOCALE_ERROR = {
  invalidLocale: "invalidLocale",
} as const;

export type LocaleErrorCode = (typeof LOCALE_ERROR)[keyof typeof LOCALE_ERROR];

// PLAT-27 (docs/specs/core-platform.md): setLocale's own input shape.
export const localeSchema = z.enum(LOCALES);
