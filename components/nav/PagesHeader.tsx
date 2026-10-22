import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BackLink,
  DesktopRegion,
  type HeaderSession,
  MainNav,
  PhoneRegion,
  PhoneTextLink,
  SectionNav,
  SectionNavPlaceholder,
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
  /** The signed-in landing reuses this header with the landing's 48px sides (desktop) and no divider. */
  open: boolean;
  /** At phone width, «Volver» before the wordmark, to this page (an alert's page, ALERTUI-22). */
  back?: string;
}

// HeaderNav README › Páginas, and › Landing con sesión: the language, Mapa ·
// Guardados · Alertas and, 8px further, the avatar (HEAD-3, HEAD-5, HEAD-7).
// Signed out (a session that ended on one of these pages, HEAD-12) it offers
// only «Entrar», like the signed-out map header. At phone width every caller
// shows no avatar, because «Cuenta» is in the tab bar — the section pages
// (MAPUI-54) and, since ENTRY-8 gave the landing a tab bar too, the signed-in
// landing as well (amends HEAD-7, which used to keep it there).
export function PagesHeader({ session, current, onAccount, open, back }: PagesHeaderProps) {
  const t = useTranslations();

  return (
    <>
      <DesktopRegion open={open}>
        <Wordmark size="desktop" />
        <MainNav className="gap-1.5">
          <LanguageControl />
          {session.status === "signedIn" && (
            <SectionNav
              name={session.name}
              email={session.email}
              current={current}
              onAccount={onAccount}
            />
          )}
          {session.status === "pending" && <SectionNavPlaceholder />}
          {session.status === "signedOut" && <TextLink href="/login">{t("nav.signIn")}</TextLink>}
        </MainNav>
      </DesktopRegion>

      <PhoneRegion open={open}>
        <span className="flex items-center gap-3">
          {back && <BackLink href={back} />}
          <Wordmark size="phone" />
        </span>
        <MainNav>
          <LanguageControl />
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
