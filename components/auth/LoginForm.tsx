"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn, verifySignInBackupCode, verifySignInTotp } from "@/server/auth/actions";
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

interface LoginFormProps {
  /** Which OAuth providers are configured server-side (lib/app-config.ts). */
  oauthProviders: string[];
}

export function LoginForm({ oauthProviders }: LoginFormProps) {
  const t = useTranslations();
  const messages = useMessages() as Translations;
  const searchParams = useSearchParams();
  const redirectTo = safeRedirectTarget(searchParams.get("callbackUrl"));

  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);

  // A rejected OAuth sign-in redirects here with ?error=. Without this the
  // user would land back on the login page with no explanation at all.
  const oauthError = searchParams.get("error");

  // Security review fix: Better Auth's own implicit-link refusal
  // (oauth2/link-account.mjs, reached when `accountLinking.requireLocalEmailVerified`
  // or our own `databaseHooks.account.create.before` blocks the link) returns a
  // bare string that `api/routes/callback.mjs` turns into one of these two
  // `?error=` codes by joining it on underscores — there is no
  // OAUTH_CALLBACK_ERROR_CODES constant for either, since that mapping runs
  // after the fact. Explicit linking is not offered today, so the other
  // link-only codes (`email_does_not_match`,
  // `account_already_linked_to_different_user`, only reachable through
  // `/link-social`) never fire here.
  const isOAuthLinkBlocked =
    oauthError === "account_not_linked" || oauthError === "unable_to_link_account";

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  // Once the server has asked for a second factor, submitting the same form
  // finishes that challenge instead of re-sending the password — BAUTH-11
  // (docs/specs/core-better-auth.md), Better Auth's `twoFactor` plugin
  // checks a TOTP code and a recovery code through two different endpoints,
  // so the field's shape (six digits vs. a formatted recovery code) picks
  // which one this calls.
  const submitTwoFactorCode = async (data: LoginInput) => {
    const code = (data.totp ?? "").trim();
    // No email (BAUTH-3, security review fix): the signed two-factor cookie
    // from the prior sign-in call is what identifies the account, so sending
    // one here would only add a free way to enumerate accounts.
    const formData = new FormData();
    formData.set("code", code);

    const verify = /^\d{6}$/.test(code) ? verifySignInTotp : verifySignInBackupCode;
    const result = await verify(formData);

    if (!result.success) {
      if ("error" in result && result.error === AUTH_ERROR.rateLimited) {
        toast.error(t("authErrors.rateLimited"));
        return;
      }
      setError("totp", { message: AUTH_ERROR.totpInvalid });
      return;
    }

    toast.success(t("auth.signInSuccess"));
    window.location.href = redirectTo;
  };

  const submitCredentials = async (data: LoginInput) => {
    const formData = new FormData();
    formData.set("email", data.email);
    formData.set("password", data.password);

    const result = await signIn(formData);

    if ("twoFactorRequired" in result) {
      // The password was right and a code is needed. Reveal the field rather
      // than showing an error — nothing has gone wrong yet.
      setNeedsTwoFactor(true);
      return;
    }

    if (!result.success) {
      // A wrong password and an unknown account answer identically — so the
      // generic message here is the whole point, not a shortcut. Rate
      // limiting is the one case worth naming, since it tells the user to
      // wait rather than to keep guessing, and reveals nothing about the
      // account.
      toast.error(
        result.error === AUTH_ERROR.rateLimited
          ? t("authErrors.rateLimited")
          : t("auth.invalidCredentials"),
      );
      return;
    }

    toast.success(t("auth.signInSuccess"));

    // The session was created server-side (server/auth/actions.ts's signIn),
    // not through authClient — so Better Auth's client only refetches a
    // session on one of its own mutation paths (sign-in/sign-out/etc. called
    // through `authClient` itself) or on a fresh mount. Neither happens from
    // a Next.js client-side `router.push`, so every `authClient.useSession()`
    // reader (Navbar, HeroContent, CarListingCard, useFavorites) would keep
    // rendering signed-out. A full navigation forces that fresh mount.
    window.location.href = redirectTo;
  };

  const onSubmit = (data: LoginInput) =>
    needsTwoFactor ? submitTwoFactorCode(data) : submitCredentials(data);

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
              {isOAuthLinkBlocked ? t("authErrors.oauthLinkBlocked") : t("authErrors.generic")}
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
          <OAuthButtons providers={oauthProviders} callbackUrl={redirectTo} />
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
