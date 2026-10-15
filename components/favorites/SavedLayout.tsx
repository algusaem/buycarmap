"use client";

import type { ReactNode, Ref, UIEventHandler } from "react";
import { useTranslations } from "next-intl";
import { TAB_BAR_CLEARANCE } from "@/components/nav/tab-bar-clearance";
import { cn } from "@/lib/utils";

// docs/specs/redesign-saved.md (SAVED-1 to SAVED-4, SAVED-30 to SAVED-32);
// docs/design/canvas/R3-favoritos.dc.html. The frame /favorites draws in every
// state — the list, its loading and its error: the list column, which alone
// scrolls and holds the heading, and from `lg` the map beside it.

interface SavedColumnProps {
  ref?: Ref<HTMLDivElement>;
  onScroll?: UIEventHandler<HTMLDivElement>;
  children: ReactNode;
}

/**
 * The list column: 22px 20px of padding on a phone, over the tab bar's
 * clearance; from `lg` 30px 32px, 546px wide, and 830px from `xl`, as /map's
 * list (SAVED-3). It is the one scrolling element, so the header and the map
 * never move (SAVED-4). `scroll-auto`: a jump to a pin's card or a restored
 * scroll lands at once, unless asked to glide (lib/hooks/useSavedList.ts).
 */
export function SavedColumn({ ref, onScroll, children }: SavedColumnProps) {
  return (
    <div
      ref={ref}
      data-testid="saved-list"
      onScroll={onScroll}
      className={cn(
        "relative min-h-0 min-w-0 flex-1 scroll-auto overflow-y-auto overscroll-contain px-5 pt-5.5 lg:w-136.5 lg:flex-none lg:px-8 lg:pt-7.5 lg:pb-7.5 xl:w-207.5",
        TAB_BAR_CLEARANCE,
      )}
    >
      {children}
    </div>
  );
}

interface SavedHeadingProps {
  /** The sort chips, on the heading's row from `xl` and under it below (SAVED-3). */
  chips?: ReactNode;
}

/** «Guardados», the page's `h1`, drawn in capitals (SAVED-1, SAVED-2). */
export function SavedHeading({ chips }: SavedHeadingProps) {
  const t = useTranslations();

  return (
    <div className="mb-4.5 flex flex-col items-start gap-4 lg:mb-6 xl:flex-row xl:items-end xl:justify-between">
      <h1 className="m-0 font-display text-page-title-mobile font-black uppercase lg:text-page-title">
        {t("favorites.title")}
      </h1>
      {chips}
    </div>
  );
}

interface SavedMapFrameProps {
  children?: ReactNode;
}

/** The map's region, «Mapa de tus guardados», filling the width beside the list from `lg` (SAVED-1). */
export function SavedMapFrame({ children }: SavedMapFrameProps) {
  const t = useTranslations();

  return (
    <section
      aria-label={t("favorites.mapLabel")}
      className="relative hidden min-w-0 flex-1 border-l border-line-soft bg-map-ground lg:flex"
    >
      {children}
    </section>
  );
}
