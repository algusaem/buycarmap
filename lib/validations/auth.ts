import { z } from "zod";
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from "@/lib/auth/password-strength";

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
  // Only reachable from the no-email fallback in app/actions/register.ts (and
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

// Normalize email once, reused by every schema: trim + lowercase so that
// "  Foo@Example.com " and "foo@example.com" are always the same account,
// on the client (RHF) and the server (register action / authorize).
const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, AUTH_ERROR.emailRequired)
  .email(AUTH_ERROR.emailInvalid);

// One definition of "an acceptable new password", shared by register, reset,
// and change-password so the three can never drift apart. Length only — the
// strength and breach checks are async and run server-side in
// `lib/auth/password-policy.ts`.
const newPassword = z
  .string()
  .min(MIN_PASSWORD_LENGTH, AUTH_ERROR.passwordTooShort)
  // bcrypt only uses the first 72 bytes; reject longer so a password is never
  // silently truncated (and to bound hashing work per request).
  .max(MAX_PASSWORD_LENGTH, AUTH_ERROR.passwordTooLong);

const confirmPassword = z.string().min(1, AUTH_ERROR.confirmPasswordRequired);

const passwordsMatch = {
  check: (data: { password: string; confirmPassword: string }) =>
    data.password === data.confirmPassword,
  options: {
    message: AUTH_ERROR.passwordsDoNotMatch,
    path: ["confirmPassword"],
  },
};

// A 6-digit TOTP code or a formatted recovery code. Kept permissive here —
// which of the two it is gets decided server-side, and a length rule on this
// field would only tell an attacker which format the account uses.
const twoFactorCode = z.string().trim().optional();

export const loginSchema = z.object({
  email,
  // Never apply strength rules at login: existing accounts may predate the
  // current policy, and a length hint on the login form leaks the policy to
  // an attacker for free.
  password: z.string().min(1, AUTH_ERROR.passwordRequired),
  // Absent on the first attempt; supplied after the form learns 2FA is on.
  totp: twoFactorCode,
});

export const twoFactorCodeSchema = z.object({
  code: z.string().trim().min(1, AUTH_ERROR.totpInvalid),
});

export const disableTwoFactorSchema = z.object({
  currentPassword: z.string().min(1, AUTH_ERROR.passwordRequired),
  code: z.string().trim().min(1, AUTH_ERROR.totpInvalid),
});

export const registerSchema = z
  .object({
    name: z.string().trim().max(80, AUTH_ERROR.nameTooLong).optional(),
    email,
    password: newPassword,
    confirmPassword,
  })
  .refine(passwordsMatch.check, passwordsMatch.options);

export const forgotPasswordSchema = z.object({
  email,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, AUTH_ERROR.tokenInvalid),
    password: newPassword,
    confirmPassword,
  })
  .refine(passwordsMatch.check, passwordsMatch.options);

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, AUTH_ERROR.passwordRequired),
    password: newPassword,
    confirmPassword,
  })
  .refine(passwordsMatch.check, passwordsMatch.options);

export const updateProfileSchema = z.object({
  name: z.string().trim().max(80, AUTH_ERROR.nameTooLong),
});

export const changeEmailSchema = z.object({
  email,
  // No strength rules — this proves identity, it does not set a new password.
  currentPassword: z.string().min(1, AUTH_ERROR.passwordRequired),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;
export type TwoFactorCodeInput = z.infer<typeof twoFactorCodeSchema>;
export type DisableTwoFactorInput = z.infer<typeof disableTwoFactorSchema>;
