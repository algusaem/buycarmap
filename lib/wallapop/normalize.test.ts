import { describe, expect, it } from "vitest";
import { normalizeWallapopItems } from "./normalize";
import { makeWallapopItem } from "@/test/fixtures/wallapop";

describe("normalizeWallapopItems", () => {
  it("SRC-1: maps a well-formed item into a CarListing", () => {
    const [listing] = normalizeWallapopItems([makeWallapopItem()]);

    expect(listing).toEqual({
      id: "wallapop-abc123",
      image: "https://cdn.wallapop.com/img1-big.jpg",
      title: "Audi A3 2.0 TDI",
      subtitle: "Great condition, full service history, one owner from new",
      price: 14500,
      mileage: 95_000,
      year: 2018,
      fuel: "gasoil",
      brand: "Audi",
      model: "A3",
      location: "Madrid",
      source: "Wallapop",
      lat: 40.4168,
      lng: -3.7038,
      url: "https://es.wallapop.com/item/audi-a3-2-0-tdi-abc123",
    });
  });

  it("SRC-2: drops reserved items", () => {
    const items = [
      makeWallapopItem({ id: "keep" }),
      makeWallapopItem({ id: "drop", reserved: { flag: true } }),
    ];

    const result = normalizeWallapopItems(items);

    expect(result.map((l) => l.id)).toEqual(["wallapop-keep"]);
  });

  it("truncates the subtitle to 80 characters", () => {
    const long = "x".repeat(200);
    const [listing] = normalizeWallapopItems([
      makeWallapopItem({ description: long }),
    ]);

    expect(listing.subtitle).toHaveLength(80);
  });

  it("falls back through the image url chain: big → medium → empty", () => {
    // `??` only falls back on nullish values, so a *missing* big (not an empty
    // string) is what drops the mapping to medium.
    const medium = makeWallapopItem({
      id: "m",
      images: [
        {
          id: "i",
          average_color: "#000",
          urls: {
            small: "s.jpg",
            medium: "m.jpg",
            big: undefined as unknown as string,
          },
        },
      ],
    });
    const none = makeWallapopItem({ id: "n", images: [] });

    const [withMedium, withNothing] = normalizeWallapopItems([medium, none]);

    expect(withMedium.image).toBe("m.jpg");
    expect(withNothing.image).toBe("");
  });

  it("SRC-3: geocodes the city when the item has no coordinates", () => {
    const noCoords = makeWallapopItem({
      location: {
        latitude: null as unknown as number,
        longitude: null as unknown as number,
        postal_code: "08001",
        city: "Barcelona",
        region: "Cataluña",
        country_code: "ES",
      },
    });

    const [listing] = normalizeWallapopItems([noCoords]);

    // Barcelona centroid from lib/geo/cities.ts, not the Spain-center fallback.
    expect(listing.lat).toBeCloseTo(41.3874, 3);
    expect(listing.lng).toBeCloseTo(2.1686, 3);
  });

  it("uses the web_slug for the url and falls back to id when absent", () => {
    const [slugged] = normalizeWallapopItems([
      makeWallapopItem({ id: "1", web_slug: "nice-slug" }),
    ]);
    const [unslugged] = normalizeWallapopItems([
      makeWallapopItem({ id: "42", web_slug: undefined as unknown as string }),
    ]);

    expect(slugged.url).toBe("https://es.wallapop.com/item/nice-slug");
    expect(unslugged.url).toBe("https://es.wallapop.com/item/42");
  });
});

describe("normalizeWallapopItems with sparse data", () => {
  it("SRC-4: produces a usable card when the car attributes are absent entirely", () => {
    // Wallapop omits `type_attributes` on some listings. Every consumer of
    // CarListing reads these fields unconditionally, so undefined would render
    // as "undefined km" rather than being hidden by the card's zero checks.
    const [listing] = normalizeWallapopItems([
      makeWallapopItem({ type_attributes: undefined }),
    ]);

    expect(listing).toMatchObject({
      mileage: 0,
      year: 0,
      fuel: "",
      brand: "",
      model: "",
    });
    // The parts that do not come from type_attributes survive.
    expect(listing.title).toBe("Audi A3 2.0 TDI");
    expect(listing.price).toBe(14500);
  });

  it("SRC-4: falls back to a placeholder title when the item has none", () => {
    const [listing] = normalizeWallapopItems([
      makeWallapopItem({ title: undefined }),
    ]);

    expect(listing.title).toBe("Unknown");
  });
});
