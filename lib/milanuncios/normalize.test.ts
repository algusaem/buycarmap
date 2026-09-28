import { describe, expect, it } from "vitest";
import { normalizeMilanunciosItems } from "./normalize";
import { makeMilanunciosAd } from "@/test/fixtures/milanuncios";

describe("normalizeMilanunciosItems", () => {
  it("SRC-1: maps a well-formed ad into a CarListing", () => {
    const [listing] = normalizeMilanunciosItems([makeMilanunciosAd()]);

    expect(listing).toEqual({
      id: "milanuncios-602662777",
      image: "https://images.milanuncios.com/api/v1/ma-ad-media-pro/images/dc7697b0?rule=hw396_70",
      title: "AUDI Q5 35 TDI 120kW 163CV S tronic",
      subtitle: "Único propietario, libro de revisiones, garantía 12 meses.",
      price: 34900,
      mileage: 76852,
      year: 2021,
      fuel: "híbrido",
      brand: "Audi",
      model: "",
      location: "Oliva",
      source: "Milanuncios",
      // Oliva is unmapped, so it resolves to its province (Valencia) centroid.
      lat: 39.4699,
      lng: -0.3763,
      url: "https://www.milanuncios.com/audi-de-segunda-mano/audi-q5-35-tdi-602662777.htm",
    });
  });

  it("SRC-2: drops reserved / sold ads", () => {
    const listings = normalizeMilanunciosItems([
      makeMilanunciosAd({ id: "keep", isReserved: "RELEASED" }),
      makeMilanunciosAd({ id: "drop", isReserved: "RESERVED" }),
    ]);

    expect(listings.map((l) => l.id)).toEqual(["milanuncios-keep"]);
  });

  it("parses km and year out of the Spanish-formatted tags", () => {
    const [listing] = normalizeMilanunciosItems([
      makeMilanunciosAd({
        tags: [
          { type: "kilómetros", text: "123.456 kms" },
          { type: "año", text: "2016" },
          { type: "combustible", text: "diésel" },
        ],
      }),
    ]);

    expect(listing.mileage).toBe(123456);
    expect(listing.year).toBe(2016);
    expect(listing.fuel).toBe("diésel");
  });

  it("SRC-4: defaults km and year to 0 when the tags are missing", () => {
    const [listing] = normalizeMilanunciosItems([makeMilanunciosAd({ tags: [] })]);

    expect(listing.mileage).toBe(0);
    expect(listing.year).toBe(0);
    expect(listing.fuel).toBe("");
  });

  it("appends the size rule the Milanuncios image API requires", () => {
    // The bare media URL 404s; hw396_70 is the rule the site's own cards use.
    const [listing] = normalizeMilanunciosItems([
      makeMilanunciosAd({
        images: ["images.milanuncios.com/api/v1/ma-ad-media-pro/images/abc"],
      }),
    ]);

    expect(listing.image).toBe(
      "https://images.milanuncios.com/api/v1/ma-ad-media-pro/images/abc?rule=hw396_70",
    );
  });

  it("does not append a rule when one is already present", () => {
    const [listing] = normalizeMilanunciosItems([
      makeMilanunciosAd({
        images: ["https://images.milanuncios.com/api/v1/ma-ad-media-pro/images/x?rule=hw800_70"],
      }),
    ]);

    expect(listing.image).toBe(
      "https://images.milanuncios.com/api/v1/ma-ad-media-pro/images/x?rule=hw800_70",
    );
  });

  it("leaves a non-Milanuncios image URL untouched", () => {
    const [listing] = normalizeMilanunciosItems([
      makeMilanunciosAd({ images: ["https://cdn.example.com/photo.jpg"] }),
    ]);

    expect(listing.image).toBe("https://cdn.example.com/photo.jpg");
  });

  it("falls back to the brand for the subtitle when there is no description", () => {
    const [listing] = normalizeMilanunciosItems([makeMilanunciosAd({ description: undefined })]);

    expect(listing.subtitle).toBe("Audi");
  });
});
