"use client";

import { useTranslations } from "next-intl";
import { CarTypeahead } from "./CarTypeahead";
import { PopoverResetButton } from "./PopoverResetButton";

// docs/specs/redesign-map.md (MAPUI-6 to MAPUI-10). "Coche"'s popover: the
// type-ahead (CarTypeahead — a local brand match, and the models of at most
// three brands from `listCarModels`) and «Cualquier marca». A model choice
// closes the popover; a brand choice keeps it open on that brand's models
// (MAPUI-7, MAPUI-8). SearchPill frames it in the popover card; this is its
// body.
export interface CarPopoverProps {
  brand: string;
  model: string;
  onSelectBrand: (brand: string) => void;
  onSelectModel: (model: string) => void;
  onClear: () => void;
  onClose: () => void;
}

export function CarPopover({
  brand,
  model,
  onSelectBrand,
  onSelectModel,
  onClear,
  onClose,
}: CarPopoverProps) {
  const t = useTranslations();

  return (
    <div className="flex flex-col gap-4">
      <CarTypeahead
        brand={brand}
        model={model}
        onSelectBrand={onSelectBrand}
        onSelectModel={(name) => {
          onSelectModel(name);
          onClose();
        }}
        onClear={onClear}
      />
      <PopoverResetButton onClick={onClear}>{t("search.anyBrand")}</PopoverResetButton>
    </div>
  );
}
