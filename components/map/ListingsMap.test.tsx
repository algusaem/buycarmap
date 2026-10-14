import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "@/test/utils/render";
import type { CarListing } from "@/interfaces/listing";
import { ListingsMap } from "./ListingsMap";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

// Leaflet needs a real layout engine, so the map primitives are replaced with
// markup that records what the component asked for. Everything asserted below
// is a decision ListingsMap makes; nothing asserts Leaflet's own behaviour.
const fitBounds = vi.fn();
const latLngBounds = vi.fn((coords: [number, number][]) => ({ coords }));
// MAPUI-29: zoomIn/zoomOut/getZoom, additive to the existing fitBounds spy —
// "Acercar"/"Alejar" change the map zoom by one level through these.
const zoomIn = vi.fn();
const zoomOut = vi.fn();
const getZoom = vi.fn(() => 6);
const divIcon = vi.fn<(options: { html: string }) => { marker: string }>(() => ({
  marker: "icon",
}));
// MAPUI-29: tracked (not just nulled) so a test can assert Leaflet's own
// zoom control is never rendered, now that Acercar/Alejar replace it.
const zoomControlRendered = vi.fn();

vi.mock("leaflet", () => ({
  default: {
    divIcon: (options: { html: string }) => divIcon(options),
    latLngBounds: (coords: [number, number][]) => latLngBounds(coords),
  },
}));

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map">{children}</div>
  ),
  TileLayer: ({ url }: { url: string }) => <div data-testid="tiles" data-url={url} />,
  ZoomControl: () => {
    zoomControlRendered();
    return null;
  },
  Marker: ({ position, children }: { position: [number, number]; children: React.ReactNode }) => (
    <div data-testid="marker" data-position={position.join(",")}>
      {children}
    </div>
  ),
  Popup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useMap: () => ({ fitBounds, zoomIn, zoomOut, getZoom }),
}));

const cartoApiKey = vi.fn<() => string | undefined>(() => undefined);
vi.mock("@/lib/env", () => ({
  env: {
    get NEXT_PUBLIC_CARTO_API_KEY() {
      return cartoApiKey();
    },
  },
}));

const DARK_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

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

beforeEach(() => {
  fitBounds.mockClear();
  latLngBounds.mockClear();
  zoomIn.mockClear();
  zoomOut.mockClear();
  divIcon.mockClear();
  zoomControlRendered.mockClear();
  cartoApiKey.mockReturnValue(undefined);
});

describe("ListingsMap markers", () => {
  it("drops one marker per listing at its own coordinates", () => {
    renderWithI18n(
      <ListingsMap
        listings={[makeListing(), makeListing({ id: "wallapop-2", lat: 41.3874, lng: 2.1686 })]}
      />,
    );

    expect(screen.getAllByTestId("marker").map((m) => m.dataset.position)).toEqual([
      "40.4168,-3.7038",
      "41.3874,2.1686",
    ]);
  });

  it("labels each marker with its title and localised price", () => {
    renderWithI18n(<ListingsMap listings={[makeListing()]} />);

    expect(screen.getByText("Audi A3 2.0 TDI")).toBeInTheDocument();
    // Rendered under the English locale, so the thousands separator is a comma.
    expect(screen.getByText(/14,500/)).toBeInTheDocument();
  });

  it("renders no markers for an empty result set", () => {
    renderWithI18n(<ListingsMap listings={[]} />);

    expect(screen.queryByTestId("marker")).not.toBeInTheDocument();
  });
});

describe("ListingsMap viewport", () => {
  it("fits the viewport to every listing", () => {
    renderWithI18n(
      <ListingsMap
        listings={[makeListing(), makeListing({ id: "wallapop-2", lat: 41.3874, lng: 2.1686 })]}
      />,
    );

    expect(latLngBounds).toHaveBeenCalledWith([
      [40.4168, -3.7038],
      [41.3874, 2.1686],
    ]);
    expect(fitBounds).toHaveBeenCalledWith(expect.anything(), {
      padding: [40, 40],
      maxZoom: 14,
    });
  });

  it("leaves the viewport alone when there is nothing to fit", () => {
    renderWithI18n(<ListingsMap listings={[]} />);

    expect(fitBounds).not.toHaveBeenCalled();
  });
});

describe("ListingsMap viewport generation (MAP-25)", () => {
  it("MAP-25: fits only on a new search, not on an appended page or a favourite toggle", () => {
    const wallapop1 = makeListing({ id: "wallapop-1", lat: 40.4168, lng: -3.7038 });
    const wallapop2 = makeListing({ id: "wallapop-2", lat: 41.3874, lng: 2.1686 });
    const wallapop3 = makeListing({ id: "wallapop-3", lat: 39.4699, lng: -0.3763 });
    const wallapop4 = makeListing({ id: "wallapop-4", lat: 37.3891, lng: -5.9845 });

    const { rerender } = renderWithI18n(
      <ListingsMap listings={[wallapop1, wallapop2]} resultsGeneration={1} />,
    );
    expect(fitBounds).toHaveBeenCalledTimes(1);
    expect(latLngBounds).toHaveBeenLastCalledWith([
      [40.4168, -3.7038],
      [41.3874, 2.1686],
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
    expect(latLngBounds).toHaveBeenLastCalledWith([[37.3891, -5.9845]]);

    // A new search with no results: a new generation, nothing to fit.
    rerender(<ListingsMap listings={[]} resultsGeneration={3} />);
    expect(fitBounds).toHaveBeenCalledTimes(2);
  });
});

describe("ListingsMap tiles", () => {
  it("renders the dark basemap", () => {
    renderWithI18n(<ListingsMap listings={[]} />);

    expect(screen.getByTestId("tiles")).toHaveAttribute("data-url", DARK_TILES);
  });
});

describe("ListingsMap tiles key", () => {
  it("MAP-23: carries the CARTO key as ?key= on the dark tile URL (amended 2026-10-12, LOOK — redesign-foundation.md)", () => {
    cartoApiKey.mockReturnValue("cb1_test");

    renderWithI18n(<ListingsMap listings={[]} />);
    expect(screen.getByTestId("tiles")).toHaveAttribute(
      "data-url",
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=cb1_test",
    );
  });

  it("MAP-23: URL-encodes a key that contains spaces and an ampersand", () => {
    cartoApiKey.mockReturnValue("a b&c");

    renderWithI18n(<ListingsMap listings={[]} />);

    expect(screen.getByTestId("tiles")).toHaveAttribute(
      "data-url",
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=a%20b%26c",
    );
  });

  it("MAP-23: carries no key parameter when none is configured", () => {
    renderWithI18n(<ListingsMap listings={[]} />);

    expect(screen.getByTestId("tiles")).toHaveAttribute("data-url", DARK_TILES);
  });
});

// docs/specs/redesign-map.md (MAPUI-25). A divIcon is the only channel this
// architecture has for pin content (Leaflet renders its HTML string, not
// React children), so the price assertions inspect what `L.divIcon` was
// called with — the same approach the tile-key tests above use for the tile
// URL.
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
    expect(screen.getAllByTestId("marker")).toHaveLength(2);
  });

  it("MAPUI-25: a shared pin's label names the count and the lowest price", () => {
    const a = makeListing({ id: "a", lat: 40.4168, lng: -3.7038, price: 14500 });
    const b = makeListing({ id: "b", lat: 40.4168, lng: -3.7038, price: 9500 });

    renderWithI18n(<ListingsMap listings={[a, b]} />, { locale: "es" });

    expect(pinTexts()).toContain("2 coches · desde 9.500 €");
  });

  it("MAPUI-25: the pins account for exactly the listings in the list, even once two share a point", () => {
    // "Accounts for exactly the listings" (amends MAP-15) is only a
    // meaningfully different claim from today's one-marker-per-listing
    // behaviour once grouping exists — this is that case: 3 listings, 2
    // distinct points, so exactly one pin must sit at the shared point, not
    // two separate ones stacked on it.
    const a = makeListing({ id: "a", lat: 40.4168, lng: -3.7038, price: 14500 });
    const b = makeListing({ id: "b", lat: 40.4168, lng: -3.7038, price: 9500 });
    const c = makeListing({ id: "c", lat: 41.3874, lng: 2.1686, price: 18900 });

    renderWithI18n(<ListingsMap listings={[a, b, c]} />, { locale: "es" });

    const markersAtSharedPoint = screen
      .getAllByTestId("marker")
      .filter((marker) => marker.dataset.position === "40.4168,-3.7038");
    expect(markersAtSharedPoint).toHaveLength(1);
  });
});

// docs/specs/redesign-map.md (MAPUI-27). The preview card's fields, within
// the (always-rendered, in this mock) Popup — opening/closing gestures and
// the list-sync half of MAPUI-27 belong to the component that owns both the
// map and the list (MapView), not this Leaflet wrapper alone.
describe("MAPUI-27: ListingsMap — the preview card", () => {
  it("MAPUI-27: shows the photo, name, city, año · km · combustible, price, Guardar and Ver anuncio", () => {
    renderWithI18n(
      <ListingsMap
        listings={[
          makeListing({
            title: "Audi A3 2.0 TDI",
            location: "Madrid",
            year: 2018,
            mileage: 95000,
            fuel: "gasoil",
            price: 14500,
            url: "https://es.wallapop.com/item/audi-a3-1",
          }),
        ]}
      />,
      { locale: "es" },
    );

    expect(screen.getByRole("img")).toBeInTheDocument();
    expect(screen.getByText("Audi A3 2.0 TDI")).toBeInTheDocument();
    expect(screen.getByText("Madrid")).toBeInTheDocument();
    expect(screen.getByText(/2018.*95.*km.*Diésel/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver anuncio" })).toHaveAttribute("target", "_blank");
  });

  it("MAPUI-27: a grouped pin's preview lists its cars in ascending price order", () => {
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

    const titles = screen.getAllByText(/^Car [ABC]$/).map((node) => node.textContent);
    expect(titles).toEqual(["Car B", "Car C", "Car A"]);
  });
});

describe("MAPUI-29: ListingsMap — Acercar and Alejar", () => {
  it("MAPUI-29: offers Acercar and Alejar, and renders no other zoom control", () => {
    renderWithI18n(<ListingsMap listings={[]} />, { locale: "es" });

    expect(screen.getByRole("button", { name: "Acercar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Alejar" })).toBeInTheDocument();
    expect(zoomControlRendered).not.toHaveBeenCalled();
  });

  it("MAPUI-29: Acercar increases the zoom by one level", async () => {
    renderWithI18n(<ListingsMap listings={[]} />, { locale: "es" });

    await userEvent.click(screen.getByRole("button", { name: "Acercar" }));

    expect(zoomIn).toHaveBeenCalledWith(1);
  });

  it("MAPUI-29: Alejar decreases the zoom by one level", async () => {
    renderWithI18n(<ListingsMap listings={[]} />, { locale: "es" });

    await userEvent.click(screen.getByRole("button", { name: "Alejar" }));

    expect(zoomOut).toHaveBeenCalledWith(1);
  });
});

// docs/specs/redesign-map.md (MAPUI-27, MAPUI-39). Closing the preview — on
// clearing `previewId`, and the fade that plays first whichever way it
// closes — now goes through the open pin's own marker, which this file's
// Marker/Popup stand-ins do not model (they drop `ref` and `eventHandlers`
// entirely; see the file comment above). That behaviour is covered with
// real Leaflet instead, in ListingsMap.preview.test.tsx.

// docs/specs/redesign-map.md (MAPUI-25, MAPUI-26 and MAPUI-57's «Price
// format» worked example). The text a pin draws is the last thing in its
// divIcon's HTML; the prices carry the no-break space Intl writes before «€».
function pinTexts(): string[] {
  return divIcon.mock.calls.map(([{ html }]) => html.replace(/^.*>([^<]*)<\/span>$/, "$1"));
}

describe("MAPUI-25: ListingsMap — the pins' exact text", () => {
  it("MAPUI-25: two cars at one point read «2 coches · desde 9.500 €», a lone car «14.500 €»", () => {
    const a = makeListing({ id: "a", lat: 40.4168, lng: -3.7038, price: 14500 });
    const b = makeListing({ id: "b", lat: 40.4168, lng: -3.7038, price: 9500 });
    const c = makeListing({ id: "c", lat: 41.3879, lng: 2.1699, price: 14500 });

    renderWithI18n(<ListingsMap listings={[a, b, c]} />, { locale: "es" });

    expect(pinTexts()).toEqual(["2 coches · desde 9.500\u00a0€", "14.500\u00a0€"]);
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

    expect(screen.getAllByTestId("marker").map((marker) => marker.dataset.position)).toEqual([
      "40.4168,-3.7038",
    ]);
  });
});

describe("MAPUI-20: ListingsMap — at phone width", () => {
  it("MAPUI-20: shows no zoom control", () => {
    renderWithI18n(<ListingsMap listings={[]} desktop={false} />, { locale: "es" });

    expect(screen.queryByRole("button", { name: "Acercar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Alejar" })).not.toBeInTheDocument();
    expect(zoomControlRendered).not.toHaveBeenCalled();
  });
});
