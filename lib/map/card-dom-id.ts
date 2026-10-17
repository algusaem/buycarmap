/** The DOM id of a listing's card in the map's list, so a pin can scroll it into view (docs/specs/redesign-map.md MAPUI-27). */
export function cardDomId(listingId: string): string {
  return `car-${listingId}`;
}
