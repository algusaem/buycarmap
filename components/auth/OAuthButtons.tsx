"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { FcGoogle } from "react-icons/fc";
import { FaGithub } from "react-icons/fa";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "@/lib/i18n/client";
import { useOAuthProviders } from "@/lib/hooks/useOAuthProviders";

interface OAuthButtonsProps {
  /** Where to land after a successful provider round-trip. */
  callbackUrl?: string;
}

const PROVIDER_ICONS: Record<string, React.ComponentType<{ className?: string }>> =
  {
    google: FcGoogle,
    github: FaGithub,
  };

export function OAuthButtons({ callbackUrl = "/" }: OAuthButtonsProps) {
  const { t } = useTranslation();
  const providers = useOAuthProviders();
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);

  // Nothing configured — render nothing at all, including the "or continue
  // with" divider, rather than a row of buttons that cannot work.
  if (providers.length === 0) return null;

  const labels: Record<string, string> = {
    google: t.auth.google,
    github: t.auth.github,
  };

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
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
          {t.auth.orContinueWith}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {providers.map((provider) => {
          const Icon = PROVIDER_ICONS[provider];
          const isPending = pendingProvider === provider;

          return (
            <Button
              key={provider}
              variant="outline"
              type="button"
              className="w-full"
              // Only the button being used shows a spinner, but all of them
              // lock so a second provider cannot be started mid-redirect.
              disabled={pendingProvider !== null}
              onClick={() => onSignIn(provider)}
            >
              {isPending ? (
                <AiOutlineLoading3Quarters className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                Icon && <Icon className="mr-2 h-4 w-4" />
              )}
              {labels[provider] ?? provider}
            </Button>
          );
        })}
      </div>
    </>
  );
}
