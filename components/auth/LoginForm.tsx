"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import * as motion from "motion/react-client";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { ArrowLeft } from "lucide-react";
import { fadeInUp } from "@/lib/animations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PasswordInput } from "./PasswordInput";
import { OAuthButtons } from "./OAuthButtons";
import { useTranslations, useMessages } from "next-intl";
import { translateAuthError } from "@/lib/i18n/errors";
import type { Translations } from "@/lib/i18n/types";
import { AUTH_ERROR } from "@/lib/auth/errors";
import { loginSchema, type LoginInput } from "@/server/auth/schema";

// Middleware puts the originally-requested path here. Only same-origin paths
// are honoured: accepting an absolute URL would make the sign-in page an open
// redirect that phishing links could bounce through. A leading "//" is rejected
// because browsers read it as a protocol-relative URL to another host.
function safeRedirectTarget(callbackUrl: string | null): string {
  if (!callbackUrl) return "/";
  if (!callbackUrl.startsWith("/") || callbackUrl.startsWith("//")) return "/";
  return callbackUrl;
}

export function LoginForm() {
  const t = useTranslations();
  const messages = useMessages() as Translations;
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = safeRedirectTarget(searchParams.get("callbackUrl"));

  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);

  // A rejected OAuth sign-in redirects here with ?error=. Without this the
  // user would land back on the login page with no explanation at all.
  const oauthError = searchParams.get("error");

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    const result = await signIn("credentials", {
      email: data.email,
      password: data.password,
      // Empty on the first attempt; the field only appears once the server
      // says this account has two-factor enabled.
      totp: data.totp ?? "",
      redirect: false,
    });

    // The password was right and a code is needed. Reveal the field rather
    // than showing an error — nothing has gone wrong yet.
    if (result?.error === AUTH_ERROR.totpRequired) {
      setNeedsTwoFactor(true);
      return;
    }

    if (result?.error === AUTH_ERROR.totpInvalid) {
      setNeedsTwoFactor(true);
      setError("totp", { message: AUTH_ERROR.totpInvalid });
      return;
    }

    if (result?.error) {
      // `authorize` returns null for both a wrong password and an unknown
      // account, which arrives as the opaque "CredentialsSignin" — so the
      // generic message here is the whole point, not a shortcut. Rate limiting
      // is the one case worth naming, since it tells the user to wait rather
      // than to keep guessing, and reveals nothing about the account.
      toast.error(
        result.error === AUTH_ERROR.rateLimited
          ? t("authErrors.rateLimited")
          : t("auth.invalidCredentials"),
      );
      return;
    }

    toast.success(t("auth.signInSuccess"));
    router.push(redirectTo);
    router.refresh();
  };

  return (
    <motion.div {...fadeInUp}>
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="space-y-1 pb-4">
          <Link
            href="/"
            className="-ml-1 mb-2 inline-flex w-fit items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
          >
            <ArrowLeft className="h-3 w-3" />
            {t("auth.return")}
          </Link>
          <CardTitle className="text-2xl font-bold">{t("auth.welcomeBack")}</CardTitle>
          <CardDescription>{t("auth.signInDescription")}</CardDescription>
        </CardHeader>

        <CardContent>
          {oauthError && (
            <p
              className="mb-4 rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-muted-foreground"
              role="alert"
            >
              {oauthError === "AccessDenied"
                ? t("authErrors.oauthLinkBlocked")
                : t("authErrors.generic")}
            </p>
          )}

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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-muted-foreground transition-colors hover:text-primary"
                >
                  {t("auth.forgotPassword")}
                </Link>
              </div>
              <PasswordInput
                id="password"
                placeholder={t("auth.passwordPlaceholder")}
                autoComplete="current-password"
                className="bg-background/50"
                error={translateAuthError(messages, errors.password?.message)}
                {...register("password")}
              />
            </div>

            {needsTwoFactor && (
              <div className="space-y-2" aria-live="polite">
                <Label htmlFor="totp">{t("account.twoFactor.codeLabel")}</Label>
                <Input
                  id="totp"
                  // `one-time-code` lets password managers and iOS autofill
                  // offer the code; `inputMode` brings up the numeric keypad.
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  placeholder={t("account.twoFactor.codePlaceholder")}
                  className="bg-background/50 font-mono tracking-widest"
                  {...register("totp")}
                />
                {/* Without this, someone who has lost their phone has no way
                    of knowing a recovery code goes in this same field — the
                    label only mentions six digits. */}
                <p className="text-xs text-muted-foreground">
                  {t("account.twoFactor.recoveryHint")}
                </p>
                {errors.totp && (
                  <p className="text-sm text-destructive">
                    {translateAuthError(messages, errors.totp.message)}
                  </p>
                )}
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <AiOutlineLoading3Quarters className="h-4 w-4 animate-spin" />
                  {t("auth.signingIn")}
                </span>
              ) : (
                t("auth.signIn")
              )}
            </Button>
          </form>

          {/* Renders nothing — divider included — when no OAuth provider is
              configured, so the layout has no orphaned separator. */}
          <OAuthButtons callbackUrl={redirectTo} />
        </CardContent>

        <CardFooter className="flex-col gap-4 border-t border-border/50 pt-6">
          <p className="text-center text-sm text-muted-foreground">
            {t("auth.noAccount")}{" "}
            <Link
              href="/register"
              className="font-medium text-primary transition-colors hover:text-primary/80"
            >
              {t("auth.createOne")}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
