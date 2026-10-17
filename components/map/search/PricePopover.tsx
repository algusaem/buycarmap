"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatPrice } from "@/lib/format";
import { PopoverResetButton } from "./PopoverResetButton";
import { PriceRange } from "./PriceRange";
import { RadioChips } from "./RadioChips";

// docs/specs/redesign-map.md (MAPUI-11). "Precio"'s popover: the two-knob
// range and the Mínimo/Máximo boxes (PriceRange), the four «Hasta …»
// shortcuts, which set the maximum and clear the minimum, and «Cualquier
// precio», which clears both. SearchPill frames it in the popover card; this
// is its body.
const SHORTCUTS = [5000, 10000, 20000, 30000];

export interface PricePopoverProps {
  minPrice?: number;
  maxPrice?: number;
  onApply: (minPrice: number | undefined, maxPrice: number | undefined) => void;
}

export function PricePopover({ minPrice, maxPrice, onApply }: PricePopoverProps) {
  const t = useTranslations();
  const locale = useLocale();

  // A shortcut reads as chosen only when it is the whole price criterion.
  const chosenShortcut =
    minPrice == null && maxPrice != null && SHORTCUTS.includes(maxPrice) ? maxPrice : undefined;

  return (
    <div className="flex flex-col gap-4">
      <PriceRange minPrice={minPrice} maxPrice={maxPrice} onApply={onApply} />
      <RadioChips
        label={t("search.priceMaxSlider")}
        variant="chips"
        value={chosenShortcut}
        onChange={(amount) => onApply(undefined, amount)}
        options={SHORTCUTS.map((amount) => ({
          value: amount,
          label: t("search.priceUpTo", { price: formatPrice(amount, locale) }),
        }))}
      />
      <PopoverResetButton onClick={() => onApply(undefined, undefined)}>
        {t("search.anyPrice")}
      </PopoverResetButton>
    </div>
  );
}
