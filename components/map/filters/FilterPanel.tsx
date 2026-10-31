"use client";

import type { RefObject } from "react";
import { useTranslations } from "next-intl";
import { CarTypeahead } from "@/components/map/search/CarTypeahead";
import { closeListboxFirst } from "@/components/map/search/Combobox";
import { MileageRange } from "@/components/map/search/MileageRange";
import { NumberBox } from "@/components/map/search/NumberBox";
import { PanelSection } from "@/components/map/search/PanelSection";
import { PriceRange } from "@/components/map/search/PriceRange";
import { RadioChips } from "@/components/map/search/RadioChips";
import {
  ClearButton,
  PhoneBottomSheet,
  SheetHeader,
  ShowCarsFooter,
} from "@/components/map/phone/SheetChrome";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { useCriterionDraft } from "@/lib/hooks/useCriterionDraft";
import { useFilterSheetDraft } from "@/lib/hooks/useFilterSheetDraft";
import {
  FUEL_GROUPS,
  type FuelGroup,
  groupsFromEngine,
  isGroupedEngineValue,
  toEngineValues,
} from "@/lib/search/fuel-groups";
import { chosenGearbox, OFFERED_GEARBOXES, type OfferedGearbox } from "@/lib/search/panel";
import { type SearchInput, TIME_FILTERS } from "@/lib/search/schema";

// docs/specs/redesign-map.md (MAPUI-16, MAPUI-17, MAPUI-19,
// MAPUI-21, MAPUI-22, MAPUI-72 to MAPUI-74); docs/design/system/components/
// FilterSheet/README.md. The panel both the desktop dropdown and the phone
// full-screen sheet are built from — the same seven sections in the same
// order (Precio, Combustible, Cambio, Kilómetros, Año, Publicado, Marca y
// modelo); only the header, the frame and how it closes change.
//
// - `desktop`: the dropdown's content (FilterRow frames it under «Filtros»).
//   Every choice applies at once through `onChange`, «Borrar» is `onClear`
//   and «Ver coches» only closes (MAPUI-19).
// - `phone`: a full-screen dialog. Choices stay in the sheet until «Ver
//   coches», which hands them over as one `onChange` and then `onApply`;
//   closing discards them (`onDiscard`), and «Borrar» only empties the sheet
//   (MAPUI-21, MAPUI-22).
interface FilterPanelBase {
  input: SearchInput;
  onChange: (patch: Partial<SearchInput>) => void;
  onClear: () => void;
}

interface DesktopFilterPanelProps extends FilterPanelBase {
  mode: "desktop";
  /** MAPUI-19: «Ver coches» only closes the dropdown. */
  onCloseDesktop: () => void;
}

interface PhoneFilterPanelProps extends FilterPanelBase {
  mode: "phone";
  open: boolean;
  /** MAPUI-21: applies the buffered changes and closes. */
  onApply: () => void;
  /** MAPUI-21: discards the buffered changes and closes. */
  onDiscard: () => void;
  /** «Filtros», which opened the dialog, focused again when it closes. */
  returnFocusRef?: RefObject<HTMLElement | null>;
}

export type FilterPanelProps = DesktopFilterPanelProps | PhoneFilterPanelProps;

export function FilterPanel(props: FilterPanelProps) {
  if (props.mode === "phone") return <PhoneFilterPanel {...props} />;
  return <DesktopFilterPanel {...props} />;
}

function DesktopFilterPanel({ input, onChange, onClear, onCloseDesktop }: DesktopFilterPanelProps) {
  const t = useTranslations();

  return (
    <>
      <div className="flex h-17.5 shrink-0 items-center justify-between border-b border-line-soft px-5">
        <h2 className="m-0 font-display text-base font-extrabold uppercase">
          {t("search.filtersTitle")}
        </h2>
        <ClearButton onClick={onClear} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <PanelBody value={input} onChange={onChange} />
      </div>
      <ShowCarsFooter onShowCars={onCloseDesktop} />
    </>
  );
}

function PhoneFilterPanel({ open, returnFocusRef, ...props }: PhoneFilterPanelProps) {
  return (
    <PhoneBottomSheet
      open={open}
      onClose={props.onDiscard}
      returnFocusRef={returnFocusRef}
      entrance="fade"
      fullScreen
      onEscapeKeyDown={closeListboxFirst}
    >
      <PhoneFilterSheet {...props} />
    </PhoneBottomSheet>
  );
}

type PhoneFilterSheetProps = Omit<PhoneFilterPanelProps, "open" | "returnFocusRef">;

/** The phone sheet's content, mounted on each opening so the draft starts from the search. */
function PhoneFilterSheet({ input, onChange, onApply, onDiscard }: PhoneFilterSheetProps) {
  const t = useTranslations();
  const sheet = useFilterSheetDraft(input);

  function showCars() {
    onChange(sheet.criteria());
    onApply();
  }

  return (
    <>
      <SheetHeader
        title={t("search.filtersTitle")}
        closeLabel={t("search.closeFilters")}
        onClose={onDiscard}
        onClear={sheet.clear}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <PanelBody value={sheet.draft} onChange={sheet.edit} liveCriteria />
      </div>
      <ShowCarsFooter onShowCars={showCars} />
    </>
  );
}

interface PanelBodyProps {
  value: SearchInput;
  onChange: (patch: Partial<SearchInput>) => void;
  /** MAPUI-21: the phone sheet applies «Kilómetros»'s «Mínimo» and «Máximo»
   * and «Año»'s «Desde» as typed, like the price boxes, so «Ver coches» has
   * them even unblurred. */
  liveCriteria?: boolean;
}

/** The seven sections, identical on desktop and phone (FilterSheet README › Cuerpo). */
function PanelBody({ value, onChange, liveCriteria = false }: PanelBodyProps) {
  const t = useTranslations();

  return (
    <div className="flex flex-col gap-6.5 px-5 py-5.5">
      <PanelSection level={3} title={t("filters.price")}>
        <PriceRange
          minPrice={value.minPrice}
          maxPrice={value.maxPrice}
          onApply={(minPrice, maxPrice) => onChange({ minPrice, maxPrice })}
        />
      </PanelSection>
      <PanelSection level={3} title={t("filters.fuelType")}>
        <FuelChoice engine={value.engine ?? []} onChange={(engine) => onChange({ engine })} />
      </PanelSection>
      <PanelSection level={3} title={t("filters.transmission")}>
        <GearboxChoice gearbox={value.gearbox} onChange={(gearbox) => onChange({ gearbox })} />
      </PanelSection>
      <PanelSection level={3} title={t("filters.km")}>
        <MileageRange
          minKm={value.minKm}
          maxKm={value.maxKm}
          onChange={onChange}
          live={liveCriteria}
        />
      </PanelSection>
      <PanelSection level={3} title={t("filters.year")}>
        <div className="grid grid-cols-2 gap-2.5">
          <CriterionBox
            name="minYear"
            label={t("filters.yearFrom")}
            placeholder={t("filters.minYearPlaceholder")}
            value={value.minYear}
            onCommit={(minYear) => onChange({ minYear })}
            live={liveCriteria}
          />
        </div>
      </PanelSection>
      <PanelSection level={3} title={t("filters.listed")}>
        <ListedChoice
          timeFilter={value.timeFilter}
          onChange={(timeFilter) => onChange({ timeFilter })}
        />
      </PanelSection>
      <PanelSection level={3} title={t("filters.brandAndModel")}>
        <CarTypeahead
          brand={value.brand ?? ""}
          model={value.model ?? ""}
          onSelectBrand={(brand) => onChange({ brand, model: undefined })}
          onSelectModel={(model) => onChange({ model })}
          onClear={() => onChange({ brand: undefined, model: undefined })}
        />
      </PanelSection>
    </div>
  );
}

interface FuelChoiceProps {
  engine: string[];
  onChange: (engine: string[] | undefined) => void;
}

function FuelChoice({ engine, onChange }: FuelChoiceProps) {
  const t = useTranslations();
  const chosen = groupsFromEngine(engine);

  function toggle(group: FuelGroup) {
    const groups = chosen.includes(group)
      ? chosen.filter((current) => current !== group)
      : [...chosen, group];
    const next = [
      ...toEngineValues(groups),
      ...engine.filter((value) => !isGroupedEngineValue(value)),
    ];
    onChange(next.length > 0 ? next : undefined);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {FUEL_GROUPS.map(({ group }) => (
        <ToggleChip
          key={group}
          label={t(`filters.fuelGroups.${group}`)}
          active={chosen.includes(group)}
          onClick={() => toggle(group)}
        />
      ))}
    </div>
  );
}

/** «Todos» unless exactly one of manual and automatic is set (MAPUI-16). */
type GearboxValue = "all" | OfferedGearbox;

interface GearboxChoiceProps {
  gearbox: string[] | undefined;
  onChange: (gearbox: string[] | undefined) => void;
}

function GearboxChoice({ gearbox, onChange }: GearboxChoiceProps) {
  const t = useTranslations();
  const value = chosenGearbox(gearbox) ?? "all";
  return (
    <RadioChips<GearboxValue>
      label={t("filters.transmission")}
      variant="segmented"
      value={value}
      onChange={(next) => onChange(next === "all" ? undefined : [next])}
      options={[
        { value: "all", label: t("filters.gearboxAll") },
        ...OFFERED_GEARBOXES.map((offered) => ({
          value: offered,
          label: t(`filters.transmissions.${offered}`),
        })),
      ]}
    />
  );
}

type TimeFilter = (typeof TIME_FILTERS)[number];

interface ListedChoiceProps {
  timeFilter: TimeFilter | undefined;
  onChange: (timeFilter: TimeFilter | undefined) => void;
}

/** «Publicado»: one pressed chip at a time (`aria-pressed`, MAPUI-17). */
function ListedChoice({ timeFilter, onChange }: ListedChoiceProps) {
  const t = useTranslations();

  return (
    <div className="flex flex-wrap gap-2">
      <ToggleChip
        label={t("filters.listedChoices.any")}
        active={timeFilter === undefined}
        onClick={() => onChange(undefined)}
      />
      {TIME_FILTERS.map((choice) => (
        <ToggleChip
          key={choice}
          label={t(`filters.listedChoices.${choice}`)}
          active={timeFilter === choice}
          onClick={() => onChange(choice)}
        />
      ))}
    </div>
  );
}

interface CriterionBoxProps {
  name: string;
  label: string;
  placeholder: string;
  value: number | undefined;
  onCommit: (value: number | undefined) => void;
  /** MAPUI-21: in the phone sheet, every edit goes straight to `onCommit` as
   * typed — like the price boxes — so «Ver coches» has it even unblurred. */
  live?: boolean;
}

/**
 * «Año»'s «Desde» (MAPUI-72): on desktop, a box applied when it loses focus
 * or on Enter — an emptied box clears the criterion; an amount NumberBox
 * cannot read («abc», «-5», «1.2.3x») never reaches here at all, so the box
 * keeps showing the criterion in force (lib/hooks/useCriterionDraft.ts). In
 * the phone sheet (`live`), every edit applies at once instead, the way the
 * price boxes already do (lib/hooks/usePriceDraft.ts), since the sheet's own
 * draft — not this box — is what «Ver coches» later hands over. Split into
 * two components, rather than branching on `live` inside one, so the live
 * path never calls `useCriterionDraft` for a result it would throw away.
 */
function CriterionBox(props: CriterionBoxProps) {
  if (props.live) return <LiveCriterionBox {...props} />;
  return <DraftCriterionBox {...props} />;
}

function LiveCriterionBox({ name, label, placeholder, value, onCommit }: CriterionBoxProps) {
  return (
    <NumberBox
      name={name}
      label={label}
      placeholder={placeholder}
      value={value}
      onValueChange={onCommit}
      onCommit={() => {
        // Already applied on every edit above; blur and Enter have nothing left to commit.
      }}
    />
  );
}

function DraftCriterionBox({ name, label, placeholder, value, onCommit }: CriterionBoxProps) {
  const { draft, setDraft, commit } = useCriterionDraft(value, onCommit);

  return (
    <NumberBox
      name={name}
      label={label}
      placeholder={placeholder}
      value={draft}
      onValueChange={setDraft}
      onCommit={commit}
    />
  );
}
