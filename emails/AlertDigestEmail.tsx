import type { CarListing } from "@/interfaces/listing";
import type { Locale } from "@/lib/i18n/config";
import { EmailLayout, INK, MUTED, Paragraph, RawLink, emailTranslator } from "./components";

// react-email replacement for lib/email/templates/alert-emails.ts's
// renderAlertEmail (docs/specs/core-integrations.md, INT-13/INT-15).
//
// Unlike every other email in this system, this one is sent by a cron with
// no request behind it — so the locale is passed in from `User.locale`
// rather than resolved with `getTranslations()`, and every listing is
// rendered from the stored `AlertMatch` snapshot rather than re-fetched. No
// source is contacted here, which is what lets the mail go out while an
// upstream is down.

export interface AlertDigestEmailProps {
  locale: Locale;
  alertLabel: string;
  matches: CarListing[];
  unsubscribeUrl: string;
  /** Link back to this alert's matches page. Optional, as the old builder's was. */
  alertUrl?: string;
}

/**
 * Formats a number the way the app does elsewhere — Spanish grouping, since
 * this is a Spanish-market product and the figures are euros and kilometres.
 */
function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-ES").format(value);
}

export function subject(locale: Locale, { matches }: AlertDigestEmailProps): string {
  const t = emailTranslator(locale, "alerts.email");
  return matches.length === 1
    ? `${t("subject")}: ${matches[0].title}`
    : `${t("subject")} (${matches.length})`;
}

function MatchCard({ listing }: { listing: CarListing }) {
  const details = [
    listing.year > 0 ? String(listing.year) : "",
    listing.mileage > 0 ? `${formatNumber(listing.mileage)} km` : "",
    listing.location,
    listing.source,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <table
      role="presentation"
      width="100%"
      cellPadding={0}
      cellSpacing={0}
      style={{ margin: "0 0 12px", border: "1px solid #E5E7EB", borderRadius: "8px" }}
    >
      <tbody>
        <tr>
          <td style={{ padding: "16px" }}>
            <a
              href={listing.url}
              style={{ fontSize: "16px", fontWeight: 600, color: INK, textDecoration: "none" }}
            >
              {listing.title}
            </a>
            <p style={{ margin: "6px 0 0", fontSize: "18px", fontWeight: 700, color: INK }}>
              {formatNumber(listing.price)} €
            </p>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: MUTED }}>{details}</p>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function AlertDigestEmail({
  locale,
  alertLabel,
  matches,
  unsubscribeUrl,
  alertUrl,
}: AlertDigestEmailProps) {
  const t = emailTranslator(locale, "alerts.email");

  return (
    <EmailLayout heading={t("heading")} footer={t("footer")}>
      <Paragraph>
        {t("intro")} {alertLabel}
      </Paragraph>
      {matches.map((listing) => (
        <MatchCard key={listing.id} listing={listing} />
      ))}
      {alertUrl ? <RawLink url={alertUrl} /> : null}
      <p style={{ margin: "24px 0 0", fontSize: "12px", color: MUTED }}>{t("unsubscribe")}</p>
      <RawLink url={unsubscribeUrl} />
    </EmailLayout>
  );
}
