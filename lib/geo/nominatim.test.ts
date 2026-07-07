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

    expect(results.map((r) => r.displayName)).toEqual([
      "Ronda",
      "Málaga",
      "Full Raw Name",
    ]);
  });

  it("returns an empty array on a non-ok response", async () => {
    server.use(
      http.get(ENDPOINT, () => new HttpResponse(null, { status: 500 })),
    );
    expect(await searchLocations("x")).toEqual([]);
  });

  it("returns an empty array when the request throws", async () => {
    server.use(http.get(ENDPOINT, () => HttpResponse.error()));
    expect(await searchLocations("x")).toEqual([]);
  });
});
