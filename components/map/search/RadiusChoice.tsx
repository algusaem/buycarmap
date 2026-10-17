"use client";

import { useTranslations } from "next-intl";
import { RADII_KM } from "@/lib/search/radii";
import { RadioChips } from "./RadioChips";

// docs/specs/redesign-map.md (MAPUI-4): the radii 10, 25, 50, 100 and 200 km
// as one single-choice group that shares the width, disabled while no place
// is chosen (keeps MAP-13). In the «Dónde» popover and the «BUSCAR» sheet.

interface RadiusChoiceProps {
  radiusKm: number;
  disabled: boolean;
  onChange: (radiusKm: number) => void;
}

export function RadiusChoice({ radiusKm, disabled, onChange }: RadiusChoiceProps) {
  const t = useTranslations();

  return (
    <RadioChips
      label={t("search.radius")}
      variant="chips"
      stretch
      disabled={disabled}
      value={radiusKm}
      onChange={onChange}
      options={RADII_KM.map((km) => ({ value: km, label: t("search.radiusOption", { km }) }))}
    />
  );
}
