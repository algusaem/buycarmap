// Codes, not sentences — same reasoning as FAVORITE_ERROR and ALERT_ERROR: a
// server action cannot read the client's i18n context, and the default locale
// is Spanish. The UI resolves these into copy at render time.
export const LOCALE_ERROR = {
  invalidLocale: "invalidLocale",
} as const;

export type LocaleErrorCode = (typeof LOCALE_ERROR)[keyof typeof LOCALE_ERROR];
