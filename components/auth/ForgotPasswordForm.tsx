"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import * as motion from "motion/react-client";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { ArrowLeft, MailCheck } from "lucide-react";
import { fadeInUp } from "@/lib/animations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations, useMessages } from "next-intl";
import { translateAuthError } from "@/lib/i18n/errors";
import type { Translations } from "@/lib/i18n/types";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/server/auth/schema";
import { requestPasswordReset } from "@/server/password-reset/actions";

export function ForgotPasswordForm() {
  const t = useTranslations();
  const messages = useMessages() as Translations;
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    const formData = new FormData();
    formData.append("email", data.email);

    const result = await requestPasswordReset(formData);
    if (!result.success) {
      toast.error(translateAuthError(messages, result.error) ?? t("forgotPassword.genericError"));
      return;
    }

    setSubmitted(true);
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
            {t("forgotPassword.backToLogin")}
          </Link>
          <CardTitle className="text-2xl font-bold">
            {submitted ? t("forgotPassword.successTitle") : t("forgotPassword.title")}
          </CardTitle>
          <CardDescription>
            {submitted ? t("forgotPassword.successDescription") : t("forgotPassword.description")}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {submitted ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center" aria-live="polite">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 ring-1 ring-accent/20">
                <MailCheck className="h-6 w-6 text-accent" />
              </div>
              <Button asChild variant="outline" className="w-full" size="lg">
                <Link href="/login">{t("forgotPassword.backToLogin")}</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("auth.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t("auth.emailPlaceholder")}
                  autoComplete="email"
                  className="bg-background/50"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">
                    {translateAuthError(messages, errors.email.message)}
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <AiOutlineLoading3Quarters className="h-4 w-4 animate-spin" />
                    {t("forgotPassword.submitting")}
                  </span>
                ) : (
                  t("forgotPassword.submit")
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
