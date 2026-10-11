import { z } from "zod";
import { AUTH_ERROR } from "@/lib/auth/errors";
import {
  confirmPassword,
  email,
  newPassword,
  passwordsMatch,
  tokenField,
} from "@/server/auth/schema";

export const registerSchema = z
  .object({
    name: z.string().trim().max(80, AUTH_ERROR.nameTooLong).optional(),
    email,
    password: newPassword,
    confirmPassword,
  })
  .refine(passwordsMatch.check, passwordsMatch.options);

export type RegisterInput = z.infer<typeof registerSchema>;

// PLAT-27 (docs/specs/core-platform.md): verifyRegistration's own input shape.
export const verifyRegistrationSchema = z.object({ token: tokenField });
