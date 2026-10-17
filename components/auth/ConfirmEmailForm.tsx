"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { confirmEmail } from "@/server/email-verification/actions";
import { AccessState, type LinkExpiredProps } from "./AccessLayout";
import { TokenConfirmation } from "./TokenConfirmation";

interface ConfirmEmailFormProps {
  token: string;
}

// docs/specs/redesign-pages.md (PAGES-17 to PAGES-19): /confirm-email with a
// token, confirming a new address. «Confirmar esta dirección», then the
// confirmed state with «Volver a tu cuenta», or the expired-link state when
// the token is rejected (TokenConfirmation). No email address is shown
// (PAGES-17).
export function ConfirmEmailForm({ token }: ConfirmEmailFormProps) {
  const t = useTranslations();

  return (
    <TokenConfirmation
      token={token}
      action={confirmEmail}
      copy="confirmEmail"
      confirmed={
        <Button asChild variant="primary" size="display">
          <Link href="/account">{t("confirmEmail.backToAccount")}</Link>
        </Button>
      }
      expired={<ConfirmLinkExpired focusHeading />}
    />
  );
}

/**
 * PAGES-19: the expired-link state, the same for a link with no token
 * (app/confirm-email/page.tsx) and a token the server rejected.
 */
export function ConfirmLinkExpired({ focusHeading = false }: LinkExpiredProps) {
  const t = useTranslations();

  return (
    <AccessState
      question={t("confirmEmail.invalidHeadline")}
      punchline={t("confirmEmail.invalidHeadlineHighlight")}
      line={t("confirmEmail.invalidDescription")}
      title={t("confirmEmail.invalidTitle")}
      focusHeading={focusHeading}
      fadeIn={focusHeading}
    >
      <Button asChild variant="primary" size="display">
        <Link href="/account">{t("confirmEmail.backToAccount")}</Link>
      </Button>
    </AccessState>
  );
}
