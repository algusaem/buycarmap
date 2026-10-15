"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence } from "motion/react";
import * as motion from "motion/react-client";
import { signIn, verifySignInBackupCode, verifySignInTotp } from "@/server/auth/actions";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldMessage } from "./FieldMessage";
import { PasswordInput } from "./PasswordInput";
import { OAuthButtons } from "./OAuthButtons";
import { useTranslations, useMessages } from "next-intl";
import { translateAuthError } from "@/lib/i18n/errors";
import type { Translations } from "@/lib/i18n/types";
import { AUTH_ERROR } from "@/lib/auth/errors";
import { safeRedirectTarget } from "@/lib/auth/safe-redirect";
import { crossFade } from "@/lib/animations";
import { loginSchema, type LoginInput } from "@/server/auth/schema";

interface LoginFormProps {
  /** Whether Google is configured server-side (lib/app-config.ts). */
  isGoogleConfigured: boolean;
}

// docs/specs/redesign-entry.md (ENTRY-9 to ENTRY-17, ENTRY-19). The sign-in
// form: a `surface` panel at desktop width, directly on the page background
// at phone width (no panel, no title, no «o», Google without its mark — the
// Google half of that split lives in GoogleSignInButton.tsx and
// OAuthButtons.tsx). Every piece sits 18px from the next; labels are 13px
// weight 700, 8px over their field.
export function LoginForm({ isGoogleConfigured }: LoginFormProps) {
  const t = useTranslations();
  const messages = useMessages() as Translations;
  const searchParams = useSearchParams();
  // `window` is undefined during the server render pass this client
  // component still goes through — `safeRedirectTarget` resolving against an
  // empty origin there just falls back to "/" until the client re-renders
  // with the real one, before anything ever navigates.
  const redirectTo = safeRedirectTarget(
    searchParams.get("callbackUrl"),
    typeof window === "undefined" ? "" : window.location.origin,
  );

  const emailErrorId = useId();
  const totpErrorId = useId();
  const totpHintId = useId();
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
  // ENTRY-11/ENTRY-12: the wrong-credentials and rate-limit messages share
  // this one slot, above the submit button, and clear as soon as the next
  // attempt starts (edge case "Wrong password, then right one").
  const [formError, setFormError] = useState<string | null>(null);
  // F4 review round 2 (edge case "Wrong password, then right one" also
  // covers the OAuth banner): dismissed as soon as a sign-in or two-factor
  // attempt starts, so it never sits on screen next to a newer error.
  const [oauthErrorDismissed, setOauthErrorDismissed] = useState(false);
  // Set right before the full navigation below, so «Entrar» stays disabled
  // for the whole redirect — `isSubmitting` alone reverts to `false` as soon
  // as the async submit handler returns, which can be a beat before the
  // browser actually leaves the page.
  const [redirecting, setRedirecting] = useState(false);

  // bfcache: a browser back into this page after a successful sign-in
  // restores the pre-navigation DOM, `redirecting` still `true` and «Entrar»
  // still disabled, with no new submit possible. `pageshow`'s `persisted`
  // flag is the one signal a real page restore fires that a fresh mount
  // does not, which is what justifies an effect here (RULES.md §8) rather
  // than deriving this from render.
  useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) setRedirecting(false);
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

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

  // Run at the start of every submit handler, whether it reaches the server
  // or not (onInvalidSubmit covers the latter) — the stale alert and the
  // OAuth banner never sit on screen next to a newer attempt.
  function startAttempt() {
    setFormError(null);
    setOauthErrorDismissed(true);
  }

  // The full navigation that follows a successful sign-in or two-factor
  // verification — kept in one place so both submit handlers end the same
  // way.
  function finishSignIn() {
    setRedirecting(true);
    window.location.href = redirectTo;
  }

  // Once the server has asked for a second factor, submitting the same form
  // finishes that challenge instead of re-sending the password — BAUTH-11
  // (docs/specs/core-better-auth.md), Better Auth's `twoFactor` plugin
  // checks a TOTP code and a recovery code through two different endpoints,
  // so the field's shape (six digits vs. a formatted recovery code) picks
  // which one this calls.
  const submitTwoFactorCode = async (data: LoginInput) => {
    startAttempt();
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
        setFormError(t("authErrors.rateLimited"));
        return;
      }
      setError("totp", { message: AUTH_ERROR.totpInvalid });
      return;
    }

    finishSignIn();
  };

  const submitCredentials = async (data: LoginInput) => {
    startAttempt();
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
      setFormError(
        result.error === AUTH_ERROR.rateLimited
          ? t("authErrors.rateLimited")
          : t("auth.invalidCredentials"),
      );
      return;
    }

    // No success toast (FRONT-24, docs/specs/core-frontend.md): the full
    // navigation below tears it down before it paints. The redirect and the
    // signed-in navbar are the confirmation.
    //
    // The session was created server-side (server/auth/actions.ts's signIn),
    // not through authClient — so Better Auth's client only refetches a
    // session on one of its own mutation paths (sign-in/sign-out/etc. called
    // through `authClient` itself) or on a fresh mount. Neither happens from
    // a Next.js client-side `router.push`, so every `authClient.useSession()`
    // reader (SiteHeader, TabBar, CarListingCard, useFavorites) would keep
    // rendering signed-out. A full navigation forces that fresh mount.
    finishSignIn();
  };

  const onSubmit = (data: LoginInput) =>
    needsTwoFactor ? submitTwoFactorCode(data) : submitCredentials(data);

  // ENTRY-11 edge case "Wrong password, then right one" also covers a
  // submit that never reaches the server at all: client validation failing
  // (e.g. the password field cleared) must not leave a stale server error
  // showing beside the new field errors — and it is still an attempt, so the
  // OAuth banner clears too.
  const onInvalidSubmit = () => startAttempt();

  return (
    <div className="mt-1.5 flex w-full flex-col gap-4.5 3xl:mt-0 3xl:w-126.5 3xl:shrink-0 3xl:rounded-panel 3xl:border 3xl:border-line 3xl:bg-surface 3xl:p-8">
      <FieldMessage show={!!oauthError && !oauthErrorDismissed} role="alert">
        {isOAuthLinkBlocked ? t("authErrors.oauthLinkBlocked") : t("authErrors.generic")}
      </FieldMessage>

      <h2 className="m-0 hidden font-display text-form-title font-extrabold uppercase 3xl:block">
        {t("auth.signIn")}
      </h2>

      <form onSubmit={handleSubmit(onSubmit, onInvalidSubmit)} className="flex flex-col gap-4.5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email" className="text-field-label font-bold">
            {t("auth.email")}
          </Label>
          <Input
            id="email"
            type="email"
            placeholder={t("auth.emailPlaceholder")}
            autoComplete="email"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? emailErrorId : undefined}
            {...register("email")}
          />
          <FieldMessage show={!!errors.email} id={emailErrorId} aria-live="polite">
            {translateAuthError(messages, errors.email?.message)}
          </FieldMessage>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-field-label font-bold">
              {t("auth.password")}
            </Label>
            <Link
              href="/forgot-password"
              className="flex items-center justify-center text-small font-semibold text-text-muted underline transition-colors before:absolute before:size-11 hover:text-lime 3xl:before:size-6"
            >
              {t("auth.forgotPassword")}
            </Link>
          </div>
          <PasswordInput
            id="password"
            placeholder={t("auth.passwordPlaceholder")}
            autoComplete="current-password"
            error={translateAuthError(messages, errors.password?.message)}
            {...register("password")}
          />
        </div>

        <AnimatePresence>
          {needsTwoFactor && (
            <motion.div
              key="two-factor"
              className="flex flex-col gap-2"
              aria-live="polite"
              {...crossFade}
            >
              <Label htmlFor="totp" className="text-field-label font-bold">
                {t("account.twoFactor.codeLabel")}
              </Label>
              <Input
                id="totp"
                // `one-time-code` lets password managers and iOS autofill
                // offer the code; `inputMode` brings up the numeric keypad.
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                className="tabular-nums"
                aria-invalid={!!errors.totp}
                aria-describedby={errors.totp ? `${totpErrorId} ${totpHintId}` : totpHintId}
                {...register("totp")}
              />
              <FieldMessage show={!!errors.totp} id={totpErrorId}>
                {translateAuthError(messages, errors.totp?.message)}
              </FieldMessage>
              {/* Without this, someone who has lost their phone has no way
                  of knowing a recovery code goes in this same field — the
                  label only mentions six digits. */}
              <p id={totpHintId} className="m-0 text-meta text-text-muted">
                {t("account.twoFactor.recoveryHint")}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <FieldMessage show={!!formError} role="alert">
          {formError}
        </FieldMessage>

        {/* The board's signing-in state: disabled at 40%, busy, with the
            loader-circle 10px before the unchanged label. */}
        <Button
          type="submit"
          variant="primary"
          size="display"
          disabled={isSubmitting || redirecting}
          aria-busy={isSubmitting || redirecting}
          className="gap-2.5 disabled:opacity-40"
        >
          {(isSubmitting || redirecting) && (
            <LoaderCircle aria-hidden="true" strokeWidth={2.6} className="size-4.5 animate-spin" />
          )}
          {t("auth.signIn")}
        </Button>
      </form>

      {/* Renders nothing — divider included — when no OAuth provider is
          configured, so the layout has no orphaned separator. */}
      <OAuthButtons googleEnabled={isGoogleConfigured} callbackUrl={redirectTo} hidePhoneDivider />

      <p className="m-0 text-center text-label text-text-muted">
        {t("auth.noAccount")}{" "}
        <Link
          href="/register"
          className="inline-flex items-center justify-center font-bold text-lime underline before:absolute before:size-11 3xl:before:size-6"
        >
          {t("auth.createOne")}
        </Link>
      </p>
    </div>
  );
}
