import type { Locale } from "@/lib/i18n/config";
import { EmailLayout, MutedParagraph, Paragraph, emailTranslator } from "./components";

// react-email replacement for lib/email/templates/auth-emails.ts's
// renderPasswordChangedEmail (docs/specs/core-integrations.md,
// INT-13/INT-15). Carries no link, so it cannot be mistaken for a phishing
// template.

export interface PasswordChangedEmailProps {
  locale: Locale;
}

export function subject(locale: Locale, _props: PasswordChangedEmailProps): string {
  return emailTranslator(locale, "transactionalEmail.passwordChanged")("subject");
}

export function PasswordChangedEmail({ locale }: PasswordChangedEmailProps) {
  const t = emailTranslator(locale, "transactionalEmail.passwordChanged");
  const footer = emailTranslator(locale, "transactionalEmail")("footer");

  return (
    <EmailLayout heading={t("heading")} footer={footer}>
      <Paragraph>{t("intro")}</Paragraph>
      <MutedParagraph>{t("action")}</MutedParagraph>
    </EmailLayout>
  );
}
