"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { FaGithub } from "react-icons/fa";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "@/lib/i18n/client";
import { useOAuthProviders } from "@/lib/hooks/useOAuthProviders";
import { GoogleSignInButton } from "./GoogleSignInButton";

interface OAuthButtonsProps {
  /** Where to land after a successful provider round-trip. */
  callbackUrl?: string;
}

export function OAuthButtons({ callbackUrl = "/" }: OAuthButtonsProps) {
  const { t } = useTranslation();
  const providers = useOAuthProviders();
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);

  // Nothing configured — render nothing at all, divider included, rather than
  // buttons that cannot work.
  if (providers.length === 0) return null;

  const onSignIn = async (provider: string) => {
    setPendingProvider(provider);
    // Full-page redirect to the provider, so this never resolves on success;
    // the pending state is cleared only if the redirect itself fails.
    await signIn(provider, { callbackUrl });
    setPendingProvider(null);
  };

  return (
    <>
      <div className="relative my-6">
        <Separator />
        {/* Just "or": the buttons now say "Continue with …" themselves, so the
            old "or continue with" divider repeated the same words twice. */}
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
          {t.common.or}
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
            {t.auth.continueWithGithub}
          </Button>
        )}
      </div>
    </>
  );
}
