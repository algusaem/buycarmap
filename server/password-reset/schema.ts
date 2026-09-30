import { z } from "zod";
import { AUTH_ERROR } from "@/lib/auth/errors";
import { confirmPassword, newPassword, passwordsMatch } from "@/server/auth/schema";

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, AUTH_ERROR.tokenInvalid),
    password: newPassword,
    confirmPassword,
  })
  .refine(passwordsMatch.check, passwordsMatch.options);

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
