import { z } from "zod";
import { AUTH_ERROR } from "@/lib/auth/errors";

export const twoFactorCodeSchema = z.object({
  code: z.string().trim().min(1, AUTH_ERROR.totpInvalid),
});

export const disableTwoFactorSchema = z.object({
  currentPassword: z.string().min(1, AUTH_ERROR.passwordRequired),
  code: z.string().trim().min(1, AUTH_ERROR.totpInvalid),
});
