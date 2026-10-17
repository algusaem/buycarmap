"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";
import { useLocale, useTranslations } from "next-intl";
import { formatPrice } from "@/lib/format";
import { PRICE_RANGE_MAX, PRICE_RANGE_STEP, usePriceDraft } from "@/lib/hooks/usePriceDraft";
import { NumberBox } from "./NumberBox";

// docs/specs/redesign-map.md (MAPUI-11): the price range of «Precio», the
// «BUSCAR» sheet and the filters panel: the two knobs over the «Mínimo» and
// «Máximo» boxes. What each applies, and when, is lib/hooks/usePriceDraft.ts:
// knobs apply when released (or on each key press), boxes hand each edit over
// as typed, so closing the popover, or «Ver coches» in a phone sheet, keeps
// the amount; the swap of a minimum above the maximum applies when the box
// loses focus or on Enter.

interface PriceRangeProps {
  minPrice?: number;
  maxPrice?: number;
  onApply: (minPrice: number | undefined, maxPrice: number | undefined) => void;
}

const THUMB_CLASS =
  // 24px drawn, with a 44 × 44 hit area around it (RULES §19), the same
  // centred pseudo-element the pins and chips use.
  "relative block size-6 cursor-pointer rounded-pill bg-lime before:absolute before:top-1/2 before:left-1/2 before:size-11 before:-translate-x-1/2 before:-translate-y-1/2 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-lime";

export function PriceRange({ minPrice, maxPrice, onApply }: PriceRangeProps) {
  const t = useTranslations();
  const locale = useLocale();
  const price = usePriceDraft(minPrice, maxPrice, onApply);
  const [left, right] = price.knobs;
  const amount = (value: number) => formatPrice(value, locale);

  return (
    <div className="flex flex-col gap-3">
      <SliderPrimitive.Root
        min={0}
        max={PRICE_RANGE_MAX}
        step={PRICE_RANGE_STEP}
        value={[left, right]}
        onValueChange={price.slide}
        onValueCommit={price.release}
        className="relative mx-2 my-2.5 flex h-1 touch-none select-none items-center"
      >
        <SliderPrimitive.Track className="relative h-1 grow rounded-pill bg-line">
          <SliderPrimitive.Range className="absolute h-full rounded-pill bg-lime" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          aria-label={t("search.priceMinSlider")}
          aria-valuetext={amount(left)}
          className={THUMB_CLASS}
        />
        <SliderPrimitive.Thumb
          aria-label={t("search.priceMaxSlider")}
          aria-valuetext={amount(right)}
          className={THUMB_CLASS}
        />
      </SliderPrimitive.Root>
      <div className="flex gap-2.5">
        <NumberBox
          name="minPrice"
          label={t("search.priceMin")}
          suffix={t("search.priceCurrency")}
          value={price.draft.min}
          onValueChange={price.setMin}
          onCommit={price.applyBoxes}
          grouped
        />
        <NumberBox
          name="maxPrice"
          label={t("search.priceMax")}
          suffix={t("search.priceCurrency")}
          value={price.draft.max}
          onValueChange={price.setMax}
          onCommit={price.applyBoxes}
          grouped
        />
      </div>
    </div>
  );
}
