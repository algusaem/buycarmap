"use client";

import { useState } from "react";
import { Separator } from "@/components/ui/separator";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth/auth-client";
import { cn } from "@/lib/utils";
import { GoogleSignInButton } from "./GoogleSignInButton";

interface OAuthButtonsProps {
  /** Whether Google is configured server-side (lib/app-config.ts), passed
   * down from the page rather than fetched client-side — Better Auth has no
   * client endpoint listing it the way NextAuth's `getProviders()` did.
   * Google is the only social sign-in the product offers
   * (docs/specs/redesign-entry.md, ENTRY-16, ENTRY-18). */
  googleEnabled: boolean;
  /** Where to land after a successful provider round-trip. */
  callbackUrl?: string;
  /** docs/specs/redesign-entry.md (ENTRY-19, ENTRY-25): /login hides the "o"
   * divider and the Google mark below 1440px wide — /register keeps them at
   * every width and from 1024px until its own F7 pass, so this defaults to
   * false rather than changing that page's look here. */
  hidePhoneDivider?: boolean;
}

export function OAuthButtons({
  googleEnabled,
  callbackUrl = "/",
  hidePhoneDivider = false,
}: OAuthButtonsProps) {
  const t = useTranslations();
  const [pending, setPending] = useState(false);

  // Nothing configured — render nothing at all, divider included, rather than
  // a button that cannot work.
  if (!googleEnabled) return null;

  const onSignIn = async () => {
    setPending(true);
    // Security review fix: Better Auth redirects an OAuth failure (an
    // unverified provider email, a link it refuses) to `errorCallbackURL`
    // — defaulting, with no explicit value, to the current page rather than
    // back to /login (api/routes/sign-in.mjs's `errorCallbackURL` doc
    // comment). Sent back to /login instead, with the same `callbackUrl`
    // query param middleware already uses so a retry still lands on the
    // original destination, LoginForm's own `?error=` handling can show it.
    const errorCallbackURL =
      callbackUrl === "/" ? "/login" : `/login?${new URLSearchParams({ callbackUrl }).toString()}`;
    // Full-page redirect to the provider, so this never resolves on success;
    // the pending state is cleared only if the redirect itself fails.
    await authClient.signIn.social({
      provider: "google",
      callbackURL: callbackUrl,
      errorCallbackURL,
    });
    setPending(false);
  };

  return (
    <>
      {/* GoogleButton README: «o» at 13px in text-muted between two 1px
          `line` rules, 12px apart. Just "or": the buttons say "Continue with
          …" themselves. /login spaces it with its own 18px gap; /register's
          card still relies on these margins until its F7 pass. */}
      <div
        className={cn(
          "flex items-center gap-3 text-small text-text-muted",
          hidePhoneDivider ? "hidden 3xl:flex" : "my-6",
        )}
      >
        <Separator className="flex-1 bg-line" />
        {t("common.or")}
        <Separator className="flex-1 bg-line" />
      </div>

      <GoogleSignInButton
        isPending={pending}
        disabled={pending}
        onClick={onSignIn}
        markFromDesktop={hidePhoneDivider}
      />
    </>
  );
}
