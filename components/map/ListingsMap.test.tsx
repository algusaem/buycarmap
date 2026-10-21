import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as Sentry from "@sentry/nextjs";
import { AttributionControl, MapLibreMap, Popup } from "maplibre-gl";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { withAnimations } from "@/test/utils/animations";
import { failNextMap, GPUInitializationError, mapIn } from "@/test/utils/maplibre";
import type { CarListing } from "@/interfaces/listing";
import { mapStyle } from "@/lib/map/style";
import { ListingsMap } from "./ListingsMap";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("next/image", () => import("@/test/mocks/next-image"));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

// jsdom has no WebGL, so `maplibre-gl` is the stand-in in test/utils/maplibre.ts
// (docs/specs/map-maplibre.md › Decisions and rationale › Tests): it records
// what ListingsMap asks of the map and keeps the markers' and the popup's
// elements in the DOM, as MapLibre does. Everything asserted below is a
// decision ListingsMap makes; what only a drawn map proves (pixels, the
// preview's open and close in a real browser, gestures) is e2e's
// (e2e/map.spec.ts, e2e/maplibre.spec.ts).
vi.mock("maplibre-gl", () => import("@/test/utils/maplibre"));

// The last input is page-wide (lib/input-modality.ts), so every test starts
// from a pointer press, whatever key the test before it pressed last.
beforeEach(() => {
  window.dispatchEvent(new PointerEvent("pointerdown"));
  vi.mocked(Sentry.captureException).mockClear();
});

function makeListing(overrides: Partial<CarListing> = {}): CarListing {
  return {
    id: "wallapop-1",
    image: "https://cdn.wallapop.com/car.jpg",
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
    lat: 40.4168,
    lng: -3.7038,
    url: "https://es.wallapop.com/item/audi-a3-1",
    ...overrides,
  };
}

const AUDI = makeListing();
const SEAT = makeListing({
  id: "wallapop-2",
  title: "Seat Leon FR",
  price: 9500,
  lat: 41.3879,
  lng: 2.1699,
});

// The pins' accessible names: «{title}, {price}», the price with the no-break
// space Intl writes before «€».
const AUDI_PIN = "Audi A3 2.0 TDI, 14.500 €";
const SEAT_PIN = "Seat Leon FR, 9.500 €";

function renderMap(props: Partial<Parameters<typeof ListingsMap>[0]> = {}) {
  return renderWithI18n(<ListingsMap listings={[AUDI, SEAT]} {...props} />, { locale: "es" });
}

function preview() {
  return screen.queryByRole("dialog", { name: "Audi A3 2.0 TDI" });
}

/** Where each marker went, as MapLibre takes a point: longitude first. */
function markerPositions(): Array<[number, number] | undefined> {
  return mapIn().markers.map((marker) => marker.lngLat);
}

/** The text each pin draws, in the order the markers were added. */
function pinTexts(): string[] {
  return mapIn().markers.map((marker) => marker.getElement().textContent ?? "");
}

describe("ListingsMap markers", () => {
  it("drops one marker per listing at its own coordinates", () => {
    renderWithI18n(
      <ListingsMap
        listings={[makeListing(), makeListing({ id: "wallapop-2", lat: 41.3874, lng: 2.1686 })]}
      />,
    );

    expect(markerPositions()).toEqual([
      [-3.7038, 40.4168],
      [2.1686, 41.3874],
    ]);
  });

  it("labels each marker with its title and localised price", () => {
    renderWithI18n(<ListingsMap listings={[makeListing()]} />);

    // Rendered under the English locale, so the thousands separator is a comma.
    expect(screen.getByRole("button", { name: /^Audi A3 2\.0 TDI, .*14,500/ })).toBeInTheDocument();
  });

  it("renders no markers for an empty result set", () => {
    renderWithI18n(<ListingsMap listings={[]} />);

    expect(mapIn().markers).toHaveLength(0);
  });
});

describe("ListingsMap viewport", () => {
  it("MAPLIBRE-7: fits the viewport to every listing, 56px of padding, at most zoom 13, at once", () => {
    const fitBounds = vi.spyOn(MapLibreMap.prototype, "fitBounds");
    renderWithI18n(
      <ListingsMap
        listings={[makeListing(), makeListing({ id: "wallapop-2", lat: 41.3874, lng: 2.1686 })]}
      />,
    );

    expect(fitBounds).toHaveBeenCalledWith(
      [
        [-3.7038, 40.4168],
        [2.1686, 41.3874],
      ],
      { padding: 56, maxZoom: 13, animate: false },
    );
    fitBounds.mockRestore();
  });

  it("leaves the viewport alone when there is nothing to fit", () => {
    const fitBounds = vi.spyOn(MapLibreMap.prototype, "fitBounds");
    renderWithI18n(<ListingsMap listings={[]} />);

    expect(fitBounds).not.toHaveBeenCalled();
    fitBounds.mockRestore();
  });

  it("MAPLIBRE-3: starts on mainland Spain, centre 40.4168, -3.7038 at zoom 5", () => {
    renderWithI18n(<ListingsMap listings={[]} />);

    expect(mapIn().options.center).toEqual([-3.7038, 40.4168]);
    expect(mapIn().options.zoom).toBe(5);
  });
});

describe("ListingsMap viewport generation (MAP-25)", () => {
  it("MAP-25: fits only on a new search, not on an appended page or a favourite toggle", () => {
    const fitBounds = vi.spyOn(MapLibreMap.prototype, "fitBounds");
    const wallapop1 = makeListing({ id: "wallapop-1", lat: 40.4168, lng: -3.7038 });
    const wallapop2 = makeListing({ id: "wallapop-2", lat: 41.3874, lng: 2.1686 });
    const wallapop3 = makeListing({ id: "wallapop-3", lat: 39.4699, lng: -0.3763 });
    const wallapop4 = makeListing({ id: "wallapop-4", lat: 37.3891, lng: -5.9845 });

    const { rerender } = renderWithI18n(
      <ListingsMap listings={[wallapop1, wallapop2]} resultsGeneration={1} />,
    );
    expect(fitBounds).toHaveBeenCalledTimes(1);
    expect(fitBounds.mock.lastCall?.[0]).toEqual([
      [-3.7038, 40.4168],
      [2.1686, 41.3874],
    ]);

    // A favourite toggled on wallapop-1: same listings, same generation.
    rerender(<ListingsMap listings={[wallapop1, wallapop2]} resultsGeneration={1} />);
    expect(fitBounds).toHaveBeenCalledTimes(1);

    // The next page appends wallapop-3: the list grows, the generation does not.
    rerender(<ListingsMap listings={[wallapop1, wallapop2, wallapop3]} resultsGeneration={1} />);
    expect(fitBounds).toHaveBeenCalledTimes(1);

    // A new search whose first results are wallapop-4: a new generation.
    rerender(<ListingsMap listings={[wallapop4]} resultsGeneration={2} />);
    expect(fitBounds).toHaveBeenCalledTimes(2);
    expect(fitBounds.mock.lastCall?.[0]).toEqual([
      [-5.9845, 37.3891],
      [-5.9845, 37.3891],
    ]);

    // A new search with no results: a new generation, nothing to fit.
    rerender(<ListingsMap listings={[]} resultsGeneration={3} />);
    expect(fitBounds).toHaveBeenCalledTimes(2);
    fitBounds.mockRestore();
  });
});

// docs/specs/map-maplibre.md (MAPLIBRE-1 to MAPLIBRE-5, MAPLIBRE-14,
// MAPLIBRE-15): what ListingsMap asks of the map it creates.
describe("MAPLIBRE: ListingsMap — the map it creates", () => {
  it("MAPLIBRE-2: draws the design's own style (lib/map/style.ts)", () => {
    renderMap();

    expect(mapIn().options.style).toBe(mapStyle);
  });

  it("MAP-23 (withdrawn by MAPLIBRE, map-maplibre.md): no tile URL is built and no key is sent — the map's one source is OpenFreeMap's TileJSON", () => {
    renderMap();

    const style = mapIn().options.style as typeof mapStyle;
    expect(Object.values(style.sources)).toEqual([
      { type: "vector", url: "https://tiles.openfreemap.org/planet" },
    ]);
  });

  it("MAPLIBRE-6: the map's canvas is not a second region named «Map» inside the page's map region", () => {
    renderMap();

    const canvas = mapIn().getCanvas();
    // A11Y-8 (docs/specs/a11y-checks.md): the interactive map's canvas is one
    // keyboard stop, an application named by how to use it — never a region,
    // never named «Map» nor «Mapa», the page's map region's own name.
    expect(canvas).not.toHaveAttribute("role", "region");
    expect(canvas).not.toHaveAccessibleName("Map");
    expect(canvas).not.toHaveAccessibleName("Mapa");
    expect(canvas).toHaveAttribute("role", "application");
    expect(canvas).toHaveAccessibleName(
      "Mapa: usa las flechas para moverlo y + o − para acercar o alejar",
    );
  });

  it("MAPLIBRE-4: turns rotation and tilt off", () => {
    renderMap();

    expect(mapIn().options).toMatchObject({
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
  });

  it("MAPLIBRE-5: adds one compact attribution control, bottom right, with OpenFreeMap's three links", () => {
    renderMap();

    const { controls, options } = mapIn();
    expect(options.attributionControl).toBe(false);
    expect(controls).toHaveLength(1);
    const [{ control, position }] = controls;
    expect(position).toBe("bottom-right");
    expect(control).toBeInstanceOf(AttributionControl);
    const { compact, customAttribution } = (control as AttributionControl).options;
    expect(compact).toBe(true);
    expect(customAttribution).toContain(
      '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a>',
    );
    expect(customAttribution).toContain('<a href="https://www.openmaptiles.org/" target="_blank">');
    expect(customAttribution).toContain(
      '<a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
    );
  });

  it("MAPLIBRE-3: marks its container data-map=listings and writes the view there on moveend", () => {
    const { container } = renderMap({ listings: [] });

    const view = container.querySelector<HTMLElement>("[data-map='listings']");
    expect(view).not.toBeNull();
    act(() => {
      mapIn().jumpTo({ center: [-3.70379999, 40.41680001], zoom: 5.5 });
    });
    expect(view).toHaveAttribute("data-map-center", "40.4168,-3.7038");
    expect(view).toHaveAttribute("data-map-zoom", "5.5");
    expect(view).toHaveAttribute("data-map-bearing", "0");
    expect(view).toHaveAttribute("data-map-pitch", "0");
  });

  it("MAPLIBRE-14: a tile or source that fails to load is expected, and reported nowhere", () => {
    renderMap();

    act(() => {
      mapIn().fire("error", { error: new Error("tile failed"), sourceId: "openmaptiles" });
    });

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: AUDI_PIN })).toBeInTheDocument();
  });

  it("MAPLIBRE-14: any other map error reaches Sentry", () => {
    renderMap();
    const error = new Error("shader failed");

    act(() => {
      mapIn().fire("error", { error });
    });

    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });

  it("MAPLIBRE-15: without WebGL it shows «El mapa no está disponible en este navegador», no pin and no zoom button, and reports nothing", () => {
    failNextMap(new GPUInitializationError("no WebGL"));
    const { container } = renderMap();

    const view = container.querySelector<HTMLElement>("[data-map='listings']");
    expect(
      within(view as HTMLElement).getByRole("status", {
        name: "El mapa no está disponible en este navegador",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: AUDI_PIN })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Acercar" })).not.toBeInTheDocument();
    expect(Sentry.captureException).not.toHaveBeenCalled();
    // MapLibre's half-built canvas is cleared: the ground shows under the pill.
    expect(view?.querySelector("canvas")).toBeNull();
  });

  it("MAPLIBRE-5: names the attribution toggle in the page's language, «Mostrar u ocultar la atribución»", () => {
    renderMap();

    expect(mapIn().options.locale).toEqual({
      "AttributionControl.ToggleAttribution": "Mostrar u ocultar la atribución",
    });
  });

  it("MAPLIBRE-15: tells the page the map is unavailable, so its own pill stays the only one", () => {
    const onUnavailableChange = vi.fn();
    failNextMap(new GPUInitializationError("no WebGL"));
    renderMap({ onUnavailableChange });

    expect(onUnavailableChange).toHaveBeenLastCalledWith(true);
  });

  it("MAPLIBRE-15: a lost WebGL context takes the pins and the zoom buttons away and shows the status", () => {
    renderMap();

    act(() => {
      mapIn().fire("webglcontextlost");
    });

    expect(
      screen.getByRole("status", { name: "El mapa no está disponible en este navegador" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: AUDI_PIN })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Acercar" })).not.toBeInTheDocument();
  });
});

// docs/specs/redesign-map.md (MAPUI-25). A pin draws its label: the price of
// a lone car, the count and the lowest price of a group.
describe("MAPUI-25: ListingsMap — price pins and grouping", () => {
  it("MAPUI-25: a lone listing's pin shows its price", () => {
    renderWithI18n(<ListingsMap listings={[makeListing({ price: 14500 })]} />, {
      locale: "es",
    });

    expect(pinTexts()).toContain("14.500 €");
  });

  it("MAPUI-25: listings at the same point (equal to five decimals) share one pin", () => {
    const a = makeListing({ id: "a", lat: 40.4168, lng: -3.7038, price: 14500 });
    const b = makeListing({ id: "b", lat: 40.4168, lng: -3.7038, price: 9500 });
    const c = makeListing({ id: "c", lat: 41.3874, lng: 2.1686, price: 18900 });

    renderWithI18n(<ListingsMap listings={[a, b, c]} />, { locale: "es" });

    // Three listings, two distinct points: exactly two pins, not three.
    expect(mapIn().markers).toHaveLength(2);
  });

  it("MAPUI-25: a shared pin's label names the count and the lowest price", () => {
    const a = makeListing({ id: "a", lat: 40.4168, lng: -3.7038, price: 14500 });
    const b = makeListing({ id: "b", lat: 40.4168, lng: -3.7038, price: 9500 });

    renderWithI18n(<ListingsMap listings={[a, b]} />, { locale: "es" });

    expect(pinTexts()).toContain("2 coches · desde 9.500 €");
  });

  it("MAPUI-25: the pins account for exactly the listings in the list, even once two share a point", () => {
    // "Accounts for exactly the listings" (amends MAP-15) is only a
    // meaningfully different claim from one-marker-per-listing once grouping
    // exists — this is that case: 3 listings, 2 distinct points, so exactly
    // one pin must sit at the shared point, not two separate ones stacked on it.
    const a = makeListing({ id: "a", lat: 40.4168, lng: -3.7038, price: 14500 });
    const b = makeListing({ id: "b", lat: 40.4168, lng: -3.7038, price: 9500 });
    const c = makeListing({ id: "c", lat: 41.3874, lng: 2.1686, price: 18900 });

    renderWithI18n(<ListingsMap listings={[a, b, c]} />, { locale: "es" });

    const markersAtSharedPoint = markerPositions().filter(
      (position) => position?.[0] === -3.7038 && position[1] === 40.4168,
    );
    expect(markersAtSharedPoint).toHaveLength(1);
  });

  it("MAPUI-25: two cars at one point read «2 coches · desde 9.500 €», a lone car «14.500 €»", () => {
    const a = makeListing({ id: "a", lat: 40.4168, lng: -3.7038, price: 14500 });
    const b = makeListing({ id: "b", lat: 40.4168, lng: -3.7038, price: 9500 });
    const c = makeListing({ id: "c", lat: 41.3879, lng: 2.1699, price: 14500 });

    renderWithI18n(<ListingsMap listings={[a, b, c]} />, { locale: "es" });

    expect(pinTexts()).toEqual(["2 coches · desde 9.500 €", "14.500 €"]);
  });

  it("MAPUI-25: the pin's accessible name follows a new price on the same pin", () => {
    const { rerender } = renderMap();
    expect(screen.getByRole("button", { name: AUDI_PIN })).toBeInTheDocument();

    rerender(<ListingsMap listings={[{ ...AUDI, price: 13000 }, SEAT]} />);

    expect(screen.getByRole("button", { name: "Audi A3 2.0 TDI, 13.000 €" })).toBeInTheDocument();
  });
});

// docs/specs/redesign-map.md (MAPUI-27). The preview card's fields, once a
// pin opens it.
describe("MAPUI-27: ListingsMap — the preview card", () => {
  it("MAPUI-27: shows the photo, name, city, año · km · combustible, price, Guardar and Ver anuncio", async () => {
    renderWithI18n(<ListingsMap listings={[AUDI]} />, { locale: "es" });

    await userEvent.click(screen.getByRole("button", { name: AUDI_PIN }));
    const card = await screen.findByRole("dialog", { name: "Audi A3 2.0 TDI" });

    expect(within(card).getByRole("img")).toBeInTheDocument();
    expect(within(card).getByText("Audi A3 2.0 TDI")).toBeInTheDocument();
    expect(within(card).getByText("Madrid")).toBeInTheDocument();
    expect(within(card).getByText(/2018.*95.*km.*Diésel/i)).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Guardar" })).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "Ver anuncio" })).toHaveAttribute(
      "target",
      "_blank",
    );
  });

  it("MAPUI-27: a grouped pin's preview lists its cars in ascending price order", async () => {
    const a = makeListing({ id: "a", title: "Car A", lat: 40.4168, lng: -3.7038, price: 14500 });
    const b = makeListing({ id: "b", title: "Car B", lat: 40.4168, lng: -3.7038, price: 9500 });
    const c = makeListing({
      id: "c",
      title: "Car C",
      lat: 40.416804,
      lng: -3.703801,
      price: 12000,
    });

    renderWithI18n(<ListingsMap listings={[a, b, c]} />, { locale: "es" });
    await userEvent.click(screen.getByRole("button", { name: "3 coches · desde 9.500 €" }));
    await screen.findByRole("dialog", { name: "3 coches · desde 9.500 €" });

    const titles = screen.getAllByText(/^Car [ABC]$/).map((node) => node.textContent);
    expect(titles).toEqual(["Car B", "Car C", "Car A"]);
  });

  it("MAPUI-27: the preview is a MapLibre popup at the pin's point, holding the card", async () => {
    renderMap();

    await userEvent.click(screen.getByRole("button", { name: AUDI_PIN }));
    const card = await screen.findByRole("dialog", { name: "Audi A3 2.0 TDI" });

    const popup = card.closest(".maplibregl-popup");
    expect(popup).not.toBeNull();
    expect(mapIn().getContainer().contains(popup)).toBe(true);
  });

  it("MAPUI-27: the open preview card has no axe violations", async () => {
    renderMap();
    screen.getByRole("button", { name: AUDI_PIN }).focus();
    await userEvent.keyboard("{Enter}");

    const card = await screen.findByRole("dialog", { name: "Audi A3 2.0 TDI" });

    expect(await axe(card)).toHaveNoViolations();
  });

  it("MAPUI-27: a grouped pin's preview is named by the group's pin label", async () => {
    const cheaper = makeListing({ id: "wallapop-3", title: "Seat Ibiza", price: 9500 });
    renderWithI18n(<ListingsMap listings={[AUDI, cheaper]} />, { locale: "es" });

    screen.getByRole("button", { name: "2 coches · desde 9.500 €" }).focus();
    await userEvent.keyboard("{Enter}");

    expect(
      await screen.findByRole("dialog", { name: "2 coches · desde 9.500 €" }),
    ).toBeInTheDocument();
  });
});

// docs/specs/redesign-map.md (MAPUI-69, worked example «The preview's name»):
// the preview is a non-modal dialog named by its car, or a grouped pin's by
// the pin's own label.
describe("MAPUI-69: the preview is a non-modal dialog named by its car", () => {
  it("MAPUI-69: a single car's preview is a dialog named «Audi A3 2.0 TDI», with no aria-modal", async () => {
    renderMap();

    await userEvent.click(screen.getByRole("button", { name: AUDI_PIN }));

    const dialog = await screen.findByRole("dialog", { name: "Audi A3 2.0 TDI" });
    expect(dialog).not.toHaveAttribute("aria-modal");
    expect(screen.queryByRole("article", { name: "Vista previa del coche" })).toBeNull();
  });

  it("MAPUI-69: a grouped pin's preview is a dialog named by the pin's label", async () => {
    // AUDI (14.500 €) and the Ibiza (9.500 €) share AUDI's point: «2 coches · desde 9.500 €».
    const cheaper = makeListing({ id: "wallapop-3", title: "Seat Ibiza", price: 9500 });
    renderWithI18n(<ListingsMap listings={[AUDI, cheaper]} />, { locale: "es" });

    await userEvent.click(screen.getByRole("button", { name: "2 coches · desde 9.500 €" }));

    expect(
      await screen.findByRole("dialog", { name: "2 coches · desde 9.500 €" }),
    ).toBeInTheDocument();
  });

  it("MAPUI-69: the focus moving into the preview lands inside the dialog named by its car", async () => {
    renderMap();

    screen.getByRole("button", { name: AUDI_PIN }).focus();
    await userEvent.keyboard("{Enter}");

    const dialog = await screen.findByRole("dialog", { name: "Audi A3 2.0 TDI" });
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));
  });
});

// docs/specs/map-maplibre.md (MAPLIBRE-6): the preview opens above its pin,
// where Leaflet put it, and the map pans the least it takes to show the whole
// card 16px clear of its edges — at once from the keyboard (MOTION-11).
describe("MAPLIBRE-6: ListingsMap — the preview opens above its pin and pans into view", () => {
  /** A full DOMRect for a box at `left`, `top`. */
  function rect(left: number, top: number, width: number, height: number): DOMRect {
    return {
      x: left,
      y: top,
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      toJSON: () => ({}),
    };
  }

  /** The map's container is 800×600 at the origin; the popup's box is `card`. */
  function stubBoxes(card: DOMRect) {
    return vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.classList.contains("maplibregl-popup")) return card;
      if (this.classList.contains("maplibregl-map")) return rect(0, 0, 800, 600);
      return rect(0, 0, 0, 0);
    });
  }

  it("MAPLIBRE-6: the popup is anchored by its bottom, 36px above the point (Leaflet's 16px offset plus its 20px popup margin)", async () => {
    const addTo = vi.spyOn(Popup.prototype, "addTo");
    renderMap();

    await userEvent.click(screen.getByRole("button", { name: AUDI_PIN }));
    await screen.findByRole("dialog", { name: "Audi A3 2.0 TDI" });

    const popup = addTo.mock.contexts[0] as Popup;
    expect(popup.options).toMatchObject({ anchor: "bottom", offset: 36 });
    addTo.mockRestore();
  });

  it("MAPLIBRE-6: a card 300px above the map's top pans the map by [0, -316], animated over 250ms, after a click", async () => {
    // The card spans x 230–570 and y -300 to -20: only its top is out, by 300px plus the 16px margin.
    const boxes = stubBoxes(rect(230, -300, 340, 280));
    const panBy = vi.spyOn(MapLibreMap.prototype, "panBy");
    renderMap();

    await userEvent.click(screen.getByRole("button", { name: AUDI_PIN }));
    await screen.findByRole("dialog", { name: "Audi A3 2.0 TDI" });

    expect(panBy).toHaveBeenCalledTimes(1);
    expect(panBy).toHaveBeenCalledWith([0, -316], { duration: 250 });
    panBy.mockRestore();
    boxes.mockRestore();
  });

  it("MAPLIBRE-6: the same card opened with Enter pans at once", async () => {
    const boxes = stubBoxes(rect(230, -300, 340, 280));
    const panBy = vi.spyOn(MapLibreMap.prototype, "panBy");
    renderMap();

    screen.getByRole("button", { name: AUDI_PIN }).focus();
    await userEvent.keyboard("{Enter}");
    await screen.findByRole("dialog", { name: "Audi A3 2.0 TDI" });

    expect(panBy).toHaveBeenCalledWith([0, -316], { animate: false });
    panBy.mockRestore();
    boxes.mockRestore();
  });

  it("MAPLIBRE-6: a card already 16px clear of every edge does not move the map", async () => {
    // x 230–570 within 16–784, y 100–380 within 16–584.
    const boxes = stubBoxes(rect(230, 100, 340, 280));
    const panBy = vi.spyOn(MapLibreMap.prototype, "panBy");
    renderMap();

    await userEvent.click(screen.getByRole("button", { name: AUDI_PIN }));
    await screen.findByRole("dialog", { name: "Audi A3 2.0 TDI" });

    expect(panBy).not.toHaveBeenCalled();
    panBy.mockRestore();
    boxes.mockRestore();
  });
});

// Ported from the removed components/map/ListingsMap.preview.test.tsx, which
// ran real Leaflet in jsdom: these cases assert what ListingsMap's own React
// code decides — a callback, a re-render with new props, a class — so they
// stay here against the stand-in. The open and close lifecycle a real
// browser proves is e2e/map.spec.ts's.
describe("MAPUI-27: ListingsMap — opening the preview from the keyboard", () => {
  it.each([
    ["Enter", "{Enter}"],
    ["Space", " "],
  ])(
    "MAPUI-27: %s on a pin opens its preview, activates its car and moves focus into it",
    async (_key, keys) => {
      const onActivate = vi.fn();
      renderMap({ onActivate });

      screen.getByRole("button", { name: AUDI_PIN }).focus();
      await userEvent.keyboard(keys);

      const card = await screen.findByRole("dialog", { name: "Audi A3 2.0 TDI" });
      expect(within(card).getByText("Audi A3 2.0 TDI")).toBeInTheDocument();
      expect(onActivate).toHaveBeenCalledWith("wallapop-1");
      await waitFor(() =>
        expect(within(card).getByRole("button", { name: "Cerrar vista previa" })).toHaveFocus(),
      );
    },
  );
});

describe("MAPUI-27: ListingsMap — closing the preview", () => {
  async function openAudi(onPreviewClose = vi.fn()) {
    renderMap({ onPreviewClose });
    const pin = screen.getByRole("button", { name: AUDI_PIN });
    pin.focus();
    await userEvent.keyboard("{Enter}");
    await screen.findByRole("dialog", { name: "Audi A3 2.0 TDI" });
    return { pin, onPreviewClose };
  }

  it("MAPUI-27: Escape inside the preview closes it and returns focus to the pin", async () => {
    const { pin, onPreviewClose } = await openAudi();

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(preview()).not.toBeInTheDocument());
    expect(onPreviewClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(pin).toHaveFocus());
  });

  it("MAPUI-27: Escape on the pin closes its preview", async () => {
    const { pin, onPreviewClose } = await openAudi();

    pin.focus();
    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(preview()).not.toBeInTheDocument());
    expect(onPreviewClose).toHaveBeenCalledTimes(1);
    expect(pin).toHaveFocus();
  });

  it("MAPUI-27: the close button closes it and returns focus to the pin", async () => {
    const { pin, onPreviewClose } = await openAudi();

    await userEvent.click(screen.getByRole("button", { name: "Cerrar vista previa" }));

    await waitFor(() => expect(preview()).not.toBeInTheDocument());
    expect(onPreviewClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(pin).toHaveFocus());
  });

  it("MAPUI-27: a press on the map outside the preview closes it and returns focus to the pin", async () => {
    const { pin, onPreviewClose } = await openAudi();

    fireEvent.pointerDown(mapIn().getCanvasContainer());

    await waitFor(() => expect(preview()).not.toBeInTheDocument());
    expect(onPreviewClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(pin).toHaveFocus());
  });

  it("MAPUI-27: a press on the page outside the map closes it too", async () => {
    const outside = document.createElement("button");
    outside.textContent = "Fuera del mapa";
    document.body.appendChild(outside);

    try {
      const { onPreviewClose } = await openAudi();

      fireEvent.pointerDown(outside);

      await waitFor(() => expect(preview()).not.toBeInTheDocument());
      expect(onPreviewClose).toHaveBeenCalledTimes(1);
    } finally {
      outside.remove();
    }
  });

  it("MAPUI-27: a press inside the preview leaves it open", async () => {
    const { onPreviewClose } = await openAudi();
    const card = screen.getByRole("dialog", { name: "Audi A3 2.0 TDI" });

    fireEvent.pointerDown(within(card).getByText("Audi A3 2.0 TDI"));

    expect(preview()).toBeInTheDocument();
    expect(onPreviewClose).not.toHaveBeenCalled();
  });

  it("MAPUI-27: reopened and closed again, one Escape still closes it once", async () => {
    const { pin, onPreviewClose } = await openAudi();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(pin).toHaveFocus());

    await userEvent.keyboard("{Enter}");
    await screen.findByRole("dialog", { name: "Audi A3 2.0 TDI" });
    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(preview()).not.toBeInTheDocument());
    expect(onPreviewClose).toHaveBeenCalledTimes(2);
  });

  it("MAPUI-27: opening another pin's preview leaves the focus in that preview, not on the first pin", async () => {
    const { pin } = await openAudi();

    screen.getByRole("button", { name: SEAT_PIN }).focus();
    await userEvent.keyboard("{Enter}");

    const card = await screen.findByRole("dialog", { name: "Seat Leon FR" });
    await waitFor(() => expect(within(card).getByText("Seat Leon FR")).toBeInTheDocument());
    // Past the tick the closed preview waits before returning focus.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(pin).not.toHaveFocus();
    expect(within(card).getByRole("button", { name: "Cerrar vista previa" })).toHaveFocus();
  });

  it("MAPUI-39: focus that moved out of the map stays where it went when the preview closes", async () => {
    const outside = document.createElement("button");
    outside.textContent = "Crear alerta";
    document.body.appendChild(outside);

    try {
      // The map page clears the preview id when «Crear alerta» opens, and
      // the card it opens takes the focus.
      const { rerender } = renderMap({ previewId: "wallapop-1" });
      screen.getByRole("button", { name: AUDI_PIN }).focus();
      await userEvent.keyboard("{Enter}");
      await screen.findByRole("dialog", { name: "Audi A3 2.0 TDI" });
      outside.focus();

      rerender(<ListingsMap listings={[AUDI, SEAT]} previewId={null} />);

      await waitFor(() => expect(preview()).not.toBeInTheDocument());
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(outside).toHaveFocus();
    } finally {
      outside.remove();
    }
  });
});

// docs/specs/redesign-map.md (MAPUI-27, amended: "Opening another pin while a
// preview is open closes the first and opens the second, which stays open").
// Every close goes through the pin's own requestClose(), so these need real
// animations: the fade is the thing under test, and the global jsdom setup
// skips it instantly otherwise (test/setup.jsdom.ts).
describe("MAPUI-27: ListingsMap — one open preview at a time", () => {
  it("MAPUI-27: pressing another pin fades the first out and opens the second, which survives the first's exit", async () => {
    await withAnimations(async () => {
      renderMap();
      await userEvent.click(screen.getByRole("button", { name: AUDI_PIN }));
      await screen.findByText("Audi A3 2.0 TDI");

      await userEvent.click(screen.getByRole("button", { name: SEAT_PIN }));

      await screen.findByText("Seat Leon FR");
      await waitFor(() => expect(screen.queryByText("Audi A3 2.0 TDI")).toBeNull());
      // The first one's exit finishing must not have taken the second with it.
      expect(screen.getByText("Seat Leon FR")).toBeInTheDocument();
    });
  });

  it("MAPUI-27: reopening a pin after closing it by the toggle focuses the preview again", async () => {
    await withAnimations(async () => {
      renderMap();
      const pin = screen.getByRole("button", { name: AUDI_PIN });
      await userEvent.click(pin);
      await screen.findByRole("dialog", { name: "Audi A3 2.0 TDI" });

      await userEvent.click(pin);
      await waitFor(() => expect(screen.queryByText("Audi A3 2.0 TDI")).toBeNull());

      await userEvent.click(pin);
      const card = await screen.findByRole("dialog", { name: "Audi A3 2.0 TDI" });
      await waitFor(() =>
        expect(within(card).getByRole("button", { name: "Cerrar vista previa" })).toHaveFocus(),
      );
    });
  });

  it.each([
    [
      "an outside press",
      async () => {
        fireEvent.pointerDown(mapIn().getCanvasContainer());
      },
    ],
    [
      "the close button",
      async () => {
        await userEvent.click(screen.getByRole("button", { name: "Cerrar vista previa" }));
      },
    ],
  ])(
    "MAPUI-27: %s keeps the card mounted until the exit finishes, then removes it",
    async (_name, close) => {
      await withAnimations(async (clock) => {
        renderMap();
        await userEvent.click(screen.getByRole("button", { name: AUDI_PIN }));
        await screen.findByText("Audi A3 2.0 TDI");
        await clock.finish();

        await close();

        expect(screen.getByText("Audi A3 2.0 TDI")).toBeInTheDocument();
        await clock.finish();
        await waitFor(() => expect(screen.queryByText("Audi A3 2.0 TDI")).toBeNull());
      });
    },
  );

  // MOTION-11: Escape closes at once, so this reopens mid-fade from a pointer
  // close instead (a click on the pin toggles it shut), which still animates.
  it("MAPUI-27: reopening a pin mid-fade cancels the exit, leaving the preview open and focused", async () => {
    await withAnimations(async (clock) => {
      renderMap();
      const pin = screen.getByRole("button", { name: AUDI_PIN });
      await userEvent.click(pin);
      await screen.findByRole("dialog", { name: "Audi A3 2.0 TDI" });
      // An exit from opacity 0 is instant in Motion (0 to 0 is nothing to
      // animate), so the fade in ends first.
      await clock.finish();

      await userEvent.click(pin);
      expect(screen.getByText("Audi A3 2.0 TDI")).toBeInTheDocument();

      await userEvent.click(pin);

      const card = screen.getByRole("dialog", { name: "Audi A3 2.0 TDI" });
      expect(within(card).getByText("Audi A3 2.0 TDI")).toBeInTheDocument();
      await waitFor(() =>
        expect(within(card).getByRole("button", { name: "Cerrar vista previa" })).toHaveFocus(),
      );
      // Past when the cancelled exit would have ended: the preview stays.
      await clock.finish();
      expect(screen.getByText("Audi A3 2.0 TDI")).toBeInTheDocument();
    });
  });

  it("MAPUI-27: a pin unmounting mid-exit throws nothing and leaves no popup open", async () => {
    await withAnimations(async (clock) => {
      function Wrapper() {
        const [listings, setListings] = useState<CarListing[]>([AUDI, SEAT]);
        return (
          <>
            <button type="button" onClick={() => setListings([SEAT])}>
              Drop Audi
            </button>
            <ListingsMap listings={listings} />
          </>
        );
      }
      renderWithI18n(<Wrapper />, { locale: "es" });

      const pin = screen.getByRole("button", { name: AUDI_PIN });
      await userEvent.click(pin);
      await screen.findByRole("dialog", { name: "Audi A3 2.0 TDI" });
      await clock.finish();

      await userEvent.click(pin);
      expect(screen.getByText("Audi A3 2.0 TDI")).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Drop Audi" }));
      await clock.finish();

      await waitFor(() => expect(screen.queryByText("Audi A3 2.0 TDI")).toBeNull());
      expect(document.querySelector(".maplibregl-popup")).toBeNull();
    });
  });
});

// docs/specs/motion.md (MOTION-11, amends MAPUI-27): a keyboard open or close
// (Enter/Space, Escape) skips the fade; a pointer open or close still plays it.
describe("MOTION-11: ListingsMap — the preview opens and closes at once from the keyboard, but still fades for a pointer", () => {
  it.each([
    ["Enter", "{Enter}"],
    ["Space", " "],
  ])(
    "MOTION-11: %s on a pin opens the preview with no inline opacity below 1, even with animations enabled",
    async (_key, keys) => {
      await withAnimations(async () => {
        renderMap();
        screen.getByRole("button", { name: AUDI_PIN }).focus();

        await userEvent.keyboard(keys);

        const card = await screen.findByRole("dialog", { name: "Audi A3 2.0 TDI" });
        const opacity = card.style.opacity;
        expect(opacity === "" || Number(opacity) >= 1).toBe(true);
      });
    },
  );

  it("MOTION-11: Escape closes the preview in the same tick, with no exit animation to wait for", async () => {
    await withAnimations(async () => {
      renderMap();
      const pin = screen.getByRole("button", { name: AUDI_PIN });
      pin.focus();
      await userEvent.keyboard("{Enter}");
      await screen.findByRole("dialog", { name: "Audi A3 2.0 TDI" });

      await userEvent.keyboard("{Escape}");

      expect(preview()).not.toBeInTheDocument();
    });
  });

  it("MOTION-11: a pointer open still fades in, with an inline opacity below 1 right after the click", async () => {
    await withAnimations(async () => {
      renderMap();

      await userEvent.click(screen.getByRole("button", { name: AUDI_PIN }));

      const card = await screen.findByRole("dialog", { name: "Audi A3 2.0 TDI" });
      expect(Number(card.style.opacity)).toBeLessThan(1);
    });
  });
});

// docs/specs/motion.md (Edge cases, MOTION-11): the open preview's car leaves
// the results — it always goes at once, whatever the last input.
describe("MOTION-11: ListingsMap — a preview whose car leaves the results", () => {
  it("MOTION-11: after a key press («a»), the preview is gone in the same tick when its car leaves the results", async () => {
    await withAnimations(async () => {
      const { rerender } = renderMap();
      await userEvent.click(screen.getByRole("button", { name: AUDI_PIN }));
      await screen.findByRole("dialog", { name: "Audi A3 2.0 TDI" });

      fireEvent.keyDown(window, { key: "a" });
      await act(async () => {
        rerender(<ListingsMap listings={[SEAT]} />);
      });

      expect(preview()).not.toBeInTheDocument();
    });
  });

  it("MOTION-11: even after pointer input, the preview is gone in the same tick when its car leaves the results", async () => {
    await withAnimations(async () => {
      const { rerender } = renderMap();
      await userEvent.click(screen.getByRole("button", { name: AUDI_PIN }));
      await screen.findByRole("dialog", { name: "Audi A3 2.0 TDI" });

      await act(async () => {
        rerender(<ListingsMap listings={[SEAT]} />);
      });

      expect(preview()).not.toBeInTheDocument();
    });
  });
});

// docs/specs/motion.md (MOTION-9): a price pin's active state turns on and
// off with no transition.
describe("MOTION-9: ListingsMap — the pin's active state has no transition", () => {
  it("MOTION-9: the pin carries no transition- class, nor does anything inside it", () => {
    renderMap();

    const pin = screen.getByRole("button", { name: AUDI_PIN });
    for (const element of [pin, ...pin.querySelectorAll("*")]) {
      expect(element.className).not.toMatch(/\btransition-/);
    }
  });
});

// docs/specs/motion.md (MOTION-17): the preview's close button and «Ver
// anuncio» gain a hover and a press state, in the state transition.
describe("MOTION-17: ListingsMap — hover and press on the preview's close button and «Ver anuncio»", () => {
  it.each([
    ["the close button", "button", "Cerrar vista previa", "hover:bg-surface-strong"],
    ["«Ver anuncio»", "link", /Ver anuncio/, "hover:brightness-108"],
  ] as const)(
    "MOTION-17: %s carries its hover class and active:scale-97, off under reduced motion",
    async (_what, role, name, hover) => {
      renderMap();
      screen.getByRole("button", { name: AUDI_PIN }).focus();
      await userEvent.keyboard("{Enter}");
      const card = await screen.findByRole("dialog", { name: "Audi A3 2.0 TDI" });

      const className = within(card).getByRole(role, { name }).className;
      expect(className).toContain(hover);
      expect(className).toContain("active:scale-97");
      expect(className).toContain("motion-reduce:active:scale-none");
      expect(className).toMatch(/transition-\[[^\]]+\]/);
    },
  );
});

describe("MAPUI-24: ListingsMap — a grouped pin", () => {
  it("MAPUI-24: activating a grouped pin activates the group's lowest-price car", async () => {
    const onActivate = vi.fn();
    const cheaper = makeListing({ id: "wallapop-3", title: "Seat Ibiza", price: 9500 });
    renderWithI18n(<ListingsMap listings={[AUDI, cheaper]} onActivate={onActivate} />, {
      locale: "es",
    });

    screen.getByRole("button", { name: "2 coches · desde 9.500 €" }).focus();
    await userEvent.keyboard("{Enter}");

    expect(onActivate).toHaveBeenCalledWith("wallapop-3");
  });

  it("MAPUI-24: at phone width a pin activates its car and opens no preview", async () => {
    const onActivate = vi.fn();
    renderMap({ onActivate, desktop: false });

    await userEvent.click(screen.getByRole("button", { name: AUDI_PIN }));

    expect(onActivate).toHaveBeenCalledWith("wallapop-1");
    expect(preview()).not.toBeInTheDocument();
  });
});

/** The map wired as the map page wires it: the open preview's car is the active one. */
function MapWithPage() {
  const [previewId, setPreviewId] = useState<string | null>(null);
  return (
    <ListingsMap
      listings={[AUDI, SEAT]}
      activeId={previewId}
      previewId={previewId}
      onActivate={setPreviewId}
      onPreviewClose={() => setPreviewId(null)}
    />
  );
}

describe("MAPUI-27, MAPUI-28: ListingsMap — the active pin", () => {
  it("MAPUI-27/MAPUI-28: marks only the active car's pin, and follows activeId", () => {
    const { rerender } = renderMap({ activeId: AUDI.id });
    const audi = screen.getByRole("button", { name: AUDI_PIN });
    const seat = screen.getByRole("button", { name: SEAT_PIN });
    expect(audi).toHaveAttribute("data-active", "true");
    expect(seat).toHaveAttribute("data-active", "false");

    rerender(<ListingsMap listings={[AUDI, SEAT]} activeId={SEAT.id} />);
    expect(audi).toHaveAttribute("data-active", "false");
    expect(seat).toHaveAttribute("data-active", "true");

    rerender(<ListingsMap listings={[AUDI, SEAT]} activeId={null} />);
    expect(audi).toHaveAttribute("data-active", "false");
    expect(seat).toHaveAttribute("data-active", "false");
  });

  it("MAPUI-27: wired to the page, a second pin's preview survives the first's exit and stays the active one", async () => {
    await withAnimations(async () => {
      renderWithI18n(<MapWithPage />, { locale: "es" });
      const audi = screen.getByRole("button", { name: AUDI_PIN });
      const seat = screen.getByRole("button", { name: SEAT_PIN });
      await userEvent.click(audi);
      await screen.findByText("Audi A3 2.0 TDI");

      await userEvent.click(seat);

      await screen.findByText("Seat Leon FR");
      await waitFor(() => expect(screen.queryByText("Audi A3 2.0 TDI")).toBeNull());
      // The first one's close must not have cleared the page's preview, which
      // would close the second through ClosePopupOnPreviewClear.
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(screen.getByText("Seat Leon FR")).toBeInTheDocument();
      expect(seat).toHaveAttribute("data-active", "true");
      expect(audi).toHaveAttribute("data-active", "false");
    });
  });

  it("MAPUI-27: activating the pin of an open preview again closes it and leaves the pin inactive", async () => {
    renderWithI18n(<MapWithPage />, { locale: "es" });
    const pin = screen.getByRole("button", { name: AUDI_PIN });
    pin.focus();
    await userEvent.keyboard("{Enter}");
    await screen.findByRole("dialog", { name: "Audi A3 2.0 TDI" });
    expect(pin).toHaveAttribute("data-active", "true");

    pin.focus();
    await userEvent.keyboard("{Enter}");

    await waitFor(() => expect(preview()).not.toBeInTheDocument());
    expect(pin).toHaveAttribute("data-active", "false");
  });
});

describe("MAPUI-29: ListingsMap — Acercar and Alejar", () => {
  it("MAPUI-29: offers Acercar and Alejar, and adds no zoom control of the map's own", () => {
    renderWithI18n(<ListingsMap listings={[]} />, { locale: "es" });

    expect(screen.getByRole("button", { name: "Acercar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Alejar" })).toBeInTheDocument();
    for (const { control } of mapIn().controls) {
      expect(control).toBeInstanceOf(AttributionControl);
    }
  });

  it("MAPUI-29: Acercar increases the zoom by one level, from 5 to 6", async () => {
    renderWithI18n(<ListingsMap listings={[]} />, { locale: "es" });

    await userEvent.click(screen.getByRole("button", { name: "Acercar" }));

    expect(mapIn().getZoom()).toBe(6);
  });

  it("MAPUI-29: Alejar decreases the zoom by one level, from 5 to 4", async () => {
    renderWithI18n(<ListingsMap listings={[]} />, { locale: "es" });

    await userEvent.click(screen.getByRole("button", { name: "Alejar" }));

    expect(mapIn().getZoom()).toBe(4);
  });
});

describe("MAPUI-26: ListingsMap — a listing without coordinates", () => {
  it("MAPUI-26: a listing whose latitude is not a number gets no pin", () => {
    renderWithI18n(
      <ListingsMap
        listings={[makeListing({ id: "lost", lat: Number.NaN }), makeListing({ id: "found" })]}
      />,
      { locale: "es" },
    );

    expect(markerPositions()).toEqual([[-3.7038, 40.4168]]);
  });
});

describe("MAPUI-20: ListingsMap — at phone width", () => {
  it("MAPUI-20: shows no zoom control", () => {
    renderWithI18n(<ListingsMap listings={[]} desktop={false} />, { locale: "es" });

    expect(screen.queryByRole("button", { name: "Acercar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Alejar" })).not.toBeInTheDocument();
    for (const { control } of mapIn().controls) {
      expect(control).toBeInstanceOf(AttributionControl);
    }
  });
});

// docs/specs/redesign-map.md (MAPUI-62, #133): MapLibre reports a click on a
// pin as the map's own click too (the stand-in does as well), so the pin case
// proves ListingsMap's own filter.
describe("MAPUI-62: ListingsMap - reporting a map interaction", () => {
  it("MAPUI-62: clicking the map calls onMapInteract once", () => {
    const onMapInteract = vi.fn();
    renderMap({ onMapInteract });

    fireEvent.click(mapIn().getCanvasContainer());

    expect(onMapInteract).toHaveBeenCalledTimes(1);
  });

  it("MAPUI-62: a pan starting calls onMapInteract once", () => {
    const onMapInteract = vi.fn();
    renderMap({ onMapInteract });

    act(() => {
      mapIn().fire("dragstart");
    });

    expect(onMapInteract).toHaveBeenCalledTimes(1);
  });

  it("MAPUI-62: clicking a pin never calls onMapInteract", async () => {
    const onMapInteract = vi.fn();
    renderMap({ onMapInteract, desktop: false });

    await userEvent.click(screen.getByRole("button", { name: AUDI_PIN }));

    expect(onMapInteract).not.toHaveBeenCalled();
  });
});

// docs/specs/a11y-checks.md (A11Y-4, amended 2026-10-20): a pin the phone's
// results sheet covers is out of the tab order while it is covered. The
// stand-in projects a point to the latitude as its pixel height
// (test/utils/maplibre.ts) and lays nothing out, so a pin's box has no height:
// a pin is covered when its latitude is below the sheet's top edge,
// `coveredFrom`. AUDI sits at y 40.4168 and SEAT at y 41.3879.
describe("A11Y-4: ListingsMap — pins under the phone's results sheet leave the tab order", () => {
  function phoneMap(coveredFrom: number | null) {
    return <ListingsMap listings={[AUDI, SEAT]} desktop={false} coveredFrom={coveredFrom} />;
  }

  it("A11Y-4: with the sheet's top edge at 41, SEAT (y 41.3879) is out of the tab order and AUDI (y 40.4168) keeps its stop", () => {
    renderWithI18n(phoneMap(41), { locale: "es" });

    expect(screen.getByRole("button", { name: AUDI_PIN })).not.toHaveAttribute("tabindex");
    expect(screen.getByRole("button", { name: SEAT_PIN })).toHaveAttribute("tabindex", "-1");
  });

  it("A11Y-4: the sheet resting higher, at 40, covers both pins; resting lower, at 42, covers neither", () => {
    const { rerender } = renderWithI18n(phoneMap(40), { locale: "es" });

    expect(screen.getByRole("button", { name: AUDI_PIN })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("button", { name: SEAT_PIN })).toHaveAttribute("tabindex", "-1");

    rerender(phoneMap(42));

    expect(screen.getByRole("button", { name: AUDI_PIN })).not.toHaveAttribute("tabindex");
    expect(screen.getByRole("button", { name: SEAT_PIN })).not.toHaveAttribute("tabindex");
  });

  it("A11Y-4: with nothing covering the map (desktop), every pin keeps its stop", () => {
    renderWithI18n(<ListingsMap listings={[AUDI, SEAT]} />, { locale: "es" });

    expect(screen.getByRole("button", { name: AUDI_PIN })).not.toHaveAttribute("tabindex");
    expect(screen.getByRole("button", { name: SEAT_PIN })).not.toHaveAttribute("tabindex");
  });

  it("A11Y-4: once the map stops moving with both pins projected to y 100, a sheet at 50 covers both", () => {
    renderWithI18n(phoneMap(50), { locale: "es" });
    expect(screen.getByRole("button", { name: AUDI_PIN })).not.toHaveAttribute("tabindex");
    expect(screen.getByRole("button", { name: SEAT_PIN })).not.toHaveAttribute("tabindex");

    const project = vi.spyOn(mapIn(), "project").mockReturnValue({ x: 0, y: 100 });
    try {
      act(() => {
        mapIn().fire("moveend");
      });

      expect(screen.getByRole("button", { name: AUDI_PIN })).toHaveAttribute("tabindex", "-1");
      expect(screen.getByRole("button", { name: SEAT_PIN })).toHaveAttribute("tabindex", "-1");
    } finally {
      project.mockRestore();
    }
  });
});
