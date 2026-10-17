"use client";

import { useId, useRef, useState } from "react";
import { useMessages, useTranslations } from "next-intl";
import { toast } from "sonner";
import { BusyButton } from "@/components/ui/BusyButton";
import { settleAction } from "@/lib/auth/settle-action";
import { translateRefusal } from "@/lib/i18n/errors";
import type { Translations } from "@/lib/i18n/types";
import { unlinkAccount } from "@/server/account/actions";
import { AccountCard, CardBadge } from "./AccountCard";

// docs/specs/redesign-pages.md (PAGES-34, PAGES-53); AccountCard/README.md ›
// Google. Linked: «Conectada», «También puedes entrar con Google.» and
// «Desconectar», never the Google account's email. Nothing linked: no badge,
// «No hay cuentas conectadas.» and no button — linking from /account does not
// exist. When Google is the only way in (no password, AUTH-14, BAUTH-10),
// «Desconectar» is aria-disabled and described by the line that says why.
// Google only: never the `credential` row (security review BLOCKER), never
// GitHub (ENTRY-16). After «Desconectar» the badge and the button fade out,
// and the focus, which was on that button, moves to the card's heading
// (PAGES-76).

const GOOGLE = "google";

interface GoogleCardProps {
  /** Linked providers other than `credential` (PAGES-60). */
  providers: string[];
  hasPassword: boolean;
  /** Called once Google is unlinked, so the page drops it. */
  onUnlinked: () => void;
}

export function GoogleCard({ providers, hasPassword, onUnlinked }: GoogleCardProps) {
  const t = useTranslations();
  const messages = useMessages() as Translations;
  const [isUnlinking, setIsUnlinking] = useState(false);
  const lineId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const linked = providers.includes(GOOGLE);
  // Removing the only way in would strand the account: no password to fall
  // back on, and password reset skips passwordless users. The server refuses
  // it as well (lastSignInMethod), counting every other linked provider as a
  // way back in; this only says so before the press. `providers` never holds
  // the credential row (PAGES-60).
  const isLastMethod = linked && !hasPassword && providers.length <= 1;

  const onUnlink = async () => {
    if (isLastMethod) return;
    setIsUnlinking(true);

    const formData = new FormData();
    formData.append("provider", GOOGLE);
    const result = await settleAction(() => unlinkAccount(formData));
    setIsUnlinking(false);

    // An action with no form: a refusal is the error toast (FRONT-15).
    if (!result.success) {
      toast.error(translateRefusal(messages, result.error));
      return;
    }
    toast.success(t("account.providers.unlinked"));
    onUnlinked();
    headingRef.current?.focus();
  };

  const line = !linked
    ? t("account.providers.none")
    : isLastMethod
      ? t("account.providers.lastMethodHint")
      : t("account.providers.line");

  return (
    <AccountCard
      title={t("account.providers.title")}
      badge={linked && <CardBadge on>{t("account.providers.connected")}</CardBadge>}
      line={line}
      lineId={lineId}
      headingRef={headingRef}
    >
      {linked && (
        <BusyButton
          type="button"
          variant="secondary"
          size="44"
          busy={isUnlinking}
          aria-disabled={isLastMethod || undefined}
          aria-describedby={isLastMethod ? lineId : undefined}
          onClick={onUnlink}
          className="aria-disabled:cursor-not-allowed aria-disabled:opacity-40"
        >
          {t("account.providers.unlink")}
        </BusyButton>
      )}
    </AccountCard>
  );
}
