import { useTranslations } from "next-intl";
import { setMapFiltersSlot, setMapHeaderSlot } from "@/lib/hooks/useMapHeaderSlot";
import {
  type HeaderSession,
  MainNav,
  SectionNav,
  SectionNavPlaceholder,
  TextLink,
} from "./HeaderParts";
import { LanguageControl } from "./LanguageControl";
import { Wordmark } from "./Wordmark";

// HeaderNav README › Mapa and › Mapa en portátil (HEAD-1, HEAD-2, HEAD-21);
// docs/specs/redesign-map.md (MAPUI-64, MAPUI-70). One `surface` band with no
// border, 48px from each side, on a grid. The navigation is the pages
// header's: Mapa (current) · Guardados · Alertas and the avatar. From 1440px
// (`3xl`) it is two rows: row one, 24px under the top, is `1fr auto 1fr` with
// the wordmark at the start, the search group (the 48px search pill and
// «Crear alerta», MAPUI-1) in the centre column and the navigation at the
// end; row two, 28px under the pill and 17px above the band's bottom, holds
// «Filtros» and the quick filters (MAPUI-63) in the same centre column, so
// both rows share its axis. From 1024 to 1439px the three don't fit in one
// row, so the band takes three: the wordmark and the navigation, then the
// search group 20px under them, then the filters 28px under it, each
// centred. The map page owns the search and filters state, so their cells
// are handed to it through `setMapHeaderSlot` and `setMapFiltersSlot` and the
// page portals its parts in. Both cells keep their height while empty, so the
// band does not jump when the page mounts. There is no phone region: on a
// phone the map has no app header (HEAD-7).
export function MapHeader({ session }: { session: HeaderSession }) {
  const t = useTranslations();

  return (
    <div
      data-testid="header-desktop"
      // The skip link sits on row one, 24px from the top (app/globals.css, A11Y-1).
      data-skip-link="map"
      className="hidden grid-cols-[1fr_auto] grid-rows-[3rem_auto_auto] bg-surface px-12 pt-6 pb-4.25 lg:grid 3xl:grid-cols-[1fr_auto_1fr] 3xl:grid-rows-[3rem_auto]"
    >
      <Wordmark size="desktop" className="col-start-1 row-start-1 self-center justify-self-start" />
      <div
        ref={setMapHeaderSlot}
        className="col-span-2 row-start-2 mt-5 flex h-12 items-center gap-2.5 justify-self-center 3xl:col-span-1 3xl:col-start-2 3xl:row-start-1 3xl:mt-0"
      />
      <MainNav className="col-start-2 row-start-1 gap-1.5 justify-self-end 3xl:col-start-3">
        <LanguageControl />
        {session.status === "signedIn" && (
          <SectionNav name={session.name} email={session.email} current="map" onAccount={false} />
        )}
        {session.status === "pending" && <SectionNavPlaceholder />}
        {session.status === "signedOut" && <TextLink href="/login">{t("nav.signIn")}</TextLink>}
      </MainNav>
      <div
        ref={setMapFiltersSlot}
        className="col-span-2 row-start-3 mt-7 flex h-8.5 justify-center 3xl:col-span-1 3xl:col-start-2 3xl:row-start-2"
      />
    </div>
  );
}
