"use client";

import { type KeyboardEvent, type ReactNode, useId } from "react";
import { BellPlus, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { SelectedLocation } from "@/interfaces/location";
import { Button } from "@/components/ui/button";
import type { SearchPopover } from "@/lib/hooks/useSearchFilters";
import { carLabel, placeLabel, priceLabel } from "@/lib/search/filter-chips";
import { cn } from "@/lib/utils";
import { AnimatedPopover } from "./AnimatedPopover";
import { closeListboxFirst } from "./Combobox";

// docs/specs/redesign-map.md (MAPUI-1, MAPUI-2, MAPUI-12);
// docs/design/system/components/SearchPill/README.md (Cabecera del mapa). The
// desktop map header's centre: a `surface` pill with three segments (Dónde,
// Coche, Precio) split by `line` dividers and the round lime «Buscar».
//
// Each segment is the trigger of its popover. Which one is open is the
// caller's single `openSegment` (lib/hooks/useSearchFilters.ts's
// `activePopover`), so at most one is (MAPUI-2). A segment's accessible name
// is its value; its overline label describes it. The open one carries
// `aria-expanded="true"` and a 2px lime underline. The popovers' bodies
// (LocationPopover, CarPopover, PricePopover) arrive through `popovers`,
// framed here as the 420px card anchored under the pill. Escape inside a
// popover closes an open list first, then the popover (closeListboxFirst).
//
// «Crear alerta» follows the pill, 10px apart (HeaderNav README › Mapa): a
// secondary 44px button with the bell-plus icon, which opens the create-alert
// dialog anchored 8px under it and aligned to its right edge
// (docs/design/system/components/CreateAlert/README.md, MAPUI-39). The
// dialog's body arrives through `createAlert` and draws its own card.
export interface SearchPillProps {
  place: SelectedLocation | null;
  radiusKm: number;
  brand: string;
  model: string;
  minPrice?: number;
  maxPrice?: number;
  openSegment: SearchPopover | null;
  onOpenSegment: (segment: SearchPopover) => void;
  onCloseSegment: () => void;
  onSearch: () => void;
  popovers?: Partial<Record<SearchPopover, ReactNode>>;
  createAlertOpen?: boolean;
  onCreateAlertOpenChange?: (open: boolean) => void;
  createAlert?: ReactNode;
}

export function SearchPill({
  place,
  radiusKm,
  brand,
  model,
  minPrice,
  maxPrice,
  openSegment,
  onOpenSegment,
  onCloseSegment,
  onSearch,
  popovers = {},
  createAlertOpen = false,
  onCreateAlertOpenChange,
  createAlert,
}: SearchPillProps) {
  const t = useTranslations();
  const locale = useLocale();
  const copy = { t, locale };

  const where = placeLabel(place?.displayName, radiusKm, copy);
  const car = carLabel({ brand, model }, copy);
  const price = priceLabel({ minPrice, maxPrice }, copy);

  function handleSearch() {
    if (openSegment) onCloseSegment();
    onSearch();
  }

  const segmentProps = (segment: SearchPopover) => ({
    open: openSegment === segment,
    content: popovers[segment],
    onOpenChange: (open: boolean) => (open ? onOpenSegment(segment) : onCloseSegment()),
  });

  return (
    <>
      <search>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleSearch();
          }}
          className="flex items-center rounded-pill border border-line bg-surface py-1.5 pr-1.5 pl-2"
        >
          <Segment
            label={t("search.where")}
            value={where ?? t("search.wherePlaceholder")}
            muted={!where}
            divided
            {...segmentProps("where")}
          />
          <Segment
            label={t("search.car")}
            value={car ?? t("search.anyBrand")}
            muted={false}
            divided
            {...segmentProps("car")}
          />
          <Segment
            label={t("search.price")}
            value={price ?? t("search.priceAny")}
            muted={!price}
            divided={false}
            {...segmentProps("price")}
          />
          <button
            type="submit"
            aria-label={t("search.submit")}
            className="flex size-11.5 shrink-0 cursor-pointer items-center justify-center rounded-pill bg-lime text-on-lime"
          >
            <Search aria-hidden="true" strokeWidth={2.4} className="size-4.5" />
          </button>
        </form>
      </search>
      <AnimatedPopover
        open={createAlertOpen && createAlert != null}
        onOpenChange={onCreateAlertOpenChange}
        trigger={
          <Button type="button" variant="secondary" size="44" className="px-4">
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
    </>
  );
}

interface SegmentProps {
  label: string;
  value: string;
  muted: boolean;
  divided: boolean;
  open: boolean;
  content: ReactNode;
  onOpenChange: (open: boolean) => void;
}

function Segment({ label, value, muted, divided, open, content, onOpenChange }: SegmentProps) {
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
            "relative flex cursor-pointer flex-col whitespace-nowrap px-5.5 py-1.5 text-left font-sans",
            divided && "border-r border-line",
          )}
        >
          <span
            id={labelId}
            aria-hidden="true"
            className="text-overline leading-normal font-bold uppercase text-text-muted"
          >
            {label}
          </span>
          <span
            className={cn(
              "max-w-50 truncate text-body-15 font-semibold text-text",
              muted && "text-text-muted",
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
      // 8px under the pill: the segment sits 6px inside it, plus its border.
      sideOffset={15}
      className="z-50 w-105 rounded-card border border-line bg-surface p-5 font-sans text-text shadow-float"
    />
  );
}
