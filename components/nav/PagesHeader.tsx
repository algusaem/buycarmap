import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar } from "./Avatar";
import {
  DesktopRegion,
  type HeaderSession,
  MainNav,
  PhoneRegion,
  PhoneTextLink,
  SectionLinks,
  TextLink,
} from "./HeaderParts";
import { LanguageControl } from "./LanguageControl";
import type { Section } from "./nav-routes";
import { Wordmark } from "./Wordmark";

interface PagesHeaderProps {
  session: HeaderSession;
  /** The section marked current; none on `/account` and on the landing. */
  current: Section | undefined;
  /** On `/account` the avatar carries the current ring (HEAD-4). */
  onAccount: boolean;
  /** The signed-in landing reuses this header with the landing's 48px sides and no divider. */
  open: boolean;
}

// HeaderNav README › Páginas, and › Landing con sesión: the language, Mapa ·
// Guardados · Alertas and, 8px further, the avatar (HEAD-3, HEAD-5, HEAD-7).
// Signed out (a session that ended on one of these pages, HEAD-12) it offers
// only «Entrar», like the signed-out map header. At phone width the section
// pages show no avatar, because «Cuenta» is in the tab bar (MAPUI-54); the
// signed-in landing (`open`) keeps it, since the landing has no tab bar.
export function PagesHeader({ session, current, onAccount, open }: PagesHeaderProps) {
  const t = useTranslations();

  return (
    <>
      <DesktopRegion open={open}>
        <Wordmark size="desktop" />
        <MainNav className="gap-1.5">
          <LanguageControl />
          {session.status === "signedIn" && (
            <>
              <SectionLinks current={current} />
              <span className="ml-2 flex">
                <Avatar
                  name={session.name}
                  email={session.email}
                  size="desktop"
                  current={onAccount}
                />
              </span>
            </>
          )}
          {session.status === "pending" && (
            <>
              <Skeleton className="h-10.5 w-18 rounded-pill" />
              <Skeleton className="h-10.5 w-28 rounded-pill" />
              <Skeleton className="h-10.5 w-21 rounded-pill" />
              <Skeleton className="ml-2 size-10.5 rounded-pill" />
            </>
          )}
          {session.status === "signedOut" && <TextLink href="/login">{t("nav.signIn")}</TextLink>}
        </MainNav>
      </DesktopRegion>

      <PhoneRegion open={open}>
        <Wordmark size="phone" />
        <MainNav>
          <LanguageControl />
          {open && session.status === "signedIn" && (
            <Avatar name={session.name} email={session.email} size="phone" current={onAccount} />
          )}
          {session.status === "pending" && (
            <span className="flex size-11 items-center justify-center">
              <Skeleton className="size-9 rounded-pill" />
            </span>
          )}
          {session.status === "signedOut" && (
            <PhoneTextLink href="/login">{t("nav.signIn")}</PhoneTextLink>
          )}
        </MainNav>
      </PhoneRegion>
    </>
  );
}
