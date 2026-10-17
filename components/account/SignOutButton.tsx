"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { useMessages, useTranslations } from "next-intl";
import { toast } from "sonner";
import { BusyButton } from "@/components/ui/BusyButton";
import { authClient } from "@/lib/auth/auth-client";
import { AUTH_ERROR } from "@/lib/auth/errors";
import { translateAuthError } from "@/lib/i18n/errors";
import type { Translations } from "@/lib/i18n/types";

interface SignOutButtonProps {
  /** `pad-14` on the heading's row from `lg`, the board's smaller secondary (10px 16px); 44px after the cards on the phone. */
  size?: "44" | "pad-14";
  className?: string;
}

// HEAD-13 (docs/specs/redesign-navigation.md): «Cerrar sesión» moved here
// from the old navbar's account dropdown, with the same mechanism —
// authClient.signOut() then home. A secondary pill, 14px weight 700: 10px
// 16px on the heading's row from `lg`, 44px tall on the phone (AccountCard
// README), busy (BusyButton) while it runs. A failed sign-out stays on the page with the button
// usable again, reported to Sentry and told to the user in a toast, the way
// the «Sesiones» dialog surfaces a failed sign-out.
export function SignOutButton({ size = "44", className }: SignOutButtonProps) {
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
    <BusyButton
      type="button"
      variant="secondary"
      size={size}
      busy={isSigningOut}
      onClick={onSignOut}
      className={className}
    >
      {t("nav.signOut")}
    </BusyButton>
  );
}
