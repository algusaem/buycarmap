import Link from "next/link";
import { useTranslations } from "next-intl";

const STORYSET_NAME = "Storyset";
const STORYSET_URL = "https://storyset.com";

const LINK_CLASSES = "py-1 underline transition-colors hover:text-lime";

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
 */
export function Footer() {
  const t = useTranslations("footer");
  const [beforeBrand, afterBrand = ""] = t("illustrations", { storyset: STORYSET_NAME }).split(
    STORYSET_NAME,
  );

  return (
    <footer className="hidden shrink-0 items-center justify-end gap-4.5 px-12 pt-2 pb-5 font-sans text-xs text-text-muted md:flex">
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
