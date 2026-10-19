"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence } from "motion/react";
import * as motion from "motion/react-client";
import { Bell, Heart, LogIn, Map as MapIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth/auth-client";
import { crossFade } from "@/lib/animations";
import { useHideOnScrollDown } from "@/lib/hooks/useHideOnScrollDown";
import { useResultsSheetFull } from "@/lib/hooks/useResultsSheetFull";
import { cn } from "@/lib/utils";
import { initialOf } from "./Avatar";
import { currentTab, showsTabBar } from "./nav-routes";

// docs/specs/redesign-map.md (MAPUI-52, MAPUI-53);
// docs/design/system/components/BottomNav/README.md. Replaces the F2 floating
// bottom nav (HEAD-8, HEAD-17 amended): at phone width, a full-width bar of
// 64px tabs plus the safe-area inset, on the map (signed in or out) and on the
// signed-in section pages. Each tab is an icon over its label; the current one
// has a violet icon and its label in the text colour at weight 800 (violet text
// on `surface` fails 4.5:1: MAPUI-52 amended, SAVED-33), the others muted and
// weight 600, so the state is not carried by colour alone. It does not exist
// from `lg`.
//
// It hides while the map's results sheet is full (what the map page reports
// through lib/hooks/useResultsSheetFull.ts) and while a page is being
// scrolled down, and comes back when the sheet leaves full, on scrolling up, or
// once the page's scroll reaches its end (#142).

interface TabLinkProps {
  href: string;
  label: string;
  current: boolean;
  icon: ReactNode;
}

function TabLink({ href, label, current, icon }: TabLinkProps) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "flex h-16 min-w-11 flex-1 flex-col items-center justify-center gap-1 text-tab-label",
        current ? "font-extrabold text-violet" : "font-semibold text-text-muted",
      )}
    >
      {icon}
      <span className={cn(current && "text-text")}>{label}</span>
    </Link>
  );
}

interface AccountIconProps {
  initial: string;
  current: boolean;
}

/** «Cuenta»'s icon: a 22px circle with the initial, outlined, or filled violet when current. */
function AccountIcon({ initial, current }: AccountIconProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-5.5 items-center justify-center rounded-pill font-display text-tab-label font-extrabold",
        current ? "bg-violet text-on-violet" : "border-thin border-text-muted text-text-muted",
      )}
    >
      {initial}
    </span>
  );
}

const ICON_CLASS = "size-5.5";

export function TabBar() {
  const t = useTranslations();
  const pathname = usePathname();
  const { data, isPending } = authClient.useSession();
  const scrolledDown = useHideOnScrollDown(pathname);
  const sheetFull = useResultsSheetFull();

  const user = data?.user;
  const current = currentTab(pathname);
  const visible = !isPending && showsTabBar(pathname, Boolean(user));
  // MAPUI-53 (bug fix): useHideOnScrollDown listens for every scroll event
  // bubbling to `window` in the capture phase, so panning the map or
  // scrolling the results sheet on /map fired it too. /map has no page
  // scroll of its own outside the map and the sheet, so on /map only the
  // sheet going full may hide the bar; scroll-down/scroll-up still applies
  // on the signed-in section pages.
  const onMap = pathname === "/map";
  const hidden = onMap ? sheetFull : scrolledDown;

  return (
    <AnimatePresence>
      {visible && (
        <motion.nav
          key="bottom-nav"
          data-testid="bottom-nav"
          data-tab-bar
          {...crossFade}
          animate={{ ...crossFade.animate, y: hidden ? "100%" : "0%" }}
          aria-label={t("nav.main")}
          aria-hidden={hidden}
          inert={hidden}
          className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface pb-safe-bottom lg:hidden"
        >
          <TabLink
            href="/map"
            label={t("nav.map")}
            current={current === "map"}
            icon={<MapIcon aria-hidden="true" strokeWidth={2} className={ICON_CLASS} />}
          />
          {user && (
            <>
              <TabLink
                href="/favorites"
                label={t("nav.saved")}
                current={current === "saved"}
                icon={<Heart aria-hidden="true" strokeWidth={2} className={ICON_CLASS} />}
              />
              <TabLink
                href="/alerts"
                label={t("nav.alerts")}
                current={current === "alerts"}
                icon={<Bell aria-hidden="true" strokeWidth={2} className={ICON_CLASS} />}
              />
              <TabLink
                href="/account"
                label={t("nav.account")}
                current={current === "account"}
                icon={
                  <AccountIcon
                    initial={initialOf(user.name, user.email)}
                    current={current === "account"}
                  />
                }
              />
            </>
          )}
          {!user && (
            <TabLink
              href="/login"
              label={t("nav.signIn")}
              current={false}
              icon={<LogIn aria-hidden="true" strokeWidth={2} className={ICON_CLASS} />}
            />
          )}
        </motion.nav>
      )}
    </AnimatePresence>
  );
}
