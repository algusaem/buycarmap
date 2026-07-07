import { z } from "zod";

// Normalize email once, reused by both schemas: trim + lowercase so that
// "  Foo@Example.com " and "foo@example.com" are always the same account,
// on the client (RHF) and the server (register action / authorize).
const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Email is required")
  .email("Invalid email address");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z
  .object({
    name: z.string().optional(),
    email,
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      // bcrypt only uses the first 72 bytes; reject longer so a password is
      // never silently truncated (and to bound hashing work per request).
      .max(72, "Password must be at most 72 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
