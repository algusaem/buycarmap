"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { RemovableChip } from "@/components/map/filters/RemovableChip";
import { BRANDS } from "@/components/map/search-filter-options";
import { type CarChoice, useCarTypeahead } from "@/lib/hooks/useCarTypeahead";
import type { Translate } from "@/lib/i18n/types";
import { ComboOption, Listbox, ListStatus, NoMatch, SearchField, SectionLabel } from "./Combobox";

// docs/specs/redesign-map.md (MAPUI-6 to MAPUI-10, MAPUI-56, Contracts › Brand
// list): the «Coche» type-ahead, in its popover, the «BUSCAR» sheet and the
// filters panel's «Marca y modelo». Its state and choices are
// lib/hooks/useCarTypeahead.ts; this draws them: the chosen brand's chip, the
// field, the «Marcas» and «Modelos» groups (the brand step lists its models
// alone), the no-match line and the polite status. The list, its groups, the
// no-match line and the brand chip appear and leave at once (MOTION-13,
// MOTION-18).

export interface CarTypeaheadProps {
  brand: string;
  model: string;
  onSelectBrand: (brand: string) => void;
  onSelectModel: (model: string) => void;
  onClear: () => void;
}

export function CarTypeahead(props: CarTypeaheadProps) {
  const t = useTranslations();
  const typeahead = useCarTypeahead({ catalogue: BRANDS, ...props });
  const { chosenBrand, brandStep, navigation, noMatch } = typeahead;
  const { highlighted, open: listed, listboxId } = navigation;

  let statusText = "";
  if (noMatch) statusText = t("search.noBrand");
  else if (listed) statusText = t("search.results", { count: typeahead.choices.length });

  return (
    <div ref={navigation.containerRef} className="flex flex-col gap-3">
      {brandStep && (
        <RemovableChip label={chosenBrand} onRemove={typeahead.clearBrand} className="self-start" />
      )}
      <SearchField
        ref={typeahead.inputRef}
        name="car"
        aria-label={fieldLabel(t, chosenBrand)}
        placeholder={fieldPlaceholder(t, chosenBrand)}
        expanded={listed}
        aria-controls={listed ? listboxId : undefined}
        aria-activedescendant={navigation.activeDescendant}
        value={typeahead.query}
        onValueChange={typeahead.type}
        onClearText={typeahead.resetField}
        onKeyDown={navigation.onKeyDown}
      />
      {listed && (
        <CarListbox
          id={listboxId}
          grouped={!brandStep}
          brandChoices={typeahead.brandChoices}
          modelChoices={typeahead.modelChoices}
          highlighted={highlighted}
          optionId={navigation.optionId}
          onHighlight={navigation.setHighlighted}
          onChoose={typeahead.choose}
        />
      )}
      {noMatch && <NoMatch>{t("search.noBrand")}</NoMatch>}
      <ListStatus>{statusText}</ListStatus>
    </div>
  );
}

function fieldLabel(t: Translate, chosenBrand: string): string {
  return chosenBrand ? t("search.modelOfLabel", { brand: chosenBrand }) : t("search.carLabel");
}

function fieldPlaceholder(t: Translate, chosenBrand: string): string {
  return chosenBrand ? t("search.modelOf", { brand: chosenBrand }) : t("search.carPlaceholder");
}

interface ChoiceOptionsProps {
  choices: CarChoice[];
  offset: number;
  /** «Marca Modelo» for the models of the mixed list; the brand step names its models alone. */
  withBrand: boolean;
  highlighted: number;
  optionId: (index: number) => string;
  onHighlight: (index: number) => void;
  onChoose: (choice: CarChoice) => void;
}

interface CarListboxProps extends Omit<ChoiceOptionsProps, "choices" | "offset" | "withBrand"> {
  id: string;
  /** «Marcas» and «Modelos» while typing; the brand step lists its models alone. */
  grouped: boolean;
  brandChoices: CarChoice[];
  modelChoices: CarChoice[];
}

function CarListbox({ id, grouped, brandChoices, modelChoices, ...rest }: CarListboxProps) {
  const t = useTranslations();

  return (
    <Listbox id={id} label={listboxLabel(t, grouped)} className="gap-3">
      {grouped && brandChoices.length > 0 && (
        <ChoiceGroup
          label={t("search.brands")}
          choices={brandChoices}
          offset={0}
          withBrand={false}
          {...rest}
        />
      )}
      {grouped && modelChoices.length > 0 && (
        <ChoiceGroup
          label={t("search.models")}
          choices={modelChoices}
          offset={brandChoices.length}
          withBrand
          {...rest}
        />
      )}
      {!grouped && <ChoiceOptions choices={modelChoices} offset={0} withBrand={false} {...rest} />}
    </Listbox>
  );
}

function listboxLabel(t: Translate, grouped: boolean): string {
  return grouped ? t("search.carOptions") : t("search.models");
}

function ChoiceOptions({
  choices,
  offset,
  withBrand,
  highlighted,
  optionId,
  onHighlight,
  onChoose,
}: ChoiceOptionsProps) {
  const t = useTranslations();

  return (
    <div className="flex flex-col gap-0.5">
      {choices.map((choice, index) => (
        <ComboOption
          key={choice.key}
          id={optionId(offset + index)}
          label={choiceLabel(t, choice, withBrand)}
          selected={choice.selected}
          highlighted={highlighted === offset + index}
          onChoose={() => onChoose(choice)}
          onHighlight={() => onHighlight(offset + index)}
        />
      ))}
    </div>
  );
}

/** A brand by its name; a model by its name, or as «Marca Modelo» in the mixed list (MAPUI-6). */
function choiceLabel(t: Translate, choice: CarChoice, withBrand: boolean): string {
  if (choice.model === undefined) return choice.brand;
  if (!withBrand) return choice.model;
  return t("search.brandModel", { brand: choice.brand, model: choice.model });
}

interface ChoiceGroupProps extends ChoiceOptionsProps {
  label: string;
}

/** «Marcas» or «Modelos»: a titled group of options, shown and removed at once (MOTION-13). */
function ChoiceGroup({ label, ...options }: ChoiceGroupProps) {
  const labelId = useId();

  return (
    <fieldset aria-labelledby={labelId} className="m-0 flex min-w-0 flex-col gap-1 border-0 p-0">
      <span className="px-3.5">
        <SectionLabel id={labelId}>{label}</SectionLabel>
      </span>
      <ChoiceOptions {...options} />
    </fieldset>
  );
}
