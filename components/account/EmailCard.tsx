"use client";

import { useState } from "react";
import { useMessages, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BusyButton } from "@/components/ui/BusyButton";
import { settleAction } from "@/lib/auth/settle-action";
import { translateRefusal } from "@/lib/i18n/errors";
import type { Translations } from "@/lib/i18n/types";
import { requestEmailVerification } from "@/server/email-verification/actions";
import { AccountCard, CardBadge } from "./AccountCard";

// docs/specs/redesign-pages.md (PAGES-30, PAGES-43); AccountCard/README.md ›
// Correo sin verificar. «Verificado» in violet or «Sin verificar» outlined,
// the line «<email>. Con él entras y te llegan las alertas.», and «Cambiar
// correo». Unconfirmed, «Enviar correo de verificación» comes first, busy
// while it runs, and «Cambiar correo» follows as a text button. With no
// password the address belongs to the provider: «Tu dirección de correo no se
// puede cambiar.» and no button (PAGES-27).

interface EmailCardProps {
  email: string;
  emailConfirmed: boolean;
  hasPassword: boolean;
  onChangeEmail: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

export function EmailCard({ email, emailConfirmed, hasPassword, onChangeEmail }: EmailCardProps) {
  const t = useTranslations();
  const messages = useMessages() as Translations;
  const [isSending, setIsSending] = useState(false);

  const onVerify = async () => {
    setIsSending(true);
    const result = await settleAction(() => requestEmailVerification());
    setIsSending(false);

    // An action with no form: a refusal is the error toast (FRONT-15).
    if (!result.success) {
      toast.error(translateRefusal(messages, result.error));
      return;
    }
    toast.success(t("account.email.verifySent"));
  };

  return (
    <AccountCard
      title={t("account.email.title")}
      badge={
        <CardBadge on={emailConfirmed}>
          {emailConfirmed ? t("account.email.verified") : t("account.email.unverified")}
        </CardBadge>
      }
      // A long address is cut to one line with «…», never widening the grid;
      // the whole text stays in the page for assistive tech (Edge cases).
      line={t.rich(hasPassword ? "account.email.line" : "account.email.lineLocked", {
        email,
        address: (chunks) => (
          <span className="inline-block max-w-full truncate align-bottom">{chunks}</span>
        ),
      })}
    >
      {/* One child, so a card with no password has no actions row at all. */}
      {hasPassword && (
        <>
          {!emailConfirmed && (
            <BusyButton
              type="button"
              variant="secondary"
              size="44"
              busy={isSending}
              onClick={onVerify}
            >
              {t("account.email.verifyCta")}
            </BusyButton>
          )}
          <Button
            type="button"
            variant={emailConfirmed ? "secondary" : "ghost"}
            size="44"
            onClick={onChangeEmail}
            className={emailConfirmed ? undefined : "px-0"}
          >
            {t("account.email.submit")}
          </Button>
        </>
      )}
    </AccountCard>
  );
}
