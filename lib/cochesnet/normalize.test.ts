import { describe, expect, it } from "vitest";
import { normalizeCochesNetItems } from "./normalize";
import { makeCochesNetItem } from "@/test/fixtures/cochesnet";

describe("normalizeCochesNetItems", () => {
  it("SRC-1: maps a well-formed item into a CarListing", () => {
    const [listing] = normalizeCochesNetItems([makeCochesNetItem()]);

    expect(listing).toEqual({
      id: "cochesnet-cn-987",
      image: "https://foto.ccdn.es/cn-987-1.jpg",
      title: "BMW Serie 3 320d",
      subtitle: "BMW Serie 3",
      price: 18900,
      mileage: 120_000,
      year: 2019,
      fuel: "Diésel",
      brand: "BMW",
      model: "Serie 3",
      location: "Barcelona",
      source: "Coches.net",
      lat: 41.3874,
      lng: 2.1686,
      url: "https://www.coches.net/bmw-serie_3-320d/cn-987",
    });
  });

  it("prefers an IMAGE resource over the first resource", () => {
    const [listing] = normalizeCochesNetItems([
      makeCochesNetItem({
        resources: [
          { type: "VIDEO", url: "video.mp4" },
          { type: "IMAGE", url: "photo.jpg" },
        ],
      }),
    ]);

    expect(listing.image).toBe("photo.jpg");
  });

  it("falls back to the first resource, then empty string, for the image", () => {
    const [firstResource] = normalizeCochesNetItems([
      makeCochesNetItem({ resources: [{ type: "VIDEO", url: "only.mp4" }] }),
    ]);
    const [noResources] = normalizeCochesNetItems([makeCochesNetItem({ resources: [] })]);

    expect(firstResource.image).toBe("only.mp4");
    expect(noResources.image).toBe("");
  });

  it("builds the subtitle from make + model, dropping blanks", () => {
    const [listing] = normalizeCochesNetItems([makeCochesNetItem({ make: "", model: "Ibiza" })]);

    expect(listing.subtitle).toBe("Ibiza");
  });

  it("uses the province name for location when the city is absent", () => {
    const [listing] = normalizeCochesNetItems([
      makeCochesNetItem({
        location: {
          provinceIds: [41],
          regionId: 1,
          regionLiteral: "Andalucía",
          mainProvince: "Sevilla",
          mainProvinceId: 41,
          cityId: 0,
          cityLiteral: undefined as unknown as string,
        },
      }),
    ]);

    expect(listing.location).toBe("Sevilla");
  });
});
