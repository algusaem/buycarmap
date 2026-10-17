"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { verifyRegistration } from "@/server/registration/actions";
import { AccessLink, AccessState, type LinkExpiredProps } from "./AccessLayout";
import { TokenConfirmation } from "./TokenConfirmation";

interface VerifyRegistrationFormProps {
  token: string;
}

// docs/specs/redesign-pages.md (PAGES-13 to PAGES-16): /verify-email with a
// token. «Confirmar mi cuenta», then the confirmed state with «Entrar», or the expired-link state when the token is rejected
// (TokenConfirmation). No email address is shown: that would mean looking the
// token up at render (the spec's Decisions).
export function VerifyRegistrationForm({ token }: VerifyRegistrationFormProps) {
  const t = useTranslations();

  return (
    <TokenConfirmation
      token={token}
      action={verifyRegistration}
      copy="verifyEmail"
      confirmed={
        <Button asChild variant="primary" size="display">
          <Link href="/login">{t("verifyEmail.signIn")}</Link>
        </Button>
      }
      expired={<VerifyLinkExpired focusHeading />}
    />
  );
}

/**
 * PAGES-16: the expired-link state, the same for a link with no token
 * (app/verify-email/page.tsx) and a token the server rejected.
 */
export function VerifyLinkExpired({ focusHeading = false }: LinkExpiredProps) {
  const t = useTranslations();

  return (
    <AccessState
      question={t("verifyEmail.invalidHeadline")}
      punchline={t("verifyEmail.invalidHeadlineHighlight")}
      line={t("verifyEmail.invalidDescription")}
      title={t("verifyEmail.invalidTitle")}
      focusHeading={focusHeading}
      fadeIn={focusHeading}
    >
      <Button asChild variant="primary" size="display">
        <Link href="/register">{t("verifyEmail.backToRegister")}</Link>
      </Button>
      <AccessLink href="/login">{t("auth.signIn")}</AccessLink>
    </AccessState>
  );
}
