import { groupsFromEngine, toEngineValues } from "@/lib/search/fuel-groups";
import { chosenGearbox } from "@/lib/search/panel";
import type { SearchInput } from "@/lib/search/schema";

// docs/specs/redesign-map.md (MAPUI-58), worked example «Quick filters». The
// five quick filters under the map's search, each a toggle over the same
// criteria the filters panel edits:
// - «Gasolina» and «Diésel» add or remove their own fuel value, leaving the
//   other fuels as they are (MAPUI-15);
// - «Manual» and «Automático» are pressed when the gearbox is exactly that
//   one value (MAPUI-16); pressing one sets it, pressing the pressed one
//   clears the gearbox;
// - «Hasta 100.000 km» is pressed when the maximum mileage is exactly 100.000
//   km; pressing it sets it, pressing it again clears the maximum mileage.
// The patches use `undefined` to clear a criterion, as the panel's do.

export const QUICK_FILTERS = ["gasoline", "gasoil", "manual", "automatic", "maxKm100k"] as const;

export type QuickFilterKey = (typeof QUICK_FILTERS)[number];

/** The maximum mileage «Hasta 100.000 km» sets. */
export const QUICK_MAX_KM = 100000;

function assertNever(value: never): never {
  throw new Error(`Unhandled quick filter: ${String(value)}`);
}

/**
 * Pressed exactly as the filters panel reads it (MAPUI-16, MAPUI-18): the
 * fuel keys read `groupsFromEngine`, the same lookup the panel's chips use;
 * the gearbox keys read
 * `chosenGearbox`, which ignores a value the UI no longer offers, rather
 * than comparing `input.gearbox` directly — so an old link's
 * `gearbox=manual,semiautomatic` reads «Manual» pressed here too.
 */
export function isQuickFilterOn(input: SearchInput, key: QuickFilterKey): boolean {
  switch (key) {
    case "gasoline":
    case "gasoil":
      return groupsFromEngine(input.engine ?? []).includes(key);
    case "manual":
    case "automatic":
      return chosenGearbox(input.gearbox) === key;
    case "maxKm100k":
      return input.maxKm === QUICK_MAX_KM;
    default:
      return assertNever(key);
  }
}

/** The patch that presses or releases `key` on `input`. */
export function toggleQuickFilter(input: SearchInput, key: QuickFilterKey): Partial<SearchInput> {
  const on = isQuickFilterOn(input, key);
  switch (key) {
    case "gasoline":
    case "gasoil": {
      const engine = input.engine ?? [];
      const values = toEngineValues([key]);
      const next = on
        ? engine.filter((value) => !values.includes(value))
        : [...engine, ...values.filter((value) => !engine.includes(value))];
      return { engine: next.length > 0 ? next : undefined };
    }
    case "manual":
    case "automatic":
      return { gearbox: on ? undefined : [key] };
    case "maxKm100k":
      return { maxKm: on ? undefined : QUICK_MAX_KM };
    default:
      return assertNever(key);
  }
}
