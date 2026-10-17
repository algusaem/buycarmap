"use client";

import { useId } from "react";
import { AnimatePresence, useIsPresent } from "motion/react";
import * as motion from "motion/react-client";
import { useTranslations } from "next-intl";
import { RemovableChip } from "@/components/map/filters/RemovableChip";
import { BRANDS } from "@/components/map/search-filter-options";
import { crossFade } from "@/lib/animations";
import { type CarChoice, useCarTypeahead } from "@/lib/hooks/useCarTypeahead";
import type { Translate } from "@/lib/i18n/types";
import { cn } from "@/lib/utils";
import {
  AnimatedListbox,
  ComboOption,
  ListStatus,
  NoMatch,
  SearchField,
  SectionLabel,
} from "./Combobox";

// docs/specs/redesign-map.md (MAPUI-6 to MAPUI-10, MAPUI-56, Contracts › Brand
// list): the «Coche» type-ahead, in its popover, the «BUSCAR» sheet and the
// filters panel's «Marca y modelo». Its state and choices are
// lib/hooks/useCarTypeahead.ts; this draws them: the chosen brand's chip, the
// field, the «Marcas» and «Modelos» groups (the brand step lists its models
// alone), the no-match line and the polite status.

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
      <AnimatePresence initial={false}>
        {brandStep && (
          <RemovableChip
            key={chosenBrand}
            label={chosenBrand}
            onRemove={typeahead.clearBrand}
            className="self-start"
          />
        )}
      </AnimatePresence>
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
      <AnimatePresence initial={false}>
        {listed && (
          <CarListbox
            key="cars"
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
        {noMatch && <NoMatch key="no-brand">{t("search.noBrand")}</NoMatch>}
      </AnimatePresence>
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
  /** False while the listbox fades out: the options render inert (ComboOption). */
  interactive: boolean;
  optionId: (index: number) => string;
  onHighlight: (index: number) => void;
  onChoose: (choice: CarChoice) => void;
}

interface CarListboxProps
  extends Omit<ChoiceOptionsProps, "choices" | "offset" | "withBrand" | "interactive"> {
  id: string;
  /** «Marcas» and «Modelos» while typing; the brand step lists its models alone. */
  grouped: boolean;
  brandChoices: CarChoice[];
  modelChoices: CarChoice[];
}

function CarListbox({ id, grouped, brandChoices, modelChoices, ...rest }: CarListboxProps) {
  const t = useTranslations();
  const isPresent = useIsPresent();
  const shared = { ...rest, interactive: isPresent };

  return (
    <AnimatedListbox id={id} label={listboxLabel(t, grouped)} className="gap-3">
      {grouped && (
        <AnimatePresence initial={false}>
          {brandChoices.length > 0 && (
            <ChoiceGroup
              key="brands"
              label={t("search.brands")}
              choices={brandChoices}
              offset={0}
              withBrand={false}
              {...shared}
            />
          )}
          {modelChoices.length > 0 && (
            <ChoiceGroup
              key="models"
              label={t("search.models")}
              choices={modelChoices}
              offset={brandChoices.length}
              withBrand
              {...shared}
            />
          )}
        </AnimatePresence>
      )}
      {!grouped && (
        <ChoiceOptions choices={modelChoices} offset={0} withBrand={false} {...shared} />
      )}
    </AnimatedListbox>
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
  interactive,
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
          interactive={interactive}
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

/**
 * «Marcas» or «Modelos»: a titled group of options, fading in and out inside
 * the listbox's AnimatePresence. A group fading out is inert like a fading
 * listbox, so its options neither count as options nor choose.
 */
function ChoiceGroup({ label, interactive, ...options }: ChoiceGroupProps) {
  const labelId = useId();
  const isPresent = useIsPresent();

  return (
    <motion.fieldset
      aria-labelledby={labelId}
      aria-hidden={isPresent ? undefined : "true"}
      inert={isPresent ? undefined : true}
      className={cn(
        "m-0 flex min-w-0 flex-col gap-1 border-0 p-0",
        !isPresent && "pointer-events-none",
      )}
      {...crossFade}
    >
      <span className="px-3.5">
        <SectionLabel id={labelId}>{label}</SectionLabel>
      </span>
      <ChoiceOptions {...options} interactive={interactive && isPresent} />
    </motion.fieldset>
  );
}
