import { z } from "zod";
import { AUTH_ERROR } from "@/lib/auth/errors";

// BAUTH-11 (docs/specs/core-better-auth.md): these schemas validate the form
// data our actions hand to Better Auth's `twoFactor` plugin — the plugin's
// own endpoints are not reachable directly (BAUTH-6), so this is still where
// "a code" and "a password" are defined for this feature.

export const twoFactorCodeSchema = z.object({
  code: z.string().trim().min(1, AUTH_ERROR.totpInvalid),
});

export const twoFactorPasswordSchema = z.object({
  password: z.string().min(1, AUTH_ERROR.passwordRequired),
});

export const disableTwoFactorSchema = z.object({
  currentPassword: z.string().min(1, AUTH_ERROR.passwordRequired),
  code: z.string().trim().min(1, AUTH_ERROR.totpInvalid),
});
