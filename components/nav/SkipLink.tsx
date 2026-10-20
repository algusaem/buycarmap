import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * What every page's one `main` carries (A11Y-1, A11Y-2): the id the skip link
 * targets, and `tabIndex={-1}` so following the link moves focus into it and
 * the next Tab lands on the page's first control after the header. Each
 * `main` adds `outline-none`: the landmark is a focus target, never a control,
 * so it draws no ring of its own.
 */
export const MAIN_CONTENT = { id: "contenido", tabIndex: -1 } as const;

// docs/specs/a11y-checks.md (A11Y-1); docs/design/system/components/SkipLink/README.md,
// F0-saltar-contenido. «Saltar al contenido»: the first thing in the document,
// before the header, linking to the page's `main`. It is the 48px secondary
// button (Button README) filled with `surface` to cover what lies under it,
// with every control's lime focus outline (LOOK-11). Off screen until it has
// focus, never `display: none`, so it stays in the keyboard order and screen
// readers announce it; with focus it floats over the header's wordmark, above
// everything else on the page (`.skip-link`, app/globals.css).
export function SkipLink() {
  const t = useTranslations("nav");

  return (
    <Button asChild variant="secondary" size="48" className="skip-link bg-surface">
      <a id="skip-link" href={`#${MAIN_CONTENT.id}`}>
        {t("skipToContent")}
      </a>
    </Button>
  );
}
