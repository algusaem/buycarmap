import { describe, expect, it } from "vitest";
import { getCityCoordinates } from "./cities";

// Hand-derived from lib/geo/cities.ts, not read back from the module.
const MADRID = { lat: 40.4168, lng: -3.7038 };
const FALLBACK = { lat: 1.5, lng: 2.5 };

describe("getCityCoordinates", () => {
  it("CORE-6: resolves a known city", () => {
    expect(getCityCoordinates("Madrid", FALLBACK.lat, FALLBACK.lng)).toEqual(
      MADRID,
    );
  });

  it("CORE-6: ignores case and surrounding whitespace", () => {
    // Source data is scraped, so casing and padding are not dependable.
    expect(getCityCoordinates("  mAdRiD  ", FALLBACK.lat, FALLBACK.lng)).toEqual(
      MADRID,
    );
  });

  it("CORE-7: returns the caller's fallback for a city it does not know", () => {
    // Never a nearby guess: a confidently wrong pin is worse than a coarse one
    // when someone is deciding whether to drive there.
    expect(
      getCityCoordinates("Villaquejida", FALLBACK.lat, FALLBACK.lng),
    ).toEqual(FALLBACK);
  });

  it("CORE-7: returns the fallback for an empty city name", () => {
    expect(getCityCoordinates("", FALLBACK.lat, FALLBACK.lng)).toEqual(FALLBACK);
  });
});
