import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const STORYSET_NAME = "Storyset";
const STORYSET_URL = "https://storyset.com";

const LINK_CLASSES = "py-1 underline transition-colors hover:text-lime";

interface FooterProps {
  centered?: boolean;
}

/**
 * LOOK-16 (docs/specs/redesign-foundation.md), docs/design/system/components/
 * Footer/README.md: one quiet line at the bottom right — «Privacidad ·
 * Términos · Ilustraciones de Storyset» — at 12px in `text-muted`, underlined
 * links 18px apart, no divider, 20px from the bottom edge and aligned with the
 * page's 48px side margin. The Storyset credit is required by its free
 * licence. The design has no footer on phones. Rendered only by the pages the
 * design names, never by the root layout (LOOK-17).
 *
 * `footer.illustrations` carries the brand as a `{storyset}` argument, and
 * next-intl only accepts strings, numbers and dates for an argument, so the
 * translated sentence is split around the brand name to put the link on it.
 *
 * `centered`: the landing centres the row under its laptop column, below
 * 1440px wide, its top 24px under what sits above it — the illustration's
 * drawn content, or «Populares» when there is no room for the illustration
 * (docs/specs/redesign-entry.md, ENTRY-24, ENTRY-26); every other page keeps
 * it at the right.
 */
export function Footer({ centered = false }: FooterProps) {
  const t = useTranslations("footer");
  const [beforeBrand, afterBrand = ""] = t("illustrations", { storyset: STORYSET_NAME }).split(
    STORYSET_NAME,
  );

  return (
    <footer
      className={cn(
        "hidden shrink-0 items-center gap-4.5 px-12 pt-2 pb-4 font-sans text-xs text-text-muted md:flex",
        centered ? "justify-center lg:max-3xl:mt-6 lg:max-3xl:py-0 3xl:justify-end" : "justify-end",
      )}
    >
      <Link href="/privacy" className={LINK_CLASSES}>
        {t("privacy")}
      </Link>
      <Link href="/terms" className={LINK_CLASSES}>
        {t("terms")}
      </Link>
      <span>
        {beforeBrand}
        <a href={STORYSET_URL} target="_blank" rel="noopener noreferrer" className={LINK_CLASSES}>
          {STORYSET_NAME}
        </a>
        {afterBrand}
      </span>
    </footer>
  );
}
