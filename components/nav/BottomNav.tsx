"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence } from "motion/react";
import * as motion from "motion/react-client";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth/auth-client";
import { crossFade } from "@/lib/animations";
import { cn } from "@/lib/utils";
import { SECTIONS, currentSection, isSectionPage } from "./nav-routes";

// HEAD-8, HEAD-17 (docs/specs/redesign-navigation.md);
// docs/design/system/components/BottomNav/README.md: on a phone, signed in, on
// the section pages only, a floating 62px pill 16px from the sides and 24px
// plus the safe-area inset from the bottom, with Mapa · Guardados · Alertas.
// Only the current section has a box (violet, 10px 16px); none on `/account`,
// where the header's avatar ring marks the page. It does not exist from `lg`.
export function BottomNav() {
  const t = useTranslations();
  const pathname = usePathname();
  const { data } = authClient.useSession();
  const current = currentSection(pathname);
  const visible = Boolean(data) && isSectionPage(pathname);

  return (
    <AnimatePresence>
      {visible && (
        <motion.nav
          key="bottom-nav"
          data-testid="bottom-nav"
          {...crossFade}
          aria-label={t("nav.main")}
          className="fixed inset-x-4 bottom-[calc(24px+env(safe-area-inset-bottom))] z-40 flex h-15.5 items-center justify-around rounded-pill border border-line bg-surface lg:hidden"
        >
          {SECTIONS.map(({ section, href, labelKey }) => (
            <Link
              key={section}
              href={href}
              aria-current={section === current ? "page" : undefined}
              className="flex h-11 min-w-11 items-center justify-center rounded-pill text-[13px] font-bold text-text"
            >
              <span
                className={cn(
                  "rounded-pill",
                  section === current && "bg-violet px-4 py-2.5 text-on-violet",
                )}
              >
                {t(labelKey)}
              </span>
            </Link>
          ))}
        </motion.nav>
      )}
    </AnimatePresence>
  );
}
