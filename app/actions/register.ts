"use server";

import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/hash";
import { registerSchema } from "@/lib/validations/auth";

interface RegisterResult {
  success: boolean;
  error?: string;
}

const DUPLICATE_EMAIL_ERROR = "An account with this email already exists";

export async function register(formData: FormData): Promise<RegisterResult> {
  const rawData = {
    name: formData.get("name") as string | undefined,
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    confirmPassword: formData.get("confirmPassword") as string,
  };

  const parsed = registerSchema.safeParse(rawData);

  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return { success: false, error: firstError.message };
  }

  const { email, password, name } = parsed.data;

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return { success: false, error: DUPLICATE_EMAIL_ERROR };
  }

  const hashedPassword = await hashPassword(password);

  try {
    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null,
      },
    });
  } catch (error) {
    // The check above is not atomic: two concurrent signups can both pass it,
    // and the DB's unique index on email is the real guard. Surface that race
    // as the same friendly message instead of throwing an unhandled error.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { success: false, error: DUPLICATE_EMAIL_ERROR };
    }
    // Unexpected failure: no message, so the form shows its localized fallback.
    return { success: false };
  }

  return { success: true };
}
