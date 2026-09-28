import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithI18n } from "@/test/utils/render";
import { CarListing } from "@/interfaces/listing";
import { ListingsMap } from "./ListingsMap";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

// Leaflet needs a real layout engine, so the map primitives are replaced with
// markup that records what the component asked for. Everything asserted below
// is a decision ListingsMap makes; nothing asserts Leaflet's own behaviour.
const fitBounds = vi.fn();
const latLngBounds = vi.fn((coords: [number, number][]) => ({ coords }));

vi.mock("leaflet", () => ({
  default: {
    divIcon: vi.fn(() => ({ marker: "icon" })),
    latLngBounds: (coords: [number, number][]) => latLngBounds(coords),
  },
}));

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map">{children}</div>
  ),
  TileLayer: ({ url }: { url: string }) => <div data-testid="tiles" data-url={url} />,
  ZoomControl: () => null,
  Marker: ({ position, children }: { position: [number, number]; children: React.ReactNode }) => (
    <div data-testid="marker" data-position={position.join(",")}>
      {children}
    </div>
  ),
  Popup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useMap: () => ({ fitBounds }),
}));

const resolvedTheme = vi.fn(() => "dark");
vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: resolvedTheme() }),
}));

const DARK_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const LIGHT_TILES = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

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
  resolvedTheme.mockReturnValue("dark");
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

describe("ListingsMap tiles", () => {
  it("uses the dark basemap by default", () => {
    renderWithI18n(<ListingsMap listings={[]} />);

    expect(screen.getByTestId("tiles")).toHaveAttribute("data-url", DARK_TILES);
  });

  it("switches to the light basemap when the theme resolves light", () => {
    resolvedTheme.mockReturnValue("light");

    renderWithI18n(<ListingsMap listings={[]} />);

    expect(screen.getByTestId("tiles")).toHaveAttribute("data-url", LIGHT_TILES);
  });
});
