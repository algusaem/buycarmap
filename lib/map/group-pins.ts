import type { CarListing } from "@/interfaces/listing";
import { formatPrice } from "@/lib/format";
import type { LocaleCopy } from "@/lib/i18n/copy";

// docs/specs/redesign-map.md (MAPUI-25, MAPUI-26). Listings whose coordinates
// are equal to five decimals (about a metre) share one pin. A grouped pin's
// label is "N coches · desde <lowest price>"; a pin with one listing shows
// just its price. A pin's listings are in price order, lowest first; the pins
// are in the order their first listing appears in the list. A listing with no
// coordinates gets no pin. The text comes from the messages in the locale of
// `copy`, and every price is written by `formatPrice` (MAPUI-57).
export interface PinGroup {
  key: string;
  listings: CarListing[];
  label: string;
}

function pointKey(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

function pinLabel(listings: CarListing[], { t, locale }: LocaleCopy): string {
  const price = formatPrice(listings[0].price, locale);
  if (listings.length === 1) return price;
  return t("map.pinGroup", { count: listings.length, price });
}

export function groupPins(listings: CarListing[], copy: LocaleCopy): PinGroup[] {
  const byPoint = new Map<string, CarListing[]>();

  for (const listing of listings) {
    if (!Number.isFinite(listing.lat) || !Number.isFinite(listing.lng)) continue;
    const key = pointKey(listing.lat, listing.lng);
    byPoint.set(key, [...(byPoint.get(key) ?? []), listing]);
  }

  return [...byPoint].map(([key, group]) => {
    const sorted = [...group].sort((a, b) => a.price - b.price);
    return { key, listings: sorted, label: pinLabel(sorted, copy) };
  });
}
