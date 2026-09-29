import { z } from "zod";
import {
  AUTH_ERROR,
  confirmPassword,
  email,
  newPassword,
  passwordsMatch,
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
