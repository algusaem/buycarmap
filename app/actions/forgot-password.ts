"use server";

import { forgotPasswordSchema } from "@/lib/validations/auth";

interface ForgotPasswordResult {
  success: boolean;
  error?: string;
}

// NOTE: This validates the request but does not yet send anything. Password
// reset delivery is not implemented — it needs a mailer and a reset-token model.
// Full plan: docs/specs/auth-email-and-oauth.md (Iterations A & B). The response
// is deliberately generic so that, once wired, it never reveals whether an
// account exists for the email.
export async function requestPasswordReset(
  formData: FormData,
): Promise<ForgotPasswordResult> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email") as string,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  // TODO: look up the user, mint a single-use reset token, and email the link.
  return { success: true };
}
