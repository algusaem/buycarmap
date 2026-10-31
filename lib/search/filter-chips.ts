import { formatMileage, formatPrice } from "@/lib/format";
import type { LocaleCopy } from "@/lib/i18n/copy";
import { type FuelGroup, groupsFromEngine } from "@/lib/search/fuel-groups";
import { chosenGearbox } from "@/lib/search/panel";
import type { SearchInput } from "@/lib/search/schema";

// docs/specs/redesign-map.md (MAPUI-13, MAPUI-67). One chip text per active
// panel criterion, read off the shared `SearchInput`. «Filtros»'s badge, in
// the desktop header's second row and the phone band, is this array's length.
// The text comes from the messages (`filters.*`, `search.*`) in the locale of
// `copy`.
//
// Order: fuels, price, gearbox, mileage, year, recency, then the car — the
// worked example's «Diésel», «Hasta 20.000 €», «Automático», «Últimas 24 h».
// The key names the criterion: `engine:<group>`, `maxPrice`,
// `minPrice` or `price` (both), `gearbox`, `maxKm`, `minYear`, `timeFilter`
// and `brand` (the brand and the model). `maxKm` also names the mileage chip
// when only `minKm` is set, or both — one chip either way, never two
// (MAPUI-75): «Desde 50.000 km», «Hasta 100.000 km» or «50.000 – 100.000 km».
type FuelChipKey = `engine:${FuelGroup}`;

type ChipKey =
  | FuelChipKey
  | "price"
  | "minPrice"
  | "maxPrice"
  | "gearbox"
  | "maxKm"
  | "minYear"
  | "timeFilter"
  | "brand";

export interface FilterChip {
  key: ChipKey;
  label: string;
}

/**
 * The messages a lone minimum or maximum is written with: `label` for the
 * pill, the alert summary and «Filtros»'s badge count («Hasta 20.000 €»),
 * `summary` for the phone search summary's second line («hasta 20.000 €»,
 * MAPUI-20).
 */
const PRICE_WORDING = {
  label: { upTo: "search.priceUpTo", from: "search.priceFrom" },
  summary: { upTo: "search.summaryUpTo", from: "search.summaryFrom" },
} as const;

export type PriceWording = keyof typeof PRICE_WORDING;

/**
 * Shared by `priceLabel` and `mileageLabel`: a range reads as `both`, a lone
 * maximum as `upTo`, a lone minimum as `from`; undefined with neither end
 * set. Each producer takes the end(s) it names and returns the finished
 * text — a formatted amount, or that amount already wrapped in its message.
 */
function boundsLabel(
  min: number | undefined,
  max: number | undefined,
  {
    both,
    upTo,
    from,
  }: {
    both: (min: number, max: number) => string;
    upTo: (max: number) => string;
    from: (min: number) => string;
  },
): string | undefined {
  if (min != null && max != null) return both(min, max);
  if (max != null) return upTo(max);
  if (min != null) return from(min);
  return undefined;
}

/**
 * The price as the pill and the alert summary write it (MAPUI-1): «Hasta
 * 20.000 €», «Desde 3.000 €» or «3.000 – 20.000 €»; undefined with no price.
 */
export function priceLabel(
  input: Pick<SearchInput, "minPrice" | "maxPrice">,
  copy: LocaleCopy,
  wording: PriceWording = "label",
): string | undefined {
  const { t, locale } = copy;
  const { minPrice, maxPrice } = input;
  const keys = PRICE_WORDING[wording];

  return boundsLabel(minPrice, maxPrice, {
    both: (min, max) => formatPrice({ min, max }, locale),
    upTo: (max) => t(keys.upTo, { price: formatPrice(max, locale) }),
    from: (min) => t(keys.from, { price: formatPrice(min, locale) }),
  });
}

/**
 * The place with its radius, «Madrid · 50 km» (MAPUI-1, MAPUI-20, MAPUI-40),
 * or the place alone with no radius; undefined with no place.
 */
export function placeLabel(
  placeName: string | undefined,
  radiusKm: number | undefined,
  { t }: LocaleCopy,
): string | undefined {
  if (!placeName) return undefined;
  if (radiusKm == null) return placeName;
  return t("search.placeRadius", { place: placeName, km: radiusKm });
}

/** «Toyota» or «Toyota Corolla»; undefined with no brand. */
export function carLabel(
  input: Pick<SearchInput, "brand" | "model">,
  copy: LocaleCopy,
): string | undefined {
  if (!input.brand) return undefined;
  if (!input.model) return input.brand;
  return copy.t("search.brandModel", { brand: input.brand, model: input.model });
}

function fuelChips(input: SearchInput, { t }: LocaleCopy): FilterChip[] {
  return groupsFromEngine(input.engine ?? []).map((group) => ({
    key: `engine:${group}`,
    label: t(`filters.fuelGroups.${group}`),
  }));
}

/**
 * «Kilómetros»'s label (MAPUI-75), shaped like `priceLabel`: the range when
 * both ends are set, otherwise whichever end is — undefined with neither.
 */
function mileageLabel(
  input: Pick<SearchInput, "minKm" | "maxKm">,
  copy: LocaleCopy,
): string | undefined {
  const { t, locale } = copy;
  const { minKm, maxKm } = input;

  return boundsLabel(minKm, maxKm, {
    both: (min, max) => formatMileage({ min, max }, locale),
    upTo: (max) => t("filters.maxKmChip", { km: formatMileage(max, locale) }),
    from: (min) => t("filters.minKmChip", { km: formatMileage(min, locale) }),
  });
}

/** The gearbox, mileage and year chips, in that order. */
function specChips(input: SearchInput, copy: LocaleCopy): FilterChip[] {
  const gearbox = chosenGearbox(input.gearbox);
  const chips: FilterChip[] = [];

  if (gearbox) chips.push({ key: "gearbox", label: copy.t(`filters.transmissions.${gearbox}`) });
  const km = mileageLabel(input, copy);
  if (km) chips.push({ key: "maxKm", label: km });
  if (input.minYear != null) {
    chips.push({
      key: "minYear",
      label: copy.t("filters.minYearChip", { year: String(input.minYear) }),
    });
  }
  return chips;
}

/** The fuel, gearbox, mileage and year chips, in that order (the alert summary's middle). */
export function criteriaChips(input: SearchInput, copy: LocaleCopy): FilterChip[] {
  return [...fuelChips(input, copy), ...specChips(input, copy)];
}

function priceKey(input: SearchInput): ChipKey {
  if (input.minPrice != null && input.maxPrice != null) return "price";
  return input.maxPrice != null ? "maxPrice" : "minPrice";
}

export function filterChips(input: SearchInput, copy: LocaleCopy): FilterChip[] {
  const price = priceLabel(input, copy);
  const car = carLabel(input, copy);
  const chips = [...fuelChips(input, copy)];

  if (price) chips.push({ key: priceKey(input), label: price });
  chips.push(...specChips(input, copy));
  if (input.timeFilter) {
    chips.push({ key: "timeFilter", label: copy.t(`filters.listedChoices.${input.timeFilter}`) });
  }
  if (car) chips.push({ key: "brand", label: car });
  return chips;
}
