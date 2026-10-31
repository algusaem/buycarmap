"use client";

import { useTranslations } from "next-intl";
import type { SearchInput } from "@/lib/search/schema";
import { useMileageDraft } from "@/lib/hooks/useMileageDraft";
import { NumberBox } from "./NumberBox";

// docs/specs/redesign-map.md (MAPUI-84 to MAPUI-86): «Kilómetros»'s «Mínimo»
// and «Máximo», the filters panel's own peer of PriceRange.tsx's boxes.

interface MileageRangeProps {
  minKm: number | undefined;
  maxKm: number | undefined;
  onChange: (patch: Partial<SearchInput>) => void;
  /** MAPUI-21: in the phone sheet, each box applies as typed, like the price
   * boxes; MAPUI-86's swap happens once, at «Ver coches»
   * (lib/hooks/useFilterSheetDraft.ts), not here. */
  live?: boolean;
}

/**
 * «Kilómetros»'s «Mínimo» and «Máximo» (MAPUI-84, MAPUI-85, MAPUI-86). On
 * desktop the two boxes share one draft (lib/hooks/useMileageDraft.ts), so a
 * minimum above the maximum — or the reverse — swaps with it on blur
 * or Enter of either box; on the phone they are independent, like the price
 * boxes, since the sheet's own draft is what «Ver coches» later hands over
 * and swaps.
 */
export function MileageRange({ minKm, maxKm, onChange, live = false }: MileageRangeProps) {
  if (live) return <LiveMileageRange minKm={minKm} maxKm={maxKm} onChange={onChange} />;
  return <DesktopMileageRange minKm={minKm} maxKm={maxKm} onChange={onChange} />;
}

interface MileageBoxesProps {
  minKm: number | undefined;
  maxKm: number | undefined;
  onMinChange: (value: number | undefined) => void;
  onMaxChange: (value: number | undefined) => void;
  onCommit: () => void;
}

/** «Kilómetros»'s two boxes, shared by the live and the desktop draft paths. */
function MileageBoxes({ minKm, maxKm, onMinChange, onMaxChange, onCommit }: MileageBoxesProps) {
  const t = useTranslations();

  return (
    <div className="flex gap-2.5">
      <NumberBox
        name="minKm"
        label={t("filters.kmMin")}
        placeholder={t("filters.minKmPlaceholder")}
        value={minKm}
        onValueChange={onMinChange}
        onCommit={onCommit}
        grouped
        suffix={t("filters.kmSuffix")}
        suffixOnlyWithValue
      />
      <NumberBox
        name="maxKm"
        label={t("filters.kmMax")}
        placeholder={t("filters.maxKmPlaceholder")}
        value={maxKm}
        onValueChange={onMaxChange}
        onCommit={onCommit}
        grouped
        suffix={t("filters.kmSuffix")}
        suffixOnlyWithValue
      />
    </div>
  );
}

function LiveMileageRange({ minKm, maxKm, onChange }: Omit<MileageRangeProps, "live">) {
  return (
    <MileageBoxes
      minKm={minKm}
      maxKm={maxKm}
      onMinChange={(value) => onChange({ minKm: value })}
      onMaxChange={(value) => onChange({ maxKm: value })}
      onCommit={() => {
        // Already applied on every edit above (LiveCriterionBox's own pattern).
      }}
    />
  );
}

function DesktopMileageRange({ minKm, maxKm, onChange }: Omit<MileageRangeProps, "live">) {
  const { minDraft, setMinDraft, maxDraft, setMaxDraft, commit } = useMileageDraft(
    { minKm, maxKm },
    onChange,
  );

  return (
    <MileageBoxes
      minKm={minDraft}
      maxKm={maxDraft}
      onMinChange={setMinDraft}
      onMaxChange={setMaxDraft}
      onCommit={commit}
    />
  );
}
