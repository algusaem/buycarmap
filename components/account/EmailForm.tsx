"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { BadgeCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { useTranslation } from "@/lib/i18n/client";
import { translateAuthError } from "@/lib/i18n/errors";
import { AUTH_ERROR, changeEmailSchema, type ChangeEmailInput } from "@/lib/validations/auth";
import { requestEmailChange, requestEmailVerification } from "@/app/actions/email-verification";

interface EmailFormProps {
  email: string;
  isVerified: boolean;
  /** False for OAuth-only accounts, where the provider owns the address. */
  canChange: boolean;
}

function VerificationBadge({ isVerified }: { isVerified: boolean }) {
  const { t } = useTranslation();

  // Icon plus text, never colour alone.
  if (isVerified) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-accent">
        <BadgeCheck className="h-3.5 w-3.5" />
        {t.account.email.verified}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <TriangleAlert className="h-3.5 w-3.5" />
      {t.account.email.unverified}
    </span>
  );
}

export function EmailForm({ email, isVerified, canChange }: EmailFormProps) {
  const { t } = useTranslation();
  const [isVerifying, setIsVerifying] = useState(false);
  const [changeRequested, setChangeRequested] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangeEmailInput>({
    resolver: zodResolver(changeEmailSchema),
  });

  const onVerify = async () => {
    setIsVerifying(true);
    const result = await requestEmailVerification();
    setIsVerifying(false);

    if (!result.success) {
      toast.error(translateAuthError(t, result.error));
      return;
    }

    toast.success(t.account.email.verifySent);
  };

  const onSubmit = async (data: ChangeEmailInput) => {
    const formData = new FormData();
    formData.append("email", data.email);
    formData.append("currentPassword", data.currentPassword);

    const result = await requestEmailChange(formData);

    if (!result.success) {
      if (result.error === AUTH_ERROR.currentPasswordIncorrect) {
        setError("currentPassword", { message: result.error });
        return;
      }
      if (result.error === AUTH_ERROR.sameEmail) {
        setError("email", { message: result.error });
        return;
      }
      toast.error(translateAuthError(t, result.error));
      return;
    }

    // Neutral either way: a free address and a taken one look identical here.
    setChangeRequested(true);
  };

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="space-y-1">
        <CardTitle className="text-lg font-bold">{t.account.email.title}</CardTitle>
        <CardDescription>{t.account.email.description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="current-email">{t.account.email.current}</Label>
          <Input
            id="current-email"
            type="email"
            value={email}
            readOnly
            disabled
            className="bg-background/30"
          />
          <div className="flex items-center justify-between gap-3">
            <VerificationBadge isVerified={isVerified} />
            {!isVerified && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isVerifying}
                onClick={onVerify}
              >
                {isVerifying ? (
                  <span className="flex items-center gap-2">
                    <AiOutlineLoading3Quarters className="h-3.5 w-3.5 animate-spin" />
                    {t.account.email.verifying}
                  </span>
                ) : (
                  t.account.email.verifyCta
                )}
              </Button>
            )}
          </div>
        </div>

        {canChange && changeRequested && (
          <p
            className="rounded-md border border-accent/20 bg-accent/5 p-3 text-sm text-muted-foreground"
            aria-live="polite"
          >
            {t.account.email.submitted}
          </p>
        )}

        {canChange && !changeRequested && (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4 border-t border-border/50 pt-6"
          >
            <div className="space-y-2">
              <Label htmlFor="new-email">{t.account.email.newEmail}</Label>
              <Input
                id="new-email"
                type="email"
                placeholder={t.account.email.newEmailPlaceholder}
                autoComplete="email"
                className="bg-background/50"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-destructive">
                  {translateAuthError(t, errors.email.message)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email-current-password">{t.account.email.currentPassword}</Label>
              {/* Required as well as the emailed link: a hijacked session alone
                  must not be enough to move the account to another inbox. */}
              <PasswordInput
                id="email-current-password"
                placeholder={t.account.email.currentPasswordPlaceholder}
                autoComplete="current-password"
                className="bg-background/50"
                error={translateAuthError(t, errors.currentPassword?.message)}
                {...register("currentPassword")}
              />
            </div>

            <p className="text-xs text-muted-foreground">{t.account.email.notice}</p>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <AiOutlineLoading3Quarters className="h-4 w-4 animate-spin" />
                  {t.account.email.submitting}
                </span>
              ) : (
                t.account.email.submit
              )}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
