import Link from "next/link";
import { useTranslations } from "next-intl";
import { DesktopRegion, MainNav, PhoneRegion, PhoneTextLink } from "./HeaderParts";
import { LanguageControl } from "./LanguageControl";
import { Wordmark } from "./Wordmark";

interface AccessHeaderProps {
  /** The legal pages say «Volver» on the phone; the sign-in and recovery pages «Mapa» (HEAD-7). */
  legal: boolean;
}

// HeaderNav README › Entrar y páginas de acceso (HEAD-6): the same header
// signed in or not — the language and «Volver al mapa» (ghost, 15px weight
// 700) on desktop, the language and one text link back to the map on the
// phone. It reads no session, so it has nothing to hold back while the
// session resolves.
export function AccessHeader({ legal }: AccessHeaderProps) {
  const t = useTranslations();

  return (
    <>
      <DesktopRegion open>
        <Wordmark size="desktop" />
        <MainNav>
          <LanguageControl />
          <Link
            href="/map"
            className="flex h-11 items-center whitespace-nowrap text-[15px] font-bold text-text transition-colors hover:text-lime"
          >
            {t("nav.backToMap")}
          </Link>
        </MainNav>
      </DesktopRegion>

      <PhoneRegion open>
        <Wordmark size="phone" />
        <MainNav>
          <LanguageControl />
          <PhoneTextLink href="/map">{legal ? t("nav.back") : t("nav.map")}</PhoneTextLink>
        </MainNav>
      </PhoneRegion>
    </>
  );
}
