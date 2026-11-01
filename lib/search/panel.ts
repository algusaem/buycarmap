import type { SearchInput } from "@/lib/search/schema";

// docs/specs/redesign-map.md (MAPUI-14, MAPUI-16, MAPUI-18, MAPUI-19). What
// the filters panel offers and what its «Borrar» clears, shared by the panel
// (components/map/filters/FilterPanel.tsx), the chips
// (lib/search/filter-chips.ts) and the search hook
// (lib/hooks/useSearchFilters.ts), so they cannot drift apart.

/** The two gearboxes «Cambio» offers; there are only two kinds (MAPUI-16). */
export const OFFERED_GEARBOXES = ["manual", "automatic"] as const;

export type OfferedGearbox = (typeof OFFERED_GEARBOXES)[number];

function isOfferedGearbox(value: string): value is OfferedGearbox {
  return OFFERED_GEARBOXES.some((offered) => offered === value);
}

/**
 * The gearbox «Cambio» shows as chosen (MAPUI-16): one of `manual` and
 * `automatic` set on its own. Anything else — none, both, or only a value
 * the UI no longer offers (MAPUI-18) — reads «Todos», `undefined` here.
 */
export function chosenGearbox(gearbox: readonly string[] | undefined): OfferedGearbox | undefined {
  const offered = (gearbox ?? []).filter(isOfferedGearbox);
  return offered.length === 1 ? offered[0] : undefined;
}

/**
 * Every `SearchInput` criterion the panel's «Borrar» clears (MAPUI-19): the
 * panel's own sections and the criteria the UI no longer offers (MAPUI-18).
 * Not the place and its radius, which belong to «Dónde», nor the
 * description text (docs/specs/map-description-search.md, DESC-1), which its
 * callers clear on their own, the same way they apply it.
 */
export const PANEL_KEYS = [
  "minPrice",
  "maxPrice",
  "engine",
  "gearbox",
  "maxKm",
  "minYear",
  "timeFilter",
  "brand",
  "model",
  "minKm",
  "maxYear",
  "minHorsePower",
  "maxHorsePower",
] as const satisfies readonly (keyof SearchInput)[];

type PanelKey = (typeof PANEL_KEYS)[number];

function copyKey<K extends PanelKey>(target: Partial<SearchInput>, input: SearchInput, key: K) {
  target[key] = input[key];
}

/**
 * The panel's criteria of `input`, every key of PANEL_KEYS present: what a
 * phone «Ver coches» hands over, and — from an empty input — the patch that
 * clears them all.
 */
export function panelCriteria(input: SearchInput): Partial<SearchInput> {
  const criteria: Partial<SearchInput> = {};
  for (const key of PANEL_KEYS) copyKey(criteria, input, key);
  return criteria;
}

/**
 * Whether any of the panel's criteria is set (MAPUI-31): the empty state
 * offers «Quitar filtros» only then. The place and its radius are not
 * filters, and the `?q=` text is its callers' to add.
 */
export function hasPanelCriteria(input: SearchInput): boolean {
  return PANEL_KEYS.some((key) => input[key] !== undefined);
}
