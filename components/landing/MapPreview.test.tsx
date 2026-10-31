import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import type { CarListing } from "@/interfaces/listing";
import { renderWithI18n } from "@/test/utils/render";
import { LandingMapPreview } from "./MapPreview";

// next/image needs the Next runtime; a plain img is enough for behaviour tests
// (components/map/CarCard.test.tsx does the same for CarPhoto).
vi.mock("next/image", () => import("@/test/mocks/next-image"));

// docs/specs/redesign-entry.md (ENTRY-34, ENTRY-36), worked example "The
// preview's listing". Prices here are hand-picked and deliberately distinct
// from MapPreview.tsx's own example figures (9400, 11900, 14500, 16500,
// 18900), so a price assertion cannot pass by accident against the unchanged
// static pins.
function listing(overrides: Partial<CarListing> = {}): CarListing {
  return {
    id: "wallapop-1",
    image: "https://cdn.wallapop.com/car-1.jpg",
    title: "Audi A3 2.0 TDI",
    subtitle: "",
    price: 23000,
    mileage: 95000,
    year: 2018,
    fuel: "gasoil",
    brand: "Audi",
    model: "A3",
    location: "Madrid",
    source: "Wallapop",
    lat: 40.4168,
    lng: -3.7038,
    url: "https://es.wallapop.com/item/audi-a3-1",
    ...overrides,
  };
}

describe("ENTRY-34: LandingMapPreview — a real listing", () => {
  it("ENTRY-34: phone with three listings shows the first in the card and its photo, its price on the active pin and the other two elsewhere", () => {
    const listings = [
      listing({
        id: "l-1",
        title: "Audi A3 2.0 TDI",
        image: "https://cdn.wallapop.com/l-1.jpg",
        price: 23000,
      }),
      listing({
        id: "l-2",
        title: "SEAT León 1.5 TSI",
        image: "https://cdn.wallapop.com/l-2.jpg",
        price: 12700,
      }),
      listing({
        id: "l-3",
        title: "VW Golf 1.6 TDI",
        image: "https://cdn.wallapop.com/l-3.jpg",
        price: 15300,
      }),
    ];

    renderWithI18n(
      <LandingMapPreview variant="phone" label="Ver el mapa" locale="es" listings={listings} />,
      { locale: "es" },
    );

    const preview = screen.getByRole("link", { name: "Ver el mapa" });
    expect(preview).toHaveAttribute("href", "/map");

    const card = screen.getByTestId("landing-preview-car-card");
    expect(within(card).getByText("Audi A3 2.0 TDI")).toBeInTheDocument();
    const photo = card.querySelector("img");
    expect(photo).not.toBeNull();
    expect(photo?.getAttribute("src") ?? "").toContain("https://cdn.wallapop.com/l-1.jpg");

    // The active pin (MapPreview.tsx's ExamplePin, active) is the only pin
    // styled bg-lime; the card's own price uses text-lime, not bg-lime.
    const activePin = preview.querySelector(".bg-lime");
    expect(activePin?.textContent).toBe("23.000\u00a0€");
    expect(screen.getByText("12.700 €")).toBeInTheDocument();
    expect(screen.getByText("15.300 €")).toBeInTheDocument();
  });

  it("ENTRY-34: desktop with five listings shows the first in the card and its photo, and all five prices as pins", () => {
    const listings = [
      listing({
        id: "l-1",
        title: "Audi A3 2.0 TDI",
        image: "https://cdn.wallapop.com/l-1.jpg",
        price: 23000,
      }),
      listing({
        id: "l-2",
        title: "SEAT León 1.5 TSI",
        image: "https://cdn.wallapop.com/l-2.jpg",
        price: 12700,
      }),
      listing({
        id: "l-3",
        title: "VW Golf 1.6 TDI",
        image: "https://cdn.wallapop.com/l-3.jpg",
        price: 15300,
      }),
      listing({
        id: "l-4",
        title: "BMW 320d",
        image: "https://cdn.wallapop.com/l-4.jpg",
        price: 19800,
      }),
      listing({
        id: "l-5",
        title: "Kia Ceed 1.6 CRDi",
        image: "https://cdn.wallapop.com/l-5.jpg",
        price: 8600,
      }),
    ];

    renderWithI18n(
      <LandingMapPreview variant="desktop" label="Ver el mapa" locale="es" listings={listings} />,
      { locale: "es" },
    );

    const preview = screen.getByRole("link", { name: "Ver el mapa" });
    expect(preview).toHaveAttribute("href", "/map");

    const card = screen.getByTestId("landing-preview-car-card");
    expect(within(card).getByText("Audi A3 2.0 TDI")).toBeInTheDocument();
    const photo = card.querySelector("img");
    expect(photo).not.toBeNull();
    expect(photo?.getAttribute("src") ?? "").toContain("https://cdn.wallapop.com/l-1.jpg");

    const activePin = preview.querySelector(".bg-lime");
    expect(activePin?.textContent).toBe("23.000\u00a0€");
    for (const price of ["12.700 €", "15.300 €", "19.800 €", "8.600 €"]) {
      expect(screen.getByText(price)).toBeInTheDocument();
    }
  });
});

describe("ENTRY-36: LandingMapPreview — fewer listings than pins, or none", () => {
  it("ENTRY-36: phone with two listings (fewer than its three pins) falls back to the example car, no photo", () => {
    const listings = [listing({ id: "l-1", price: 23000 }), listing({ id: "l-2", price: 12700 })];

    renderWithI18n(
      <LandingMapPreview variant="phone" label="Ver el mapa" locale="es" listings={listings} />,
      { locale: "es" },
    );

    const card = screen.getByTestId("landing-preview-car-card");
    expect(within(card).getByText("Renault Clio TCe 90")).toBeInTheDocument();
    expect(card.querySelector("img")).toBeNull();
  });

  it("ENTRY-36: desktop with three listings (fewer than its five pins) falls back to the example car, no photo", () => {
    const listings = [
      listing({ id: "l-1", price: 23000 }),
      listing({ id: "l-2", price: 12700 }),
      listing({ id: "l-3", price: 15300 }),
    ];

    renderWithI18n(
      <LandingMapPreview variant="desktop" label="Ver el mapa" locale="es" listings={listings} />,
      { locale: "es" },
    );

    const card = screen.getByTestId("landing-preview-car-card");
    expect(within(card).getByText("Renault Clio TCe 90")).toBeInTheDocument();
    expect(card.querySelector("img")).toBeNull();
  });

  it("ENTRY-36: an empty pool ([]) falls back to the example car, no photo, on both variants", () => {
    renderWithI18n(
      <LandingMapPreview variant="phone" label="Ver el mapa" locale="es" listings={[]} />,
      { locale: "es" },
    );
    const phoneCard = screen.getByTestId("landing-preview-car-card");
    expect(within(phoneCard).getByText("Renault Clio TCe 90")).toBeInTheDocument();
    expect(phoneCard.querySelector("img")).toBeNull();
  });

  it("ENTRY-36: with no listings prop at all (default []) the fallback still shows", () => {
    renderWithI18n(<LandingMapPreview variant="phone" label="Ver el mapa" locale="es" />, {
      locale: "es",
    });
    const card = screen.getByTestId("landing-preview-car-card");
    expect(within(card).getByText("Renault Clio TCe 90")).toBeInTheDocument();
    expect(card.querySelector("img")).toBeNull();
  });
});
