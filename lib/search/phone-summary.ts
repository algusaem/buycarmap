import type { ShownPlace } from "@/interfaces/location";
import type { LocaleCopy } from "@/lib/i18n/copy";
import { carLabel, placeLabel, priceLabel, textLabel } from "@/lib/search/filter-chips";
import type { SearchInput } from "@/lib/search/schema";

export interface PhoneSummary {
  /** «Madrid · 50 km», «Tu ubicación · 50 km» around the browser's position, or «Toda España» with no place chosen. */
  placeSummary: string;
  /** «Cualquier marca · hasta 20.000 €»: the car, then the price. */
  carPriceSummary: string;
}

/**
 * The phone search summary (docs/specs/redesign-map.md MAPUI-20): the place
 * and its radius, over the car and the price. docs/specs/map-description-
 * search.md (DESC-18): the description text, when applied, shows in «…»
 * between the car and the price.
 */
export function phoneSummary(
  input: SearchInput,
  place: ShownPlace | null,
  radiusKm: number,
  copy: LocaleCopy,
): PhoneSummary {
  const { t } = copy;
  const price = priceLabel(input, copy, "summary") ?? t("search.anyPrice");
  const text = textLabel(input);
  const car = carLabel(input, copy) ?? t("search.anyBrand");

  return {
    placeSummary: placeLabel(place?.displayName, radiusKm, copy) ?? t("search.allSpain"),
    carPriceSummary: [car, ...(text ? [text] : []), price].join(" · "),
  };
}
