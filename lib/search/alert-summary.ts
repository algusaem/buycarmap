import type { LocaleCopy } from "@/lib/i18n/copy";
import { carLabel, criteriaChips, placeLabel, priceLabel } from "@/lib/search/filter-chips";
import type { SearchInput } from "@/lib/search/schema";

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
 * each only when set.
 */
export function alertSummary(
  input: SearchInput,
  placeName: string | undefined,
  copy: LocaleCopy,
): string {
  const place = placeLabel(placeName, input.distanceInKm, copy);

  return [
    carLabel(input, copy) ?? copy.t("search.anyBrand"),
    priceLabel(input, copy) ?? copy.t("search.anyPrice"),
    ...criteriaChips(input, copy).map((chip) => chip.label),
    ...(place ? [place] : []),
  ].join(SEPARATOR);
}
