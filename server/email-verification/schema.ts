import { z } from "zod";
import { AUTH_ERROR } from "@/lib/auth/errors";
import { email, tokenField } from "@/server/auth/schema";

export const changeEmailSchema = z.object({
  email,
  // No strength rules — this proves identity, it does not set a new password.
  currentPassword: z.string().min(1, AUTH_ERROR.passwordRequired),
});

export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;

// PLAT-27 (docs/specs/core-platform.md): confirmEmail's own input shape.
export const confirmEmailSchema = z.object({ token: tokenField });
