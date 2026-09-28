import type { CarListing } from "@/interfaces/listing";
import type { Locale } from "@/lib/i18n/config";
import { getTranslationsSync } from "@/lib/i18n/server";
import { escapeHtml, renderLayout, renderParagraph, renderRawLink } from "./layout";

// The alert digest.
//
// Unlike every other email in this system, this one is sent by a cron with no
// request behind it — so the locale is passed in from `User.locale` rather than
// resolved with `getTranslations()`, and every listing is rendered from the
// stored `AlertMatch` snapshot rather than re-fetched. No source is contacted
// here, which is what lets the mail go out while an upstream is down.

const INK = "#1C2128";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";

export interface AlertEmailInput {
  locale: Locale;
  alertLabel: string;
  matches: CarListing[];
  unsubscribeUrl: string;
  /** Link back to this alert's matches page. Optional so tests need not build one. */
  alertUrl?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Formats a number the way the app does elsewhere — Spanish grouping, since
 * this is a Spanish-market product and the figures are euros and kilometres.
 */
function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-ES").format(value);
}

function renderMatch(listing: CarListing): string {
  // Titles come from three scraped upstreams, so they are attacker-influenced
  // and every one of them goes through escapeHtml.
  const details = [
    listing.year > 0 ? String(listing.year) : "",
    listing.mileage > 0 ? `${formatNumber(listing.mileage)} km` : "",
    listing.location,
    listing.source,
  ]
    .filter(Boolean)
    .join(" · ");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;border:1px solid ${BORDER};border-radius:8px;">
    <tr>
      <td style="padding:16px;">
        <a href="${escapeHtml(listing.url)}" style="font-size:16px;font-weight:600;color:${INK};text-decoration:none;">${escapeHtml(listing.title)}</a>
        <p style="margin:6px 0 0;font-size:18px;font-weight:700;color:${INK};">${formatNumber(listing.price)} €</p>
        <p style="margin:4px 0 0;font-size:13px;color:${MUTED};">${escapeHtml(details)}</p>
      </td>
    </tr>
  </table>`;
}

export async function renderAlertEmail({
  locale,
  alertLabel,
  matches,
  unsubscribeUrl,
  alertUrl,
}: AlertEmailInput): Promise<RenderedEmail> {
  const t = getTranslationsSync(locale);

  const subject =
    matches.length === 1
      ? `${t.alerts.email.subject}: ${matches[0].title}`
      : `${t.alerts.email.subject} (${matches.length})`;

  const bodyHtml = [
    renderParagraph(`${t.alerts.email.intro} ${alertLabel}`),
    ...matches.map(renderMatch),
    alertUrl ? renderRawLink(alertUrl) : "",
    `<p style="margin:24px 0 0;font-size:12px;color:${MUTED};">${escapeHtml(t.alerts.email.unsubscribe)}</p>`,
    renderRawLink(unsubscribeUrl),
  ].join("\n");

  const text = [
    `${t.alerts.email.heading} — ${alertLabel}`,
    "",
    ...matches.map(
      (listing) => `${listing.title} — ${formatNumber(listing.price)} € — ${listing.url}`,
    ),
    "",
    `${t.alerts.email.unsubscribe}: ${unsubscribeUrl}`,
  ].join("\n");

  return {
    subject,
    html: renderLayout({
      heading: t.alerts.email.heading,
      bodyHtml,
      footer: t.alerts.email.footer,
    }),
    text,
  };
}
