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
// renderVerifyEmailAddressEmail (docs/specs/core-integrations.md,
// INT-13/INT-15). Confirms the address already on an account (sets
// `emailVerified`).

export interface VerifyEmailAddressEmailProps {
  locale: Locale;
  verifyUrl: string;
}

export function subject(locale: Locale, _props: VerifyEmailAddressEmailProps): string {
  return emailTranslator(locale, "transactionalEmail.verifyEmailAddress")("subject");
}

export function VerifyEmailAddressEmail({ locale, verifyUrl }: VerifyEmailAddressEmailProps) {
  const t = emailTranslator(locale, "transactionalEmail.verifyEmailAddress");
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
