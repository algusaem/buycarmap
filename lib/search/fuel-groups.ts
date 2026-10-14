import { fold } from "@/lib/search/fold";

// docs/specs/redesign-map.md (MAPUI-15). The filters panel's "Combustible"
// section shows five choices; the shared `engine` filter (lib/search/schema.ts)
// carries seven values, because `hybride` and `hybride_plugin` fold into one
// "Híbrido" choice and `cng` has no UI choice at all (MAPUI-18). This module
// is the one place that knows the mapping between the two.

export type FuelGroup = "gasoline" | "gasoil" | "hybrid" | "electric" | "lpg";

export interface FuelGroupDefinition {
  group: FuelGroup;
  /** The `engine` filter values this group reads as chosen (MAPUI-15's "«Híbrido» reads as chosen when either hybrid value is present"). */
  values: string[];
  /**
   * The listing `fuel` words this group recognises (MAPUI-35, MAPUI-55),
   * folded. Each source sends its own display word: Wallapop in English
   * («Diesel», «Hybrid Plug-in»), coches.net and Milanuncios in Spanish
   * («Diésel», «Híbrido enchufable», «híbrido»), as recorded in
   * docs/specs/data-sources.md › Contracts. The filter codes (the `values`)
   * are listed too. CNG («CNG», «Gas natural (CNG)») is in no group, so a
   * card shows no fuel for it.
   */
  fuelWords: string[];
}

/** In the order the panel and the chips show them. */
export const FUEL_GROUPS: FuelGroupDefinition[] = [
  { group: "gasoline", values: ["gasoline"], fuelWords: ["gasoline", "gasolina"] },
  { group: "gasoil", values: ["gasoil"], fuelWords: ["gasoil", "diesel"] },
  {
    group: "hybrid",
    values: ["hybride", "hybride_plugin"],
    fuelWords: [
      "hybride",
      "hybride_plugin",
      "hybrid",
      "hybrid plug-in",
      "hibrido",
      "hibrido enchufable",
    ],
  },
  {
    group: "electric",
    values: ["electric-hybrid"],
    fuelWords: ["electric", "electric-hybrid", "electrico"],
  },
  { group: "lpg", values: ["lpg"], fuelWords: ["lpg", "glp", "gas licuado (glp)"] },
];

/** The `engine` filter values to apply for the given set of chosen groups. */
export function toEngineValues(groups: FuelGroup[]): string[] {
  return FUEL_GROUPS.filter(({ group }) => groups.includes(group)).flatMap(({ values }) => values);
}

/** Which groups read as chosen for the given `engine` filter values. */
export function groupsFromEngine(values: string[]): FuelGroup[] {
  return FUEL_GROUPS.filter((definition) =>
    definition.values.some((value) => values.includes(value)),
  ).map(({ group }) => group);
}

/** Whether an `engine` filter value belongs to one of the five fuel groups (`cng` does not, MAPUI-18). */
export function isGroupedEngineValue(value: string): boolean {
  return FUEL_GROUPS.some((definition) => definition.values.includes(value));
}

/**
 * Which fuel group a listing's raw upstream `fuel` string belongs to — the
 * display word a source sends, or a filter code, matched ignoring case and
 * accents — or `undefined` when it matches none of
 * them. An unrecognised fuel is never shown raw: the card leaves it off its
 * meta line (MAPUI-35), and a fuel criterion drops the listing (MAPUI-55).
 */
export function classifyFuel(rawFuel: string): FuelGroup | undefined {
  const word = fold(rawFuel.trim());
  return FUEL_GROUPS.find(({ fuelWords }) => fuelWords.includes(word))?.group;
}
