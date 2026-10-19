import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { expectPhotoFocusRing } from "@/test/utils/focus-ring";
import { renderWithI18n } from "@/test/utils/render";
import type { CarListing } from "@/interfaces/listing";
import { CarCard } from "./CarCard";

// next/image needs the Next runtime; a plain img is enough for behaviour tests.
vi.mock("next/image", () => import("@/test/mocks/next-image"));

const listing: CarListing = {
  id: "wallapop-1",
  image: "https://cdn.example.com/car.jpg",
  title: "Audi A3 2.0 TDI",
  subtitle: "Great condition",
  price: 14500,
  mileage: 95000,
  year: 2018,
  fuel: "gasoil",
  brand: "Audi",
  model: "A3",
  location: "Madrid",
  source: "Wallapop",
  lat: 40.4,
  lng: -3.7,
  url: "https://es.wallapop.com/item/audi-a3-1",
};

// docs/specs/redesign-map.md (MAPUI-35, bug fix): the card showed the raw
// upstream `fuel` token ("gasoil", "gasolina") instead of the localized
// `filters.fuelGroups.*` label. Hand-derived from en.json/es.json's
// fuelGroups copy.
describe("MAPUI-35: CarCard — localized fuel label in the meta line (bug fix)", () => {
  it("MAPUI-35: the filter code 'gasoil' shows as the localized Diesel label, not the raw code", () => {
    renderWithI18n(<CarCard listing={listing} saved={false} />);

    expect(screen.getByText("2018 · 95,000 km · Diesel")).toBeInTheDocument();
    expect(screen.queryByText(/gasoil/i)).not.toBeInTheDocument();
  });

  it("MAPUI-35: the same filter code localizes to Diésel in Spanish", () => {
    renderWithI18n(<CarCard listing={listing} saved={false} />, { locale: "es" });

    expect(screen.getByText("2018 · 95.000 km · Diésel")).toBeInTheDocument();
  });

  it("MAPUI-35: the filter code 'gasolina' localizes to Gasolina", () => {
    renderWithI18n(<CarCard listing={{ ...listing, fuel: "gasolina" }} saved={false} />, {
      locale: "es",
    });

    expect(screen.getByText("2018 · 95.000 km · Gasolina")).toBeInTheDocument();
  });

  it("MAPUI-35: coches.net/Milanuncios' own Spanish word ('híbrido') still localizes to Híbrido", () => {
    renderWithI18n(<CarCard listing={{ ...listing, fuel: "híbrido" }} saved={false} />, {
      locale: "es",
    });

    expect(screen.getByText("2018 · 95.000 km · Híbrido")).toBeInTheDocument();
  });

  it("MAPUI-35: a fuel token no group recognises is left off the meta line", () => {
    renderWithI18n(<CarCard listing={{ ...listing, fuel: "cng" }} saved={false} />);

    expect(screen.getByText("2018 · 95,000 km")).toBeInTheDocument();
    expect(screen.queryByText(/cng/i)).not.toBeInTheDocument();
  });

  it("MAPUI-35: an empty fuel field is omitted from the meta line, with no dangling separator", () => {
    renderWithI18n(<CarCard listing={{ ...listing, fuel: "" }} saved={false} />);

    expect(screen.getByText("2018 · 95,000 km")).toBeInTheDocument();
  });

  // The spec's worked example «Fuel»: four 2019 cars with 71.000 km.
  it.each([
    ["gasoil", "2019 · 71.000 km · Diésel"],
    ["gasoline", "2019 · 71.000 km · Gasolina"],
    ["", "2019 · 71.000 km"],
    ["vapor", "2019 · 71.000 km"],
  ])("MAPUI-35: the fuel %j reads «%s»", (fuel, meta) => {
    renderWithI18n(
      <CarCard listing={{ ...listing, year: 2019, mileage: 71000, fuel }} saved={false} />,
      { locale: "es" },
    );

    expect(screen.getByText(meta)).toBeInTheDocument();
  });
});

describe("MAPUI-35: CarCard — one link", () => {
  it("MAPUI-35: the photo adds nothing to the link the car's name already names", () => {
    renderWithI18n(<CarCard listing={listing} saved={false} />, { locale: "es" });

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    // The name is said once: an `alt` repeating it would say it twice.
    expect(screen.getByRole("link", { name: /Audi A3 2\.0 TDI/ })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Audi A3 2\.0 TDI.*Audi A3 2\.0 TDI/ }),
    ).not.toBeInTheDocument();
  });
});

// docs/specs/favorites.md (FAV-9): the saved state is the page's (the map's
// favourite ids), handed to the card, so a saved car is drawn saved from its
// first render. CarListingCard, which held its own copy, no longer takes one:
// its only caller, an alert's matches, starts unsaved.
describe("FAV-9: CarCard — an already-saved listing", () => {
  it("FAV-9: renders in the saved state on first paint", () => {
    renderWithI18n(<CarCard listing={listing} saved />);

    expect(screen.getByRole("button", { name: "Remove from saved" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });
});

// MAPUI-36, moved here from components/map/CarListingCard.test.tsx when F6
// removed that card (docs/specs/redesign-alerts.md, Contracts › Client): the
// heart's accessible name follows the saved state its caller passes in.
describe("MAPUI-36: CarCard — the heart's accessible name", () => {
  it("MAPUI-36: reads Save when not yet saved", () => {
    renderWithI18n(<CarCard listing={listing} saved={false} />);

    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("MAPUI-36: reads Remove from saved once saved", () => {
    renderWithI18n(<CarCard listing={listing} saved />);

    expect(screen.getByRole("button", { name: "Remove from saved" })).toBeInTheDocument();
  });
});

// docs/specs/redesign-map.md (MAPUI-66, bug fix #134): a card focused with
// the keyboard showed both the photo's lime ring and the global focus
// outline around the whole card, and a card with no `onActiveChange` (which
// `active` alone used to gate) got no ring at all. The photo's ring is now
// its own focus indicator, on `group-focus-visible/card`, independent of
// `active` — so the link's outline is always suppressed and every card gets
// the ring, whether or not it tracks active state.
describe("MAPUI-66: CarCard — one outline on a focused card", () => {
  it("MAPUI-66: the link suppresses its outline and the photo carries the focus-visible ring class", () => {
    renderWithI18n(<CarCard listing={listing} saved={false} />);
    const link = screen.getByRole("link", { name: /Audi A3 2\.0 TDI/ });

    expectPhotoFocusRing(link);
  });
});

// docs/specs/motion.md (Key MOTION, Approved), MOTION-6: the heart button
// gains a hover state on pointer devices and a press state.
describe("MOTION-6: CarCard — the heart's hover and press", () => {
  it("MOTION-6: carries hover:text-lime and active:scale-97, off under reduced motion", () => {
    renderWithI18n(<CarCard listing={listing} saved={false} />);

    const className = screen.getByRole("button", { name: "Save" }).className;
    expect(className).toContain("hover:text-lime");
    expect(className).toContain("active:scale-97");
    expect(className).toContain("motion-reduce:active:scale-none");
  });
});

// docs/specs/motion.md (MOTION-9): the active ring on a card in the map's
// list turns on and off with no transition — the photo's transition-[box-shadow]
// animated it, so this amends the class to drop it.
describe("MOTION-9: CarCard — the active ring has no transition", () => {
  it("MOTION-9: the photo carries no transition class at all", () => {
    renderWithI18n(<CarCard listing={listing} saved={false} active onActiveChange={vi.fn()} />);

    const photo = screen.getByRole("link", { name: /Audi A3 2\.0 TDI/ }).querySelector("div");
    expect(photo?.className ?? "").not.toMatch(/(^|\s)transition(-|\s|$)/);
  });
});
