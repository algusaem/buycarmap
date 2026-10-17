import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { searchLocations } from "./nominatim";

const ENDPOINT = "https://nominatim.openstreetmap.org/search";

describe("searchLocations", () => {
  it("maps Nominatim results into GeocodingResult with parsed coordinates", async () => {
    const [result] = await searchLocations("Madrid");

    expect(result).toEqual({
      placeId: 1,
      displayName: "Madrid, Comunidad de Madrid",
      lat: 40.4168,
      lng: -3.7038,
    });
  });

  it("builds the display name through the place/region fallback chain", async () => {
    server.use(
      http.get(ENDPOINT, () =>
        HttpResponse.json([
          {
            place_id: 2,
            display_name: "raw",
            lat: "1",
            lon: "2",
            address: { town: "Ronda" },
          },
          {
            place_id: 3,
            display_name: "raw",
            lat: "3",
            lon: "4",
            address: { province: "Málaga" },
          },
          {
            place_id: 4,
            display_name: "Full Raw Name",
            lat: "5",
            lon: "6",
            address: {},
          },
        ]),
      ),
    );

    const results = await searchLocations("x");

    expect(results.map((r) => r.displayName)).toEqual(["Ronda", "Málaga", "Full Raw Name"]);
  });

  // MAPUI-56: a non-ok response and a request that throws both have to reach
  // the caller as a failure, distinct from Nominatim legitimately finding
  // nothing (an ok response with an empty array, kept above) — so "Dónde"
  // can tell "the place search is down" from "no place by that name".
  it("MAPUI-56: throws on a non-ok response, instead of returning an empty array", async () => {
    server.use(http.get(ENDPOINT, () => new HttpResponse(null, { status: 500 })));
    await expect(searchLocations("x")).rejects.toThrow();
  });

  it("MAPUI-56: throws when the request itself throws, instead of returning an empty array", async () => {
    server.use(http.get(ENDPOINT, () => HttpResponse.error()));
    await expect(searchLocations("x")).rejects.toThrow();
  });
});
