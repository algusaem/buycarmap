import { useRef, useState } from "react";
import { useModelNames } from "@/lib/hooks/useCarModels";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { useOptionNavigation } from "@/lib/hooks/useOptionNavigation";
import { matchNames } from "@/lib/search/car-typeahead";

// docs/specs/redesign-map.md (MAPUI-6 to MAPUI-10, MAPUI-56, Contracts › Brand
// list): the state of the «Coche» type-ahead (components/map/search/
// CarTypeahead.tsx), in its popover, the «BUSCAR» sheet and the filters
// panel's «Marca y modelo».
//
// - Typing matches the fixed brand list locally (lib/search/car-typeahead.ts)
//   under «Marcas». When one to three brands match, their models are listed
//   under «Modelos» as «Marca Modelo», one listCarModels call per brand
//   (lib/hooks/useCarModels.ts); more than three lists brands only. A failed
//   call lists no models and shows no error (MAPUI-10). Text no brand matches
//   lists nothing and says so (`noMatch`, MAPUI-56).
// - Choosing a brand applies it and moves to that brand's models: the brand
//   as a removable chip, the field «Modelo de <marca>…» (MAPUI-7).
// - Choosing a model applies it, with its brand when it came from the mixed
//   list (MAPUI-8). Models are stored by name and listed once each,
//   ignoring case.

/** At most this many brands have their models fetched for one query (MAPUI-6). */
const MAX_MODEL_BRANDS = 3;
const MODELS_DELAY_MS = 300;

/** The brands whose models a query lists: its matches, when there are three or fewer. */
function brandsWithModels(query: string, catalogue: readonly string[]): string[] {
  const matches = matchNames(query, catalogue);
  return matches.length <= MAX_MODEL_BRANDS ? matches : [];
}

/** One option: a brand (no `model`) or a model of `brand`. */
export interface CarChoice {
  key: string;
  /** The brand, or the model's name; a mixed-list model is labelled by the caller. */
  brand: string;
  model?: string;
  selected: boolean;
}

interface CarTypeaheadInput {
  /** The fixed brand list (components/map/search-filter-options.ts's BRANDS). */
  catalogue: readonly string[];
  brand: string;
  model: string;
  onSelectBrand: (brand: string) => void;
  onSelectModel: (model: string) => void;
  onClear: () => void;
}

export function useCarTypeahead({
  catalogue,
  brand,
  model,
  onSelectBrand,
  onSelectModel,
  onClear,
}: CarTypeaheadInput) {
  const [query, setQuery] = useState("");
  // The brand step follows a choice at once, before the parent re-renders
  // with it, and follows the parent when it changes the brand itself.
  const [chosenBrand, setChosenBrand] = useState(brand);
  const [syncedBrand, setSyncedBrand] = useState(brand);
  if (brand !== syncedBrand) {
    setSyncedBrand(brand);
    setChosenBrand(brand);
  }
  const inputRef = useRef<HTMLInputElement>(null);

  // Models are asked for once the typing pauses, so a query costs at most
  // MAX_MODEL_BRANDS requests rather than that many per keystroke.
  const settledQuery = useDebouncedValue(query, MODELS_DELAY_MS);

  const brandStep = chosenBrand !== "";
  const typed = query.trim() !== "";
  const brands = brandStep ? [] : matchNames(query, catalogue);
  const modelBrands = brandStep ? [chosenBrand] : brandsWithModels(settledQuery, catalogue);
  const modelNames = useModelNames(modelBrands);
  const namesOf = (index: number) => modelNames[index] ?? [];

  const brandChoices: CarChoice[] = brands.map((name) => ({
    key: `brand-${name}`,
    brand: name,
    selected: name === brand,
  }));
  const modelChoices = brandStep
    ? stepModelChoices({ chosenBrand, brand, model, loaded: namesOf(0), query })
    : mixedModelChoices({ modelBrands, brands, namesOf, brand, model });
  const choices = [...brandChoices, ...modelChoices];
  const listable = brandStep || typed ? choices.length : 0;
  /** Text that no brand matches (MAPUI-56). */
  const noMatch = !brandStep && typed && brands.length === 0;

  const navigation = useOptionNavigation(listable, (index) => {
    const choice = choices[index];
    if (choice) choose(choice);
  });

  /** Empties the field after a choice, keeping the focus in it. */
  function resetField() {
    setQuery("");
    navigation.reset();
    inputRef.current?.focus();
  }

  function pickBrand(name: string) {
    setChosenBrand(name);
    onSelectBrand(name);
    resetField();
  }

  /** A model of `ofBrand`: from the mixed list it applies its brand too (MAPUI-8). */
  function pickModel(ofBrand: string, name: string) {
    if (ofBrand !== chosenBrand) pickBrand(ofBrand);
    onSelectModel(name);
    resetField();
  }

  function choose(choice: CarChoice) {
    if (choice.model === undefined) pickBrand(choice.brand);
    else pickModel(choice.brand, choice.model);
  }

  function clearBrand() {
    setChosenBrand("");
    onClear();
    resetField();
  }

  function type(text: string) {
    setQuery(text);
    navigation.reset();
  }

  return {
    query,
    type,
    resetField,
    chosenBrand,
    brandStep,
    brandChoices,
    modelChoices,
    choices,
    noMatch,
    navigation,
    inputRef,
    choose,
    clearBrand,
  };
}

interface StepModels {
  chosenBrand: string;
  brand: string;
  model: string;
  loaded: string[];
  query: string;
}

/**
 * The brand step's list (MAPUI-7, MAPUI-8): that brand's models, matching the
 * typed text, with the chosen model listed and marked even before the models
 * load.
 */
function stepModelChoices({ chosenBrand, brand, model, loaded, query }: StepModels): CarChoice[] {
  const current = chosenBrand === brand ? model.toLocaleLowerCase() : "";
  const isCurrent = (name: string) => current !== "" && name.toLocaleLowerCase() === current;
  const names = current && !loaded.some(isCurrent) ? [model, ...loaded] : loaded;
  return matchModels(names, query).map((name) => ({
    key: `model-${name}`,
    brand: chosenBrand,
    model: name,
    selected: isCurrent(name),
  }));
}

interface MixedModels {
  modelBrands: string[];
  brands: string[];
  namesOf: (index: number) => string[];
  brand: string;
  model: string;
}

/** While typing (MAPUI-6): the models of the matching brands. */
function mixedModelChoices({
  modelBrands,
  brands,
  namesOf,
  brand,
  model,
}: MixedModels): CarChoice[] {
  return modelBrands.flatMap((modelBrand, index) =>
    // Only brands the text still matches, while the settled query catches up.
    (brands.includes(modelBrand) ? namesOf(index) : []).map((name) => ({
      key: `model-${modelBrand}-${name}`,
      brand: modelBrand,
      model: name,
      selected: modelBrand === brand && name === model,
    })),
  );
}

/** The brand's models that start with the typed text, or all of them. */
function matchModels(names: string[], query: string): string[] {
  if (query.trim() === "") return names;
  return matchNames(query, names);
}
