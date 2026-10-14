// docs/specs/redesign-map.md (MAPUI-6, MAPUI-35): the one way text typed or
// sent by a source is compared — case and accents ignored — shared by the
// «Coche» type-ahead (lib/search/car-typeahead.ts) and the fuel groups
// (lib/search/fuel-groups.ts).

/** Lower case with the accents taken off: «Citroën» → «citroen», «Diésel» → «diesel». */
export function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}
