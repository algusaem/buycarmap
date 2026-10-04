import type { Locale } from "@/lib/i18n/config";
import { EmailLayout, MutedParagraph, Paragraph, emailTranslator } from "./components";

// react-email replacement for lib/email/templates/auth-emails.ts's
// renderEmailChangedNoticeEmail (docs/specs/core-integrations.md,
// INT-13/INT-15). Sent to the *old* address after a change, so the owner can
// react. Carries no link, so it cannot be mistaken for a phishing template.

export interface EmailChangedNoticeEmailProps {
  locale: Locale;
}

export function subject(locale: Locale, _props: EmailChangedNoticeEmailProps): string {
  return emailTranslator(locale, "transactionalEmail.emailChangedNotice")("subject");
}

export function EmailChangedNoticeEmail({ locale }: EmailChangedNoticeEmailProps) {
  const t = emailTranslator(locale, "transactionalEmail.emailChangedNotice");
  const footer = emailTranslator(locale, "transactionalEmail")("footer");

  return (
    <EmailLayout heading={t("heading")} footer={footer}>
      <Paragraph>{t("intro")}</Paragraph>
      <MutedParagraph>{t("action")}</MutedParagraph>
    </EmailLayout>
  );
}
