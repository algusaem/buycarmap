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
// renderPasswordResetEmail (docs/specs/core-integrations.md, INT-13/INT-15).

export interface PasswordResetEmailProps {
  locale: Locale;
  resetUrl: string;
}

export function subject(locale: Locale, _props: PasswordResetEmailProps): string {
  return emailTranslator(locale, "transactionalEmail.passwordReset")("subject");
}

export function PasswordResetEmail({ locale, resetUrl }: PasswordResetEmailProps) {
  const t = emailTranslator(locale, "transactionalEmail.passwordReset");
  const footer = emailTranslator(locale, "transactionalEmail")("footer");

  return (
    <EmailLayout heading={t("heading")} footer={footer}>
      <Paragraph>{t("intro")}</Paragraph>
      <EmailButton label={t("button")} url={resetUrl} />
      <MutedParagraph>{t("expiry")}</MutedParagraph>
      <MutedParagraph>{t("ignore")}</MutedParagraph>
      <MutedParagraph>{t("fallback")}</MutedParagraph>
      <RawLink url={resetUrl} />
    </EmailLayout>
  );
}
