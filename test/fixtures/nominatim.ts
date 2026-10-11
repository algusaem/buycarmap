import type { NominatimResult } from "@/lib/geo/nominatim";

// A fully-populated Nominatim search result. Tests override only the fields
// they care about so each fixture reads as "the normal case, except…".
export function makeNominatimResult(overrides: Partial<NominatimResult> = {}): NominatimResult {
  return {
    place_id: 1,
    display_name: "Madrid, España",
    lat: "40.4168",
    lon: "-3.7038",
    address: { city: "Madrid", state: "Comunidad de Madrid" },
    ...overrides,
  };
}
