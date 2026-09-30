import { z } from "zod";
import { AUTH_ERROR } from "@/lib/auth/errors";
import { confirmPassword, newPassword, passwordsMatch } from "@/server/auth/schema";

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

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
