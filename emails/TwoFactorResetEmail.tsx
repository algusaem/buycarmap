import type { Locale } from "@/lib/i18n/config";
import { EmailButton, EmailLayout, MutedParagraph, Paragraph, emailTranslator } from "./components";

// BAUTH-13 (docs/specs/core-better-auth.md): sent once, by
// scripts/notify-2fa-reset.mjs (through server/two-factor/reenrol.ts's
// notifyTwoFactorReset), to every user whose old two-factor enrolment the
// Better Auth cutover switched off. Carries a link to /account rather than a
// one-click action: re-enrolling needs the authenticator app in hand, which
// no link can do for them.

export interface TwoFactorResetEmailProps {
  locale: Locale;
  accountUrl: string;
}

export function subject(locale: Locale, _props: TwoFactorResetEmailProps): string {
  return emailTranslator(locale, "transactionalEmail.twoFactorReset")("subject");
}

export function TwoFactorResetEmail({ locale, accountUrl }: TwoFactorResetEmailProps) {
  const t = emailTranslator(locale, "transactionalEmail.twoFactorReset");
  const footer = emailTranslator(locale, "transactionalEmail")("footer");

  return (
    <EmailLayout heading={t("heading")} footer={footer}>
      <Paragraph>{t("intro")}</Paragraph>
      <EmailButton label={t("button")} url={accountUrl} />
      <MutedParagraph>{t("action")}</MutedParagraph>
    </EmailLayout>
  );
}
