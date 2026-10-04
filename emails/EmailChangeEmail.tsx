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
// renderEmailChangeEmail (docs/specs/core-integrations.md, INT-13/INT-15).
//
// Sent to the *new* address during an email change. The link goes to the
// address being proved, never to the current one — that is what stops a
// hijacked session moving an account to an inbox the attacker already
// controls without ever proving they own it.

export interface EmailChangeEmailProps {
  locale: Locale;
  confirmUrl: string;
}

export function subject(locale: Locale, _props: EmailChangeEmailProps): string {
  return emailTranslator(locale, "transactionalEmail.emailChange")("subject");
}

export function EmailChangeEmail({ locale, confirmUrl }: EmailChangeEmailProps) {
  const t = emailTranslator(locale, "transactionalEmail.emailChange");
  const footer = emailTranslator(locale, "transactionalEmail")("footer");

  return (
    <EmailLayout heading={t("heading")} footer={footer}>
      <Paragraph>{t("intro")}</Paragraph>
      <EmailButton label={t("button")} url={confirmUrl} />
      <MutedParagraph>{t("expiry")}</MutedParagraph>
      <MutedParagraph>{t("ignore")}</MutedParagraph>
      <MutedParagraph>{t("fallback")}</MutedParagraph>
      <RawLink url={confirmUrl} />
    </EmailLayout>
  );
}
