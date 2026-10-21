import type { LocaleCopy } from "@/lib/i18n/copy";
import { carLabel, criteriaChips, placeLabel, priceLabel } from "@/lib/search/filter-chips";
import { hasPlace, type SearchInput } from "@/lib/search/schema";

// docs/specs/redesign-map.md (MAPUI-40, worked examples under "Alert name and
// summary"). `placeName` is passed in rather than resolved here — this
// module has no access to Nominatim's reverse lookup, and the dialog already
// holds the chosen place's display name from the search it is saving.
//
// Lives in lib/search/, not lib/alerts/: scripts/core-layout.node.test.ts's
// LAYOUT-5 asserts `lib/alerts` does not exist (an old location now
// superseded by server/alerts/), and this is a presentation-text pure helper
// over a SearchInput, not alert business logic — a neighbour of
// filter-chips.ts and car-typeahead.ts, not of server/alerts/service.ts.
//
// Deliberately never includes `timeFilter`: "An alert already looks only for
// cars new since it last ran" (Decisions and rationale). The text comes from
// the messages in the locale of `copy`.

const SEPARATOR = " · ";

/**
 * The prefilled name: the car and the place, or the price when neither is
 * set, or nothing («Toyota Corolla · Madrid», «Madrid», «Hasta 15.000 €»).
 */
export function alertName(
  input: SearchInput,
  placeName: string | undefined,
  copy: LocaleCopy,
): string {
  const parts = [carLabel(input, copy), placeName].filter((part) => part);
  if (parts.length > 0) return parts.join(SEPARATOR);
  return priceLabel(input, copy) ?? "";
}

/**
 * The car («Cualquier marca»), the price («Cualquier precio»), then the
 * fuels, the gearbox, the mileage, the year and the place with its radius,
 * each only when set. A place with no name — the browser's position — ends
 * with the radius alone, as the alert's card reads once saved (MAP-36).
 */
export function alertSummary(
  input: SearchInput,
  placeName: string | undefined,
  copy: LocaleCopy,
): string {
  const place = placeName
    ? placeLabel(placeName, input.distanceInKm, copy)
    : alertZone(input, null, copy);

  return [
    carLabel(input, copy) ?? copy.t("search.anyBrand"),
    priceLabel(input, copy) ?? copy.t("search.anyPrice"),
    ...criteriaChips(input, copy).map((chip) => chip.label),
    ...(place ? [place] : []),
  ].join(SEPARATOR);
}

/**
 * docs/specs/redesign-alerts.md (ALERTUI-5, ALERTUI-15, ALERTUI-22): the zone
 * alone, «Madrid · 50 km» with a place name, «50 km» with a place but no
 * name, and undefined when the alert has no place.
 */
export function alertZone(
  input: SearchInput,
  placeName: string | null,
  copy: LocaleCopy,
): string | undefined {
  if (!hasPlace(input)) return undefined;
  if (placeName) return placeLabel(placeName, input.distanceInKm, copy);
  if (input.distanceInKm == null) return undefined;
  return copy.t("search.radiusOption", { km: input.distanceInKm });
}

/**
 * docs/specs/redesign-alerts.md (ALERTUI-5; amends MAPUI-40): an alert's
 * criteria as the AlertCard writes them, each only when set — the car, the
 * fuel groups, the price, the gearbox, the mileage, the year, then the zone
 * («Madrid · 50 km», or «50 km» with a place but no place name). Never
 * «Publicado», the `?q=` text, «Cualquier marca» or «Cualquier precio».
 */
export function alertCriteria(
  input: SearchInput,
  placeName: string | null,
  copy: LocaleCopy,
): string[] {
  const chips = criteriaChips(input, copy);
  const isFuel = (key: string) => key.startsWith("engine:");
  return [
    carLabel(input, copy),
    ...chips.filter((chip) => isFuel(chip.key)).map((chip) => chip.label),
    priceLabel(input, copy),
    ...chips.filter((chip) => !isFuel(chip.key)).map((chip) => chip.label),
    alertZone(input, placeName, copy),
  ].filter((part): part is string => part !== undefined);
}
