"use server";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/hash";
import { registerSchema } from "@/lib/validations/auth";

interface RegisterResult {
  success: boolean;
  error?: string;
}

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
    return { success: false, error: "An account with this email already exists" };
  }

  const hashedPassword = await hashPassword(password);

  await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name: name || null,
    },
  });

  return { success: true };
}
