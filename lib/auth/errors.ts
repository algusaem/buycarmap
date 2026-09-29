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
  // Thrown only after a correct password, so it reveals nothing about whether
  // an account exists — you already had to prove the credentials.
  totpRequired: "totpRequired",
  totpInvalid: "totpInvalid",
  totpAlreadyEnabled: "totpAlreadyEnabled",
  totpNotEnabled: "totpNotEnabled",
  totpUnavailable: "totpUnavailable",
  alreadyVerified: "alreadyVerified",
  sameEmail: "sameEmail",
  lastSignInMethod: "lastSignInMethod",
  rateLimited: "rateLimited",
  unauthorized: "unauthorized",
  generic: "generic",
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR)[keyof typeof AUTH_ERROR];
