import type { ReactNode } from "react";
import Link from "next/link";
import { Bell, Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { setMapHeaderSlot } from "@/lib/hooks/useMapHeaderSlot";
import { Avatar } from "./Avatar";
import { type HeaderSession, MainNav, TextLink } from "./HeaderParts";
import { LanguageControl } from "./LanguageControl";
import { Wordmark } from "./Wordmark";

// HeaderNav README › Mapa (HEAD-1, HEAD-2): a `1fr auto 1fr` grid, the
// wordmark at the start and only navigation on the right, 10px apart. The
// centre column is the search group's (the search pill and «Crear alerta»,
// docs/specs/redesign-map.md MAPUI-1). The map page owns that state, so the
// cell is handed to it through `setMapHeaderSlot` and the page portals the
// group in. There is no phone region: on a phone the map has no app header
// (HEAD-7).
export function MapHeader({ session }: { session: HeaderSession }) {
  const t = useTranslations();

  return (
    <div
      data-testid="header-desktop"
      className="hidden h-20 grid-cols-[1fr_auto_1fr] items-center border-b border-line-soft px-8 lg:grid"
    >
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
  );
}

interface IconLinkProps {
  href: string;
  label: string;
  children: ReactNode;
}

/** The 42px round icon shortcut to a section (HeaderNav README › Mapa). */
function IconLink({ href, label, children }: IconLinkProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="flex size-10.5 items-center justify-center rounded-pill border border-line text-text transition-colors hover:text-lime"
    >
      {children}
    </Link>
  );
}
