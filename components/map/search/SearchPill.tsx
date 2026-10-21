"use client";

import {
  type Dispatch,
  type KeyboardEvent,
  type ReactNode,
  type SetStateAction,
  useId,
} from "react";
import { BellPlus, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ShownPlace } from "@/interfaces/location";
import { Button } from "@/components/ui/button";
import type { SearchPopover } from "@/lib/hooks/useSearchFilters";
import { carLabel, placeLabel, priceLabel } from "@/lib/search/filter-chips";
import { cn } from "@/lib/utils";
import { AnimatedPopover } from "./AnimatedPopover";
import { closeListboxFirst } from "./Combobox";

interface PillVariantStyles {
  formPadding: string;
  segmentPadding: string;
  segmentBox: string;
  labelLeading: string;
  valueTypography: string;
  submitClassName: string;
  searchIconStrokeWidth: number;
  searchIconClassName: string;
  sideOffset: number;
  avoidCollisions: boolean;
  collisionPadding?: number;
  popoverScrollClassName?: string;
}

// The pill's two sizes (SearchPill README › Mapa, Landing), gathered here
// instead of a `landing ? … : …` ternary at each class and popover option —
// one lookup, keyed by the `variant` prop itself.
const VARIANT = {
  map: {
    formPadding: "h-12 py-1.25 pr-1.25 pl-2",
    segmentPadding: "px-5.5",
    segmentBox: "h-9 justify-center",
    labelLeading: "leading-font",
    valueTypography: "text-body-15 leading-font",
    submitClassName: "size-9",
    searchIconStrokeWidth: 2.4,
    searchIconClassName: "size-4.5",
    sideOffset: 14,
    avoidCollisions: true,
  },
  landing: {
    formPadding: "py-2 pr-2 pl-2.5",
    segmentPadding: "px-6.5",
    segmentBox: "py-1.5",
    labelLeading: "leading-font",
    valueTypography: "text-body leading-font",
    submitClassName: "h-13.5 gap-1.75 px-6 text-base font-extrabold",
    searchIconStrokeWidth: 2.6,
    searchIconClassName: "size-4.25",
    sideOffset: 19,
    avoidCollisions: false,
    collisionPadding: 8,
    popoverScrollClassName: "max-h-(--radix-popover-content-available-height) overflow-y-auto",
  },
} satisfies Record<"map" | "landing", PillVariantStyles>;

// docs/specs/redesign-map.md (MAPUI-1, MAPUI-2, MAPUI-12);
// docs/design/system/components/SearchPill/README.md (Cabecera del mapa). The
// desktop map header's centre: a 48px `surface` pill with three segments (Dónde,
// Coche, Precio) split by `line` dividers and the round 36px lime «Buscar».
//
// Each segment is the trigger of its popover. Which one is open is the
// caller's single `openSegment` (lib/hooks/useSearchFilters.ts's
// `activePopover`), so at most one is (MAPUI-2). The caller hands over its
// state setter and the pill decides the next value here, for every caller:
// switching straight from one open segment to another fires the new
// segment's open and the old popover's dismiss-on-outside-interaction close
// in the same gesture, so a segment's close only clears the state while that
// segment is still the open one — a close that arrives after another segment
// opened leaves it open. A segment's accessible name
// is its value; its overline label describes it. The open one carries
// `aria-expanded="true"` and a 2px lime underline. The popovers' bodies
// (LocationPopover, CarPopover, PricePopover) arrive through `popovers`,
// framed here as the 420px card anchored under the pill. Escape inside a
// popover closes an open list first, then the popover (closeListboxFirst).
//
// «Crear alerta» follows the pill, 10px apart (HeaderNav README › Mapa): a
// secondary 40px button with the bell-plus icon, which opens the create-alert
// dialog anchored 8px under it and aligned to its right edge
// (docs/design/system/components/CreateAlert/README.md, MAPUI-39). The
// dialog's body arrives through `createAlert` and draws its own card.
//
// `variant="landing"` is the landing's own size (SearchPill README › Landing):
// padding 8px 8px 8px 10px, segments 6px 26px, 16px values set at the
// font's own line height and a 54px «Buscar» with the magnifier and its
// label. Its «Coche» shows the muted «Marca o modelo…» until a car is
// chosen, where the map's reads «Cualquier marca» (MAPUI-1). The landing
// has no «Crear alerta», so that variant leaves it out.
//
// Hover turns a segment's value lime and brightens «Buscar»; a press scales
// either to 0.97, off under reduced motion (MOTION-6).
export interface SearchPillProps {
  place: ShownPlace | null;
  radiusKm: number;
  brand: string;
  model: string;
  minPrice?: number;
  maxPrice?: number;
  openSegment: SearchPopover | null;
  setOpenSegment: Dispatch<SetStateAction<SearchPopover | null>>;
  onSearch: () => void;
  popovers?: Partial<Record<SearchPopover, ReactNode>>;
  createAlertOpen?: boolean;
  onCreateAlertOpenChange?: (open: boolean) => void;
  createAlert?: ReactNode;
  variant?: "map" | "landing";
}

export function SearchPill({
  place,
  radiusKm,
  brand,
  model,
  minPrice,
  maxPrice,
  openSegment,
  setOpenSegment,
  onSearch,
  popovers = {},
  createAlertOpen = false,
  onCreateAlertOpenChange,
  createAlert,
  variant = "map",
}: SearchPillProps) {
  const t = useTranslations();
  const locale = useLocale();
  const copy = { t, locale };

  const where = placeLabel(place?.displayName, radiusKm, copy);
  const car = carLabel({ brand, model }, copy);
  const price = priceLabel({ minPrice, maxPrice }, copy);
  const landing = variant === "landing";
  const styles = VARIANT[variant];

  function handleSearch() {
    if (openSegment) setOpenSegment(null);
    onSearch();
  }

  const segmentProps = (segment: SearchPopover) => ({
    open: openSegment === segment,
    content: popovers[segment],
    onOpenChange: (open: boolean) =>
      setOpenSegment((current) => {
        if (open) return segment;
        return current === segment ? null : current;
      }),
  });

  return (
    <>
      <search>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleSearch();
          }}
          className={cn(
            "flex items-center rounded-pill border border-line bg-surface",
            styles.formPadding,
          )}
        >
          <Segment
            label={t("search.where")}
            value={where ?? t("search.wherePlaceholder")}
            muted={!where}
            divided
            styles={styles}
            {...segmentProps("where")}
          />
          <Segment
            label={t("search.car")}
            value={car ?? (landing ? t("search.carPlaceholder") : t("search.anyBrand"))}
            muted={landing && !car}
            divided
            styles={styles}
            {...segmentProps("car")}
          />
          <Segment
            label={t("search.price")}
            value={price ?? t("search.priceAny")}
            muted={!price}
            divided={false}
            styles={styles}
            {...segmentProps("price")}
          />
          <button
            type="submit"
            aria-label={landing ? undefined : t("search.submit")}
            className={cn(
              "flex shrink-0 cursor-pointer items-center justify-center rounded-pill bg-lime text-on-lime transition-[filter,scale] hover:brightness-108 active:scale-97 motion-reduce:active:scale-none",
              styles.submitClassName,
            )}
          >
            <Search
              aria-hidden="true"
              strokeWidth={styles.searchIconStrokeWidth}
              className={styles.searchIconClassName}
            />
            {landing && t("search.submit")}
          </button>
        </form>
      </search>
      {!landing && (
        <AnimatedPopover
          open={createAlertOpen && createAlert != null}
          onOpenChange={onCreateAlertOpenChange}
          trigger={
            <Button type="button" variant="secondary" size="40">
              <BellPlus aria-hidden="true" strokeWidth={2.2} className="size-4.5" />
              {t("createAlert.open")}
            </Button>
          }
          content={createAlert}
          ariaLabel={t("createAlert.open")}
          align="end"
          sideOffset={8}
          className="z-50"
        />
      )}
    </>
  );
}

interface SegmentProps {
  label: string;
  value: string;
  muted: boolean;
  divided: boolean;
  styles: PillVariantStyles;
  open: boolean;
  content: ReactNode;
  onOpenChange: (open: boolean) => void;
}

function Segment({
  label,
  value,
  muted,
  divided,
  styles,
  open,
  content,
  onOpenChange,
}: SegmentProps) {
  const labelId = useId();

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    // Escape closes the open popover and leaves the focus on its segment
    // (MAPUI-2); from inside the card, Radix returns it here itself.
    if (event.key === "Escape" && open) onOpenChange(false);
  }

  return (
    <AnimatedPopover
      open={open}
      onOpenChange={onOpenChange}
      trigger={
        <button
          type="button"
          aria-describedby={labelId}
          onKeyDown={handleKeyDown}
          className={cn(
            "group relative flex cursor-pointer flex-col whitespace-nowrap text-left font-sans text-text transition-[color,scale] hover:text-lime active:scale-97 motion-reduce:active:scale-none",
            styles.segmentPadding,
            styles.segmentBox,
            divided && "border-r border-line",
          )}
        >
          <span
            id={labelId}
            aria-hidden="true"
            className={cn("text-overline font-bold uppercase text-text-muted", styles.labelLeading)}
          >
            {label}
          </span>
          <span
            className={cn(
              "max-w-50 truncate font-semibold",
              styles.valueTypography,
              muted && "text-text-muted transition-[color] group-hover:text-lime",
            )}
          >
            {value}
          </span>
          <span
            aria-hidden="true"
            className={cn(
              "absolute inset-x-5.5 bottom-0 h-0.5 rounded-pill bg-lime transition-[opacity,scale] motion-reduce:transition-none",
              open ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0",
            )}
          />
        </button>
      }
      content={content}
      ariaLabel={label}
      onEscapeKeyDown={closeListboxFirst}
      align="start"
      // 8px under the pill: the segment sits 6px inside it, plus its border;
      // on the landing, the 54px «Buscar» sets the row and the pill pads 8px.
      sideOffset={styles.sideOffset}
      // The landing's pill sits mid-screen, where a tall popover would flip
      // above it and cover the headline; it always opens under the pill
      // (SearchPopover README), scrolling inside whatever room is left.
      avoidCollisions={styles.avoidCollisions}
      collisionPadding={styles.collisionPadding}
      className={cn(
        "z-50 w-105 rounded-card border border-line bg-surface p-5 font-sans text-text shadow-float",
        styles.popoverScrollClassName,
      )}
    />
  );
}
