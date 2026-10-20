import type { ReactNode } from "react";
import Link from "next/link";
import { Bell, Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { setMapFiltersSlot, setMapHeaderSlot } from "@/lib/hooks/useMapHeaderSlot";
import { Avatar } from "./Avatar";
import { type HeaderSession, MainNav, TextLink } from "./HeaderParts";
import { LanguageControl } from "./LanguageControl";
import { Wordmark } from "./Wordmark";

// HeaderNav README › Mapa (HEAD-1, HEAD-2, HEAD-21); docs/specs/redesign-map.md
// (MAPUI-64). One `surface` band with no border, 48px from each side, in two
// rows. Row one, 24px under the top, is a `1fr auto 1fr` grid: the wordmark
// at the start and only navigation on the right, 10px apart; the centre
// column is the search group's (the 48px search pill and «Crear alerta»,
// MAPUI-1). Row two, 28px under the pill and 17px above the band's bottom,
// holds «Filtros» and the quick filters (MAPUI-63), centred. The map page
// owns that state, so the two cells are handed to it through
// `setMapHeaderSlot` and `setMapFiltersSlot` and the page portals its parts
// in. Row two keeps its 34px while empty, so the band does not jump when the
// page mounts. There is no phone region: on a phone the map has no app
// header (HEAD-7).
export function MapHeader({ session }: { session: HeaderSession }) {
  const t = useTranslations();

  return (
    <div
      data-testid="header-desktop"
      // The skip link sits on row one, 24px from the top (app/globals.css, A11Y-1).
      data-skip-link="map"
      className="hidden flex-col bg-surface px-12 pt-6 pb-4.25 lg:flex"
    >
      <div className="grid h-12 grid-cols-[1fr_auto_1fr] items-center">
        <Wordmark size="desktop" className="justify-self-start" />
        <div ref={setMapHeaderSlot} className="flex items-center gap-2.5" />
        <MainNav className="justify-self-end gap-2.5">
          <LanguageControl />
          {session.status === "signedIn" && (
            <>
              <IconLink href="/favorites" label={t("nav.saved")}>
                <Heart className="size-4.5" aria-hidden="true" />
              </IconLink>
              <IconLink href="/alerts" label={t("nav.alerts")}>
                <Bell className="size-4.5" aria-hidden="true" />
              </IconLink>
              <Avatar name={session.name} email={session.email} size="desktop" current={false} />
            </>
          )}
          {session.status === "pending" && <Skeleton className="h-10.5 w-21 rounded-pill" />}
          {session.status === "signedOut" && <TextLink href="/login">{t("nav.signIn")}</TextLink>}
        </MainNav>
      </div>
      <div ref={setMapFiltersSlot} className="mt-7 flex h-8.5 justify-center" />
    </div>
  );
}

interface IconLinkProps {
  href: string;
  label: string;
  children: ReactNode;
}

/** The 42px round icon shortcut to a section (HeaderNav README › Mapa): lime on hover, 0.97 while pressed (MOTION-6). */
function IconLink({ href, label, children }: IconLinkProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="flex size-10.5 items-center justify-center rounded-pill border border-line text-text transition-[color,scale] hover:text-lime active:scale-97 motion-reduce:active:scale-none"
    >
      {children}
    </Link>
  );
}
