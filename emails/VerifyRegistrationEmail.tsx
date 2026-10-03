import type { Locale } from "@/lib/i18n/config";
import {
  EmailButton,
  EmailLayout,
  MutedParagraph,
  Paragraph,
  RawLink,
  emailTranslator,
} from "./components";

// react-email replacement for lib/email/templates/auth-emails.ts's
// renderVerifyRegistrationEmail (docs/specs/core-integrations.md,
// INT-13/INT-15).
//
// Confirms a signup. Until this link is redeemed no `User` row exists, which
// is what lets the registration form answer identically for a free address
// and a taken one — the distinction reaches only the mailbox.

export interface VerifyRegistrationEmailProps {
  locale: Locale;
  verifyUrl: string;
}

export function subject(locale: Locale, _props: VerifyRegistrationEmailProps): string {
  return emailTranslator(locale, "transactionalEmail.verifyRegistration")("subject");
}

export function VerifyRegistrationEmail({ locale, verifyUrl }: VerifyRegistrationEmailProps) {
  const t = emailTranslator(locale, "transactionalEmail.verifyRegistration");
  const footer = emailTranslator(locale, "transactionalEmail")("footer");

  return (
    <EmailLayout heading={t("heading")} footer={footer}>
      <Paragraph>{t("intro")}</Paragraph>
      <EmailButton label={t("button")} url={verifyUrl} />
      <MutedParagraph>{t("expiry")}</MutedParagraph>
      <MutedParagraph>{t("ignore")}</MutedParagraph>
      <MutedParagraph>{t("fallback")}</MutedParagraph>
      <RawLink url={verifyUrl} />
    </EmailLayout>
  );
}
