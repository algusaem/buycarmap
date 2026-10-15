import { useTranslations } from "next-intl";
import { SavedColumn, SavedHeading, SavedMapFrame } from "@/components/favorites/SavedLayout";
import { SortChips } from "@/components/favorites/SortChips";
import { MapPill } from "@/components/map/ResultsStates";
import { Skeleton } from "@/components/ui/skeleton";

// docs/specs/redesign-saved.md (SAVED-30); F5-guardados-estados: the loading
// placeholders, shaped like what they stand for. Desktop: the Guardados card's
// 20:17 photo, the name and «año · km» bars in `surface`, the price bar in
// `surface-strong`. Phone: the compact row's 110×86 thumbnail and its three
// bars. Each is `aria-hidden`; the busy region around them speaks for them.
//
// SavedPagePlaceholder is the whole page while it loads: at desktop width the
// heading and the chips, placeholder Guardados cards and the map with no pin,
// only «Tus guardados en el mapa»; at phone width the heading and placeholder
// rows. The placeholders are one `aria-busy` region holding a visually hidden
// «Cargando…» in a polite status, the page's only live region while it loads.
// Both compositions are drawn and CSS breakpoints pick one, so nothing waits
// on the client's media queries: app/favorites/loading.tsx draws it, and so
// does the list until those queries have resolved (FavoritesList), so a phone
// never paints the desktop composition first. The chips do nothing yet, so
// they are drawn with no handler and `inert`.

const PLACEHOLDERS = { phone: 7, desktop: 6 };

function keys(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `placeholder-${index}`);
}

export function SavedPagePlaceholder() {
  const t = useTranslations();

  return (
    <div className="flex min-h-0 flex-1">
      <SavedColumn>
        <SavedHeading
          chips={
            <div inert data-testid="saved-loading-chips" className="contents">
              <SortChips sort="recent" />
            </div>
          }
        />
        <div aria-busy="true">
          <span role="status" className="sr-only">
            {t("map.loading")}
          </span>
          <div data-testid="saved-loading-phone" className="grid gap-4.5 lg:hidden">
            {keys(PLACEHOLDERS.phone).map((key) => (
              <SavedRowPlaceholder key={key} />
            ))}
          </div>
          <div
            data-testid="saved-loading-desktop"
            className="hidden gap-x-5 gap-y-7 lg:grid lg:grid-cols-2 xl:grid-cols-3"
          >
            {keys(PLACEHOLDERS.desktop).map((key) => (
              <SavedCardPlaceholder key={key} />
            ))}
          </div>
        </div>
      </SavedColumn>
      <SavedMapFrame>
        <MapPill text={t("favorites.mapTitle")} live={false} />
      </SavedMapFrame>
    </div>
  );
}

function SavedCardPlaceholder() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3">
      <Skeleton className="aspect-20/17 rounded-card bg-surface" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-18/25 rounded-skeleton-sm bg-surface" />
        <Skeleton className="h-3.5 w-13/25 rounded-skeleton-sm bg-surface" />
        <Skeleton className="mt-1.5 h-6 w-19/50 rounded-skeleton bg-surface-strong" />
      </div>
    </div>
  );
}

function SavedRowPlaceholder() {
  return (
    <div aria-hidden="true" className="flex items-center gap-3.5">
      <Skeleton className="h-21.5 w-27.5 shrink-0 rounded-thumb bg-surface" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-18/25 rounded-skeleton-sm bg-surface" />
        <Skeleton className="h-3.5 w-13/25 rounded-skeleton-sm bg-surface" />
        <Skeleton className="mt-1 h-5 w-19/50 rounded-skeleton bg-surface-strong" />
      </div>
    </div>
  );
}
