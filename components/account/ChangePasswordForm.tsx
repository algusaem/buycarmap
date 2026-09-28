"use client";

import { signIn } from "next-auth/react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { useTranslation } from "@/lib/i18n/client";
import { translateAuthError } from "@/lib/i18n/errors";
import { AUTH_ERROR, changePasswordSchema, ChangePasswordInput } from "@/lib/validations/auth";
import { changePassword } from "@/app/actions/account";

interface ChangePasswordFormProps {
  email: string;
}

export function ChangePasswordForm({ email }: ChangePasswordFormProps) {
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
  });

  // `useWatch` rather than `watch` so the subscription is memo-safe.
  const password = useWatch({ control, name: "password" }) ?? "";

  const onSubmit = async (data: ChangePasswordInput) => {
    const formData = new FormData();
    formData.append("currentPassword", data.currentPassword);
    formData.append("password", data.password);
    formData.append("confirmPassword", data.confirmPassword);

    const result = await changePassword(formData);

    if (!result.success) {
      // Store raw codes, not translated sentences: the fields render through
      // `translateAuthError`, so translating here as well would feed a sentence
      // back into the code lookup and fall through to "generic".
      if (result.error === AUTH_ERROR.currentPasswordIncorrect) {
        setError("currentPassword", { message: result.error });
        return;
      }

      const isNewPasswordIssue =
        result.error === AUTH_ERROR.passwordBreached ||
        result.error === AUTH_ERROR.passwordWeak ||
        result.error === AUTH_ERROR.passwordReused;

      if (isNewPasswordIssue) {
        setError("password", { message: result.error });
        return;
      }

      toast.error(translateAuthError(t, result.error));
      return;
    }

    // The change bumped `passwordChangedAt`, which revokes every JWT issued
    // before it — including this tab's. Silently re-authenticating with the
    // password we already have mints a fresh token so the user stays signed in
    // here while every other device is signed out.
    await signIn("credentials", {
      email,
      password: data.password,
      redirect: false,
    });

    reset();
    toast.success(t.account.security.success);
  };

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="space-y-1">
        <CardTitle className="text-lg font-bold">{t.account.security.title}</CardTitle>
        <CardDescription>{t.account.security.description}</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Password managers need a username field adjacent to the password
              fields to associate the credential with the right account. */}
          <input type="email" name="email" value={email} autoComplete="username" readOnly hidden />

          <div className="space-y-2">
            <Label htmlFor="currentPassword">{t.account.security.currentPassword}</Label>
            <PasswordInput
              id="currentPassword"
              placeholder={t.account.security.currentPasswordPlaceholder}
              autoComplete="current-password"
              className="bg-background/50"
              error={translateAuthError(t, errors.currentPassword?.message)}
              {...register("currentPassword")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">{t.account.security.newPassword}</Label>
            <PasswordInput
              id="newPassword"
              placeholder={t.account.security.newPasswordPlaceholder}
              autoComplete="new-password"
              className="bg-background/50"
              error={translateAuthError(t, errors.password?.message)}
              {...register("password")}
            />
            <PasswordStrengthMeter password={password} userInputs={[email]} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmNewPassword">{t.account.security.confirmPassword}</Label>
            <PasswordInput
              id="confirmNewPassword"
              placeholder={t.account.security.confirmPasswordPlaceholder}
              autoComplete="new-password"
              className="bg-background/50"
              error={translateAuthError(t, errors.confirmPassword?.message)}
              {...register("confirmPassword")}
            />
          </div>

          <p className="text-xs text-muted-foreground">{t.account.security.signOutNotice}</p>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <AiOutlineLoading3Quarters className="h-4 w-4 animate-spin" />
                {t.account.security.submitting}
              </span>
            ) : (
              t.account.security.submit
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
