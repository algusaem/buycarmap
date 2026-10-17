import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { TAB_BAR_CLEARANCE } from "@/components/nav/tab-bar-clearance";
import { cn } from "@/lib/utils";

// docs/specs/redesign-pages.md (PAGES-25, PAGES-56); F0-cuenta. /account's
// frame and heading, shared by the page and its loading state so the two
// never drift: 20px sides on the phone, 32px from `lg`; «Cuenta» with its
// short line on the phone and its long one from `lg`, 12px under it (14px
// from `lg`); the sign-out control on the heading's row from `lg`; and the
// cards 16px under the heading (22px from `lg`). CSS breakpoints pick the
// line, so nothing waits on the client's media queries.

interface AccountHeadingProps {
  /** «Cerrar sesión» on the heading's row, shown from `lg` (HEAD-13). */
  signOut: ReactNode;
  /** The cards, and on the phone «Cerrar sesión» after the last of them. */
  children: ReactNode;
}

export function AccountHeading({ signOut, children }: AccountHeadingProps) {
  const t = useTranslations();

  return (
    <div className={cn("w-full px-5 pt-5.5 lg:px-8 lg:pt-7.5 lg:pb-12", TAB_BAR_CLEARANCE)}>
      <header className="mb-4 flex items-end justify-between gap-4 lg:mb-5.5">
        <div className="flex min-w-0 flex-col gap-3 lg:gap-3.5">
          <h1 className="m-0 font-display text-page-title-mobile font-black uppercase lg:text-page-title">
            {t("account.title")}
          </h1>
          <p className="m-0 text-meta text-text-muted lg:hidden">{t("account.descriptionShort")}</p>
          <p className="m-0 hidden text-body-15 text-text-muted lg:block">
            {t("account.description")}
          </p>
        </div>
        {signOut}
      </header>
      {children}
    </div>
  );
}
