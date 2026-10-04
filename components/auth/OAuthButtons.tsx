"use client";

import { useState } from "react";
import { FaGithub } from "react-icons/fa";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth/auth-client";
import { GoogleSignInButton } from "./GoogleSignInButton";

interface OAuthButtonsProps {
  /** Which providers are configured server-side (lib/app-config.ts), passed
   * down from the page rather than fetched client-side — Better Auth has no
   * client endpoint listing them the way NextAuth's `getProviders()` did. */
  providers: string[];
  /** Where to land after a successful provider round-trip. */
  callbackUrl?: string;
}

export function OAuthButtons({ providers, callbackUrl = "/" }: OAuthButtonsProps) {
  const t = useTranslations();
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);

  // Nothing configured — render nothing at all, divider included, rather than
  // buttons that cannot work.
  if (providers.length === 0) return null;

  const onSignIn = async (provider: "google" | "github") => {
    setPendingProvider(provider);
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
    await authClient.signIn.social({ provider, callbackURL: callbackUrl, errorCallbackURL });
    setPendingProvider(null);
  };

  return (
    <>
      <div className="relative my-6">
        <Separator />
        {/* Just "or": the buttons now say "Continue with …" themselves, so the
            old "or continue with" divider repeated the same words twice. */}
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
          {t("common.or")}
        </span>
      </div>

      {/* Stacked rather than side by side: "Continue with Google" does not fit
          a half-width button on a phone, and Google's guidelines forbid
          cropping or squashing their button. */}
      <div className="flex flex-col gap-3">
        {providers.includes("google") && (
          <GoogleSignInButton
            isPending={pendingProvider === "google"}
            // All providers lock while one redirect is in flight.
            disabled={pendingProvider !== null}
            onClick={() => onSignIn("google")}
          />
        )}

        {providers.includes("github") && (
          <Button
            variant="outline"
            type="button"
            className="h-10 w-full gap-2.5"
            disabled={pendingProvider !== null}
            onClick={() => onSignIn("github")}
          >
            {pendingProvider === "github" ? (
              <AiOutlineLoading3Quarters className="h-[18px] w-[18px] shrink-0 animate-spin" />
            ) : (
              <FaGithub className="h-[18px] w-[18px] shrink-0" />
            )}
            {t("auth.continueWithGithub")}
          </Button>
        )}
      </div>
    </>
  );
}
