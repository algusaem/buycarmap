import type { Locale } from "@/lib/i18n/config";
import { emailCopy } from "@/lib/email/copy";
import {
  renderButton,
  renderLayout,
  renderMutedParagraph,
  renderParagraph,
  renderRawLink,
} from "@/lib/email/templates/layout";

// Each builder returns exactly what `sendEmail` needs. The plain-text part is
// not optional: HTML-only mail scores badly with spam filters, and the links
// have to work in text-only clients.

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

interface LinkEmailCopy {
  subject: string;
  heading: string;
  intro: string;
  button: string;
  /** Absent for emails whose link has no meaningful lifetime. */
  expiry?: string;
  ignore: string;
  fallback: string;
}

interface NoticeEmailCopy {
  subject: string;
  heading: string;
  intro: string;
  action: string;
}

/**
 * Every "click this link" email in the system: a paragraph, a button, the
 * expiry and ignore-if-not-you notes, then the raw URL as a fallback.
 *
 * Extracted once there were five of these — password reset, signup
 * confirmation, existing-account notice, address verification and email
 * change — all differing only in their copy and target URL.
 */
function renderLinkEmail(copy: LinkEmailCopy, url: string, locale: Locale): RenderedEmail {
  return {
    subject: copy.subject,
    html: renderLayout({
      heading: copy.heading,
      footer: emailCopy[locale].footer,
      bodyHtml: [
        renderParagraph(copy.intro),
        renderButton(copy.button, url),
        ...(copy.expiry ? [renderMutedParagraph(copy.expiry)] : []),
        renderMutedParagraph(copy.ignore),
        renderMutedParagraph(copy.fallback),
        renderRawLink(url),
      ].join("\n"),
    }),
    text: [
      copy.heading,
      "",
      copy.intro,
      "",
      url,
      "",
      ...(copy.expiry ? [copy.expiry] : []),
      copy.ignore,
    ].join("\n"),
  };
}

/** A security notice with no link, so it cannot be mistaken for phishing. */
function renderNoticeEmail(copy: NoticeEmailCopy, locale: Locale): RenderedEmail {
  return {
    subject: copy.subject,
    html: renderLayout({
      heading: copy.heading,
      footer: emailCopy[locale].footer,
      bodyHtml: [renderParagraph(copy.intro), renderMutedParagraph(copy.action)].join("\n"),
    }),
    text: [copy.heading, "", copy.intro, "", copy.action].join("\n"),
  };
}

export function renderPasswordResetEmail(locale: Locale, resetUrl: string): RenderedEmail {
  return renderLinkEmail(emailCopy[locale].passwordReset, resetUrl, locale);
}

/**
 * Confirms a signup. Until this link is redeemed no `User` row exists, which
 * is what lets the registration form answer identically for a free address and
 * a taken one — the distinction reaches only the mailbox.
 */
export function renderVerifyRegistrationEmail(locale: Locale, verifyUrl: string): RenderedEmail {
  return renderLinkEmail(emailCopy[locale].verifyRegistration, verifyUrl, locale);
}

/**
 * Sent when someone tries to register with an address that already has an
 * account. This is what lets the registration form stop saying "that email is
 * taken": the person who owns the inbox learns what happened, while the person
 * at the keyboard learns nothing they could use to enumerate accounts.
 */
export function renderExistingAccountEmail(locale: Locale, loginUrl: string): RenderedEmail {
  return renderLinkEmail(emailCopy[locale].existingAccount, loginUrl, locale);
}

/** Confirms the address already on an account (sets `emailVerified`). */
export function renderVerifyEmailAddressEmail(locale: Locale, verifyUrl: string): RenderedEmail {
  return renderLinkEmail(emailCopy[locale].verifyEmailAddress, verifyUrl, locale);
}

/**
 * Sent to the *new* address during an email change.
 *
 * The link goes to the address being proved, never to the current one — that
 * is what stops a hijacked session moving an account to an inbox the attacker
 * already controls without ever proving they own it.
 */
export function renderEmailChangeEmail(locale: Locale, confirmUrl: string): RenderedEmail {
  return renderLinkEmail(emailCopy[locale].emailChange, confirmUrl, locale);
}

/** Sent to the *old* address after a change, so the owner can react. */
export function renderEmailChangedNoticeEmail(locale: Locale): RenderedEmail {
  return renderNoticeEmail(emailCopy[locale].emailChangedNotice, locale);
}

export function renderPasswordChangedEmail(locale: Locale): RenderedEmail {
  return renderNoticeEmail(emailCopy[locale].passwordChanged, locale);
}
