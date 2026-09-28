"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import * as motion from "motion/react-client";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { ArrowLeft } from "lucide-react";
import { fadeInUp } from "@/lib/animations";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordInput } from "./PasswordInput";
import { PasswordStrengthMeter } from "./PasswordStrengthMeter";
import { useTranslation } from "@/lib/i18n/client";
import { translateAuthError } from "@/lib/i18n/errors";
import { AUTH_ERROR, resetPasswordSchema, ResetPasswordInput } from "@/lib/validations/auth";
import { resetPassword } from "@/app/actions/reset-password";

interface ResetPasswordFormProps {
  token: string;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const { t } = useTranslation();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    // The token comes from the URL, not from a field the user can see or edit.
    defaultValues: { token },
  });

  // `useWatch` rather than `watch` so the subscription is memo-safe.
  const password = useWatch({ control, name: "password" }) ?? "";

  const onSubmit = async (data: ResetPasswordInput) => {
    const formData = new FormData();
    formData.append("token", token);
    formData.append("password", data.password);
    formData.append("confirmPassword", data.confirmPassword);

    const result = await resetPassword(formData);

    if (!result.success) {
      // Password-specific rejections belong on the field, where the user is
      // looking, rather than in a toast that disappears.
      const isPasswordIssue =
        result.error === AUTH_ERROR.passwordBreached ||
        result.error === AUTH_ERROR.passwordWeak ||
        result.error === AUTH_ERROR.passwordReused;

      if (isPasswordIssue) {
        // Store the raw code, not the translated sentence: the field renders
        // through `translateAuthError`, so translating here too would feed a
        // sentence back into the code lookup and fall through to "generic".
        setError("password", { message: result.error });
        return;
      }

      toast.error(translateAuthError(t, result.error));
      return;
    }

    toast.success(t.resetPassword.success);
    // Deliberately not auto-signing in: the reset invalidated every session,
    // and requiring the new password once confirms it was actually memorized.
    router.push("/login");
  };

  return (
    <motion.div {...fadeInUp}>
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="space-y-1 pb-4">
          <Link
            href="/login"
            className="-ml-1 mb-2 inline-flex w-fit items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
          >
            <ArrowLeft className="h-3 w-3" />
            {t.resetPassword.backToLogin}
          </Link>
          <CardTitle className="text-2xl font-bold">{t.resetPassword.title}</CardTitle>
          <CardDescription>{t.resetPassword.description}</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">{t.resetPassword.newPassword}</Label>
              <PasswordInput
                id="password"
                placeholder={t.resetPassword.newPasswordPlaceholder}
                autoComplete="new-password"
                className="bg-background/50"
                error={translateAuthError(t, errors.password?.message)}
                {...register("password")}
              />
              <PasswordStrengthMeter password={password} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t.resetPassword.confirmPassword}</Label>
              <PasswordInput
                id="confirmPassword"
                placeholder={t.resetPassword.confirmPasswordPlaceholder}
                autoComplete="new-password"
                className="bg-background/50"
                error={translateAuthError(t, errors.confirmPassword?.message)}
                {...register("confirmPassword")}
              />
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <AiOutlineLoading3Quarters className="h-4 w-4 animate-spin" />
                  {t.resetPassword.submitting}
                </span>
              ) : (
                t.resetPassword.submit
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
