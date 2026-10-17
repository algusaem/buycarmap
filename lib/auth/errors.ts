// Validation messages are *error codes*, not sentences. Zod runs on the server
// too, and a server action cannot read the client's React i18n context — before
// this, every server-side validation failure surfaced hardcoded English to a
// user whose default locale is Spanish. The UI resolves these codes through
// `translateAuthError` (lib/i18n/errors.ts).
export const AUTH_ERROR = {
  emailRequired: "emailRequired",
  emailInvalid: "emailInvalid",
  passwordRequired: "passwordRequired",
  passwordTooShort: "passwordTooShort",
  passwordTooLong: "passwordTooLong",
  passwordsDoNotMatch: "passwordsDoNotMatch",
  confirmPasswordRequired: "confirmPasswordRequired",
  nameTooLong: "nameTooLong",
  // Only reachable from the no-email fallback in server/registration/service.ts (and
  // from a losing race on an email change). Verify-first signup never emits it.
  emailTaken: "emailTaken",
  passwordBreached: "passwordBreached",
  passwordWeak: "passwordWeak",
  passwordReused: "passwordReused",
  currentPasswordIncorrect: "currentPasswordIncorrect",
  tokenInvalid: "tokenInvalid",
  totpInvalid: "totpInvalid",
  totpAlreadyEnabled: "totpAlreadyEnabled",
  totpNotEnabled: "totpNotEnabled",
  alreadyVerified: "alreadyVerified",
  sameEmail: "sameEmail",
  lastSignInMethod: "lastSignInMethod",
  rateLimited: "rateLimited",
  unauthorized: "unauthorized",
  // DATA-15/DATA-16 (docs/specs/core-data-model.md): optimistic-locking
  // conflict on updateProfile/changePassword — the `version` the form
  // rendered no longer matches the row.
  conflict: "conflict",
  generic: "generic",
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR)[keyof typeof AUTH_ERROR];

/**
 * The server's refusals of a new password, which a form shows under its new
 * password field, before the meter (docs/specs/redesign-pages.md, PAGES-3,
 * PAGES-42, worked example "Server rejections"): /reset-password and
 * «Cambiar contraseña».
 */
export const PASSWORD_REJECTIONS: readonly string[] = [
  AUTH_ERROR.passwordBreached,
  AUTH_ERROR.passwordWeak,
  AUTH_ERROR.passwordReused,
];

/** /register's: there is no current password a new one could reuse. */
export const REGISTER_PASSWORD_REJECTIONS: readonly string[] = PASSWORD_REJECTIONS.filter(
  (code) => code !== AUTH_ERROR.passwordReused,
);

/**
 * A refusal's code: one that carries none reads as `generic`
 * (docs/specs/redesign-pages.md, PAGES-4).
 */
export function refusalCode(code: AuthErrorCode | undefined): AuthErrorCode {
  return code ?? AUTH_ERROR.generic;
}

/**
 * The refusals a «Tu contraseña» field shows under itself, in «Dos pasos» and
 * «¿Eliminar tu cuenta?» (PAGES-44, PAGES-48, PAGES-55).
 */
export const CURRENT_PASSWORD_REJECTIONS: readonly string[] = [
  AUTH_ERROR.currentPasswordIncorrect,
  AUTH_ERROR.passwordRequired,
];
