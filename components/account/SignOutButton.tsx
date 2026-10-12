"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { LoaderCircle } from "lucide-react";
import { useMessages, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/auth-client";
import { AUTH_ERROR } from "@/lib/auth/errors";
import { translateAuthError } from "@/lib/i18n/errors";
import type { Translations } from "@/lib/i18n/types";

interface SignOutButtonProps {
  className?: string;
}

// HEAD-13 (docs/specs/redesign-navigation.md): «Cerrar sesión» moved here
// from the old navbar's account dropdown, with the same mechanism —
// authClient.signOut() then home. A secondary 44px pill, 14px weight 700
// (AccountCard README). A failed sign-out stays on the page with the button
// usable again, reported to Sentry and told to the user in a toast, the way
// SessionsCard surfaces a failed sign-out.
export function SignOutButton({ className }: SignOutButtonProps) {
  const t = useTranslations();
  const messages = useMessages() as Translations;
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const onSignOut = async () => {
    setIsSigningOut(true);
    try {
      await authClient.signOut();
      router.push("/");
    } catch (error) {
      Sentry.captureException(error);
      setIsSigningOut(false);
      toast.error(translateAuthError(messages, AUTH_ERROR.generic));
    }
  };

  return (
    <Button
      type="button"
      variant="secondary"
      size="44"
      disabled={isSigningOut}
      onClick={onSignOut}
      className={className}
    >
      {isSigningOut && <LoaderCircle className="animate-spin" aria-hidden="true" />}
      {t("nav.signOut")}
    </Button>
  );
}
