import { createElement } from "react";
import { appUrl } from "@/lib/app-config";
import { DEFAULT_LOCALE, isValidLocale } from "@/lib/i18n/config";
import { sendEmail } from "@/lib/platform/email";
import { TwoFactorResetEmail, subject } from "@/emails/TwoFactorResetEmail";
import { renderEmail } from "@/emails/render";

// BAUTH-13 (docs/specs/core-better-auth.md): the Better Auth cutover's
// migration switches `twoFactorEnabled` off for every user who had the old
// `twoFactorEnabledAt` set, since the new column starts false for everyone
// (BAUTH-14). This mails each of them once, in their own locale, so they
// know to re-enrol — scripts/notify-2fa-reset.mjs is what actually finds
// them and calls this, and records the notice so a second run sends nothing.

export interface TwoFactorResetRecipient {
  id: string;
  email: string;
  locale: string | null;
}

function resolveLocale(locale: string | null) {
  return locale && isValidLocale(locale) ? locale : DEFAULT_LOCALE;
}

/** Sends one "set two-factor up again" email per recipient, in their locale. */
export async function notifyTwoFactorReset(recipients: TwoFactorResetRecipient[]): Promise<void> {
  const accountUrl = `${appUrl}/account`;

  await Promise.all(
    recipients.map(async (recipient) => {
      const locale = resolveLocale(recipient.locale);
      const { html, text } = await renderEmail(
        createElement(TwoFactorResetEmail, { locale, accountUrl }),
      );

      await sendEmail({
        to: recipient.email,
        subject: subject(locale, { locale, accountUrl }),
        html,
        text,
      });
    }),
  );
}
