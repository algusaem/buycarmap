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
// renderExistingAccountEmail (docs/specs/core-integrations.md,
// INT-13/INT-15).
//
// Sent when someone tries to register with an address that already has an
// account. This is what lets the registration form stop saying "that email
// is taken": the person who owns the inbox learns what happened, while the
// person at the keyboard learns nothing they could use to enumerate
// accounts. Takes only a locale and a URL — no name, creation date or
// sign-in provider — so a forwarded copy discloses nothing beyond what the
// recipient already knows.

export interface ExistingAccountEmailProps {
  locale: Locale;
  loginUrl: string;
}

export function subject(locale: Locale, _props: ExistingAccountEmailProps): string {
  return emailTranslator(locale, "transactionalEmail.existingAccount")("subject");
}

export function ExistingAccountEmail({ locale, loginUrl }: ExistingAccountEmailProps) {
  const t = emailTranslator(locale, "transactionalEmail.existingAccount");
  const footer = emailTranslator(locale, "transactionalEmail")("footer");

  return (
    <EmailLayout heading={t("heading")} footer={footer}>
      <Paragraph>{t("intro")}</Paragraph>
      <EmailButton label={t("button")} url={loginUrl} />
      <MutedParagraph>{t("ignore")}</MutedParagraph>
      <MutedParagraph>{t("fallback")}</MutedParagraph>
      <RawLink url={loginUrl} />
    </EmailLayout>
  );
}
