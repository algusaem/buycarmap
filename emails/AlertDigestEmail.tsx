import type { CarListing } from "@/interfaces/listing";
import type { Locale } from "@/lib/i18n/config";
import { Img, Link } from "@react-email/components";
import {
  BORDER,
  EmailButton,
  EmailLayout,
  INK,
  MUTED,
  Paragraph,
  emailTranslator,
} from "./components";

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
  /** Link to the alerts list (`/alerts`), shown in the footer next to the unsubscribe link. */
  manageUrl: string;
}

// ALERT-56: every photo slot is this tall, photo or placeholder, so the list
// stays even. The photo is cropped to it with object-fit, which the classic
// Outlook for Windows ignores (it stretches instead) — accepted in #152.
const PHOTO_HEIGHT = "200px";

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

const footerLinkStyle = { color: MUTED, textDecoration: "underline" };

function MatchCard({ listing, noPhoto }: { listing: CarListing; noPhoto: string }) {
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
      style={{
        margin: "0 0 12px",
        border: `1px solid ${BORDER}`,
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      <tbody>
        <tr>
          {listing.image ? (
            <td style={{ padding: 0 }}>
              <Img
                src={listing.image}
                alt={listing.title}
                style={{
                  width: "100%",
                  height: PHOTO_HEIGHT,
                  objectFit: "cover",
                  borderRadius: "8px 8px 0 0",
                }}
              />
            </td>
          ) : (
            <td
              style={{
                height: PHOTO_HEIGHT,
                backgroundColor: "#F3F4F6",
                textAlign: "center",
                verticalAlign: "middle",
                fontSize: "13px",
                color: MUTED,
              }}
            >
              {noPhoto}
            </td>
          )}
        </tr>
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
  manageUrl,
}: AlertDigestEmailProps) {
  const t = emailTranslator(locale, "alerts.email");

  return (
    <EmailLayout
      heading={t("heading")}
      footer={t("footer")}
      footerLinks={
        <>
          <Link href={manageUrl} style={footerLinkStyle}>
            {t("manage")}
          </Link>
          {" · "}
          <Link href={unsubscribeUrl} style={footerLinkStyle}>
            {t("unsubscribe")}
          </Link>
        </>
      }
    >
      <Paragraph>
        {t("intro")} {alertLabel}
      </Paragraph>
      {matches.map((listing) => (
        <MatchCard key={listing.id} listing={listing} noPhoto={t("noPhoto")} />
      ))}
      {alertUrl ? <EmailButton label={t("viewAll")} url={alertUrl} /> : null}
    </EmailLayout>
  );
}
