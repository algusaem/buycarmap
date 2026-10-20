import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MapLibreMap } from "maplibre-gl";
import type { OnUrlUpdateFunction } from "nuqs/adapters/testing";
import { toast } from "sonner";
import { axe } from "vitest-axe";
import { withAnimations } from "@/test/utils/animations";
import {
  adaPage,
  byWholeText,
  foldedCard,
  isOutlined,
  listedAlertNames,
  listingLinks,
  mapRegion,
  normalized,
  openCard,
  pinNames,
  renderAlerts,
  zoneShapes,
} from "@/test/utils/alerts";
import { failNextMap, fittedContains, GPUInitializationError, mapIn } from "@/test/utils/maplibre";
import { expectPhotoFocusRing } from "@/test/utils/focus-ring";
import { stubLayoutBox } from "@/test/utils/viewport";
import {
  ALERT_COPY,
  ALERT_ID,
  ALERT_LABEL,
  adaAlert,
  adaAlerts,
  corollaMatches,
  DELETE_OK,
  DELETE_UNAUTHENTICATED,
  FOLDED_LINE,
  golfMatches,
  serie3Matches,
  serie3Title,
} from "@/test/fixtures/alert-listings";
import { FAVORITE_OK, FAVORITE_UNAUTHENTICATED } from "@/test/fixtures/favorites";
import { focusAlertsOnArrival, takeArrivalFocus } from "@/lib/hooks/useAlertDelete";
import { deleteAlert } from "@/server/alerts/actions";
import { listFavorites, removeFavorite, saveFavorite } from "@/server/favorites/actions";

// The last input is page-wide (lib/input-modality.ts), so every test starts
// from a pointer press, whatever key the test before it pressed last.
beforeEach(() => {
  window.dispatchEvent(new PointerEvent("pointerdown"));
});

// docs/specs/redesign-alerts.md (ALERTUI) for /alerts at desktop width, which
// is jsdom's default: test/setup.jsdom.ts stubs matchMedia to match nothing,
// so useIsPhone reports desktop. The phone composition is
// AlertsPage.phone.test.tsx's.
//
// The alert map is the real ListingsMap on the MapLibre stand-in
// (test/utils/maplibre.ts), as in components/favorites/FavoritesList.test.tsx:
// its pins (buttons in the markers' elements), the zone's circle and dot (the
// "zone" source's features, drawn on the canvas under the markers) and the
// preview's popup. jsdom lays nothing out, so nothing here
// asserts a position or a size (ALERTUI-3, ALERTUI-4 and ALERTUI-37 are
// e2e/alerts-ui.spec.ts's). Which alert is open is resolved on the server
// (ALERTUI-12, ALERTUI-44): a press writes the URL, and the page is then
// rendered again with the server's next data (`rerenderWith`).

const push = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh }),
  usePathname: () => "/alerts",
  useSearchParams: () => new URLSearchParams(),
}));
interface SessionState {
  data: { user: { id: string; name: string } } | null;
  isPending: boolean;
}
const SIGNED_IN: SessionState = {
  data: { user: { id: "user-ada", name: "Ada" } },
  isPending: false,
};
const useSession = vi.fn<() => SessionState>(() => SIGNED_IN);
vi.mock("@/lib/auth/auth-client", () => ({
  authClient: { useSession: () => useSession() },
}));
vi.mock("@/server/favorites/actions", () => ({
  saveFavorite: vi.fn(),
  removeFavorite: vi.fn(),
  listFavorites: vi.fn(),
}));
vi.mock("@/server/alerts/actions", () => ({
  deleteAlert: vi.fn(),
  createAlert: vi.fn(),
}));
vi.mock("next/image", () => import("@/test/mocks/next-image"));
vi.mock("maplibre-gl", () => import("@/test/utils/maplibre"));
// ALERT-39: the matches are snapshots. The search Server Actions are the only
// way the browser reaches a source (ADR 0016); the factory runs only if
// something the page imports loads them.
const searchActions = vi.hoisted(() => ({ loaded: false }));
vi.mock("@/server/search/actions", () => {
  searchActions.loaded = true;
  return { searchListings: vi.fn(), listCarModels: vi.fn() };
});

stubLayoutBox({ width: 830 });

/** Worked example "Created on": today is 2026-10-15. */
const TODAY = new Date("2026-10-15T12:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TODAY);
  useSession.mockImplementation(() => SIGNED_IN);
  vi.mocked(listFavorites).mockReset();
  vi.mocked(listFavorites).mockResolvedValue({ ok: true, value: [] });
  vi.mocked(saveFavorite).mockReset();
  vi.mocked(saveFavorite).mockResolvedValue(FAVORITE_OK);
  vi.mocked(removeFavorite).mockReset();
  vi.mocked(removeFavorite).mockResolvedValue(FAVORITE_OK);
  vi.mocked(deleteAlert).mockReset();
  vi.mocked(deleteAlert).mockResolvedValue(DELETE_OK);
  push.mockClear();
  replace.mockClear();
  refresh.mockClear();
});

afterEach(() => {
  act(() => {
    toast.dismiss();
  });
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const NBSP = " ";
const NAMES = Object.values(ALERT_LABEL);

/** «{title}, {price}» (map.markerLabel), the price with Intl's no-break space before «€». */
function pinName(title: string, price: string): string {
  return `${title}, ${price}${NBSP}€`;
}

async function findPin(name: string): Promise<HTMLElement> {
  return screen.findByRole("button", { name });
}

async function openPreview(name: string): Promise<HTMLElement> {
  (await findPin(name)).focus();
  await userEvent.keyboard("{Enter}");
  return screen.findByRole("article", { name: /Vista previa del coche|coches · desde/ });
}

/** Serie 3 diésel open, with its twelve matches (worked example "Page queries"). */
function serie3Page() {
  return adaPage({ openAlertId: ALERT_ID.serie3, matches: serie3Matches() });
}

/** Clio barato open, with no match. */
function clioPage() {
  return adaPage({ openAlertId: ALERT_ID.clio, matches: [] });
}

/** Opens the confirmation from the open card of the alert named `name`. */
async function confirmFrom(name: string): Promise<{ opener: HTMLElement; dialog: HTMLElement }> {
  const opener = within(openCard(name)).getByRole("button", { name: ALERT_COPY.deleteShort });
  await userEvent.click(opener);
  const dialog = await screen.findByRole("alertdialog", { name: ALERT_COPY.confirmTitle(name) });
  return { opener, dialog };
}

describe("ALERTUI-1: /alerts at desktop width", () => {
  it("ALERTUI-1: shows «Alertas» (h1, in capitals) with «Nueva alerta» to /map, the line, the alerts newest first — the newest open, the others folded — and the alert map", async () => {
    renderAlerts();

    const heading = screen.getByRole("heading", { level: 1, name: ALERT_COPY.title });
    expect(heading).toHaveClass("uppercase");
    expect(screen.getByRole("link", { name: ALERT_COPY.newAlert })).toHaveAttribute("href", "/map");
    expect(screen.getByText(ALERT_COPY.subtitle)).toBeInTheDocument();
    expect(listedAlertNames(NAMES)).toEqual([
      "Corolla híbrido",
      "Golf TDI",
      "Clio barato",
      "Serie 3 diésel",
    ]);
    expect(openCard("Corolla híbrido")).toBeInTheDocument();
    for (const name of ["Golf TDI", "Clio barato", "Serie 3 diésel"]) {
      expect(foldedCard(name)).toHaveAttribute("aria-expanded", "false");
    }
    expect(await screen.findByRole("region", { name: ALERT_COPY.mapLabel })).toBeInTheDocument();
  });

  it("ALERTUI-1: shows no back link to /map — «Nueva alerta» is the page's only link there", () => {
    renderAlerts();

    expect(screen.queryByRole("link", { name: "Volver al inicio" })).not.toBeInTheDocument();
    const toMap = screen
      .queryAllByRole("link")
      .filter((link) => link.getAttribute("href") === "/map")
      .map((link) => normalized(link.textContent));
    expect(toMap).toEqual([ALERT_COPY.newAlert]);
  });
});

describe("ALERTUI-6: the folded AlertCard", () => {
  it("ALERTUI-6: shows the name in capitals, the count on its row, the criteria on one line and «Creada el …» — Golf TDI", () => {
    renderAlerts();
    const golf = foldedCard("Golf TDI");

    expect(within(golf).getByText("Golf TDI")).toHaveClass("uppercase");
    expect(within(golf).getByText("1 coincidencia")).toBeInTheDocument();
    expect(within(golf).getByText(FOLDED_LINE.golf)).toBeInTheDocument();
    expect(within(golf).getByText("Creada el 28 de septiembre")).toBeInTheDocument();
  });

  it("ALERTUI-6: the Clio, created before F6, reads the radius alone — «Renault Clio · Hasta 9.000 € · 50 km»", () => {
    renderAlerts();

    expect(within(foldedCard("Clio barato")).getByText(FOLDED_LINE.clio)).toBeInTheDocument();
    expect(within(foldedCard("Serie 3 diésel")).getByText(FOLDED_LINE.serie3)).toBeInTheDocument();
  });

  it("ALERTUI-6: shows «En pausa» beside the name of a paused alert, and not on an active one", () => {
    renderAlerts(
      adaPage({
        alerts: [adaAlert("corolla"), adaAlert("golf", { active: false }), adaAlert("clio")],
      }),
    );

    expect(within(foldedCard("Golf TDI")).getByText(ALERT_COPY.paused)).toBeInTheDocument();
    expect(
      within(foldedCard("Clio barato")).queryByText(ALERT_COPY.paused),
    ).not.toBeInTheDocument();
  });

  it("ALERTUI-6: shows no match, no «Ver las … coincidencias» and no «Eliminar»", () => {
    renderAlerts();
    const serie3 = foldedCard("Serie 3 diésel");

    expect(listingLinks(serie3)).toEqual([]);
    expect(within(serie3).queryByText(/Ver las/)).not.toBeInTheDocument();
    expect(within(serie3).queryByRole("button", { name: ALERT_COPY.deleteShort })).toBeNull();
    expect(within(serie3).queryByText(ALERT_COPY.deleteShort)).toBeNull();
  });

  it("ALERTUI-6: criteria that no longer parse (read as {}) leave the folded card with no criteria line", () => {
    renderAlerts(adaPage({ alerts: [adaAlert("corolla"), adaAlert("golf", { criteria: {} })] }));
    const golf = foldedCard("Golf TDI");

    // The name, the count and the date only.
    expect(within(golf).queryByText(/·/)).not.toBeInTheDocument();
    expect(within(golf).getByText("Creada el 28 de septiembre")).toBeInTheDocument();
  });
});

describe("ALERTUI-7: the open AlertCard", () => {
  it("ALERTUI-7: has a lime border and shows the name, the count, the criteria as chips in order, and «Creada el …» with «Eliminar»", () => {
    renderAlerts();
    const corolla = openCard("Corolla híbrido");

    expect(corolla).toHaveClass("border-lime");
    expect(within(corolla).getByText("Corolla híbrido")).toBeInTheDocument();
    expect(within(corolla).getByText("4 coincidencias")).toBeInTheDocument();
    const chips = ["Toyota Corolla", "Híbrido", `Hasta 18.000${NBSP}€`, `Madrid · 50${NBSP}km`].map(
      (chip) => byWholeText(corolla, chip),
    );
    for (let index = 1; index < chips.length; index++) {
      expect(
        chips[index - 1].compareDocumentPosition(chips[index]) & Node.DOCUMENT_POSITION_FOLLOWING,
        `«${chips[index - 1].textContent}» before «${chips[index].textContent}»`,
      ).toBeTruthy();
    }
    expect(within(corolla).getByText("Creada el 2 de octubre")).toBeInTheDocument();
    expect(
      within(corolla).getByRole("button", { name: ALERT_COPY.deleteShort }),
    ).toBeInTheDocument();
  });

  it("ALERTUI-7: with four matches shows all four, newest first, and no «Ver las … coincidencias»", () => {
    renderAlerts();
    const corolla = openCard("Corolla híbrido");

    expect(listingLinks(corolla).map((link) => link.getAttribute("href"))).toEqual(
      corollaMatches().map((match) => match.url),
    );
    expect(within(corolla).queryByText(/Ver las/)).not.toBeInTheDocument();
  });

  it("ALERTUI-7: with twelve matches shows the four newest and «Ver las 12 coincidencias», a link to /alerts/<id>", () => {
    renderAlerts(serie3Page());
    const serie3 = openCard("Serie 3 diésel");

    expect(listingLinks(serie3).map((link) => link.getAttribute("href"))).toEqual(
      serie3Matches()
        .slice(0, 4)
        .map((match) => match.url),
    );
    expect(within(serie3).getByRole("link", { name: "Ver las 12 coincidencias" })).toHaveAttribute(
      "href",
      `/alerts/${ALERT_ID.serie3}`,
    );
  });

  it("ALERTUI-7: shows «En pausa» when the open alert is paused, its matches still shown", () => {
    renderAlerts(adaPage({ alerts: [adaAlert("corolla", { active: false }), adaAlert("golf")] }));
    const corolla = openCard("Corolla híbrido");

    expect(within(corolla).getByText(ALERT_COPY.paused)).toBeInTheDocument();
    expect(listingLinks(corolla)).toHaveLength(4);
  });
});

describe("ALERTUI-8: the alert match card", () => {
  function corollaCard(): HTMLAnchorElement {
    const link = listingLinks(openCard("Corolla híbrido")).find((candidate) =>
      candidate.textContent?.includes("Toyota Corolla 125H"),
    );
    expect(link).toBeDefined();
    return link as HTMLAnchorElement;
  }

  it("ALERTUI-8: is one link to the listing in a new tab, with the 110px photo, the source as text, the name, «año · km» with no fuel and the price", () => {
    renderAlerts();
    const card = corollaCard();
    const [cochesnet] = corollaMatches();

    expect(card).toHaveAttribute("href", cochesnet.url);
    expect(card).toHaveAttribute("target", "_blank");
    expect(card).toHaveAttribute("rel", "noopener noreferrer");
    expect(card.querySelector("img")).toHaveAttribute("src", cochesnet.image);
    expect(card.querySelector(".h-27\\.5")).not.toBeNull();
    // The source once, as text: no badge over the photo repeating it.
    expect(within(card).getAllByText("coches.net")).toHaveLength(1);
    expect(within(card).getByText("Toyota Corolla 125H")).toBeInTheDocument();
    expect(within(card).getByText("2021 · 41.000 km")).toBeInTheDocument();
    expect(within(card).queryByText(/Híbrido/)).not.toBeInTheDocument();
    expect(within(card).getByText("16.200 €")).toBeInTheDocument();
  });

  it("ALERTUI-8: has no heart", () => {
    renderAlerts();
    const corolla = openCard("Corolla híbrido");

    expect(within(corolla).queryByRole("button", { name: ALERT_COPY.save })).toBeNull();
    expect(within(corolla).queryByRole("button", { name: ALERT_COPY.unsave })).toBeNull();
  });

  it("ALERTUI-8: «año · km» shows only the parts that are known — an unknown mileage reads «2021»", () => {
    const [first, ...rest] = corollaMatches();
    renderAlerts(adaPage({ matches: [{ ...first, mileage: 0 }, ...rest] }));

    expect(within(corollaCard()).getByText("2021")).toBeInTheDocument();
  });

  it("ALERTUI-8: with no photo, the car's tint with the car icon", () => {
    const [first, ...rest] = corollaMatches();
    renderAlerts(adaPage({ matches: [{ ...first, image: "" }, ...rest] }));
    const card = corollaCard();

    expect(card.querySelector("img")).toBeNull();
    expect(card.querySelector(".lucide-car")).not.toBeNull();
  });

  it("ALERTUI-8: a photo that fails to load gives way to the car's tint with the car icon", () => {
    renderAlerts();
    const card = corollaCard();

    fireEvent.error(card.querySelector("img") as HTMLImageElement);

    expect(card.querySelector("img")).toBeNull();
    expect(card.querySelector(".lucide-car")).not.toBeNull();
  });
});

describe("ALERTUI-9: the match count on the cards", () => {
  it("ALERTUI-9: reads «4 coincidencias», «1 coincidencia», «Sin coincidencias» and «12 coincidencias» on Ada's four cards", () => {
    renderAlerts();

    expect(within(openCard("Corolla híbrido")).getByText("4 coincidencias")).toBeInTheDocument();
    expect(within(foldedCard("Golf TDI")).getByText("1 coincidencia")).toBeInTheDocument();
    expect(within(foldedCard("Clio barato")).getByText("Sin coincidencias")).toBeInTheDocument();
    expect(within(foldedCard("Serie 3 diésel")).getByText("12 coincidencias")).toBeInTheDocument();
  });
});

describe("ALERTUI-10: «Creada el …» on the cards", () => {
  it("ALERTUI-10: each card writes its alert's createdAt in the page's time zone, with no year in the current one", () => {
    renderAlerts(
      adaPage({
        alerts: [
          adaAlert("corolla"),
          adaAlert("serie3", { createdAt: new Date("2025-12-20T12:00:00.000Z") }),
        ],
      }),
    );

    expect(
      within(openCard("Corolla híbrido")).getByText("Creada el 2 de octubre"),
    ).toBeInTheDocument();
    expect(
      within(foldedCard("Serie 3 diésel")).getByText("Creada el 20 de diciembre de 2025"),
    ).toBeInTheDocument();
  });
});

describe("ALERTUI-11: opening a folded card", () => {
  it("ALERTUI-11: the open card is not a button; each folded card is one button named by its alert, aria-expanded false", () => {
    renderAlerts();

    expect(screen.queryByRole("button", { name: "Corolla híbrido" })).not.toBeInTheDocument();
    expect(foldedCard("Golf TDI").tagName).toBe("BUTTON");
    expect(foldedCard("Golf TDI")).toHaveAttribute("aria-expanded", "false");
  });

  it("ALERTUI-11: pressing Golf TDI writes it open; with the server's next data it is open, Corolla híbrido folded, and the map shows Golf's zone, pill and pin, fitted once more", async () => {
    const fitBounds = vi.spyOn(MapLibreMap.prototype, "fitBounds");
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const { rerenderWith } = renderAlerts(adaPage(), { onUrlUpdate });
    await findPin(pinName("Toyota Corolla 125H", "16.200"));
    expect(fitBounds).toHaveBeenCalledTimes(1);

    await userEvent.click(foldedCard("Golf TDI"));

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    expect(onUrlUpdate.mock.lastCall?.[0].searchParams.get("alert")).toBe(ALERT_ID.golf);
    // Until the server answers, the alert open before stays open (Contracts › URL).
    expect(openCard("Corolla híbrido")).toBeInTheDocument();

    rerenderWith(adaPage({ openAlertId: ALERT_ID.golf, matches: golfMatches() }));

    expect(openCard("Golf TDI")).toBeInTheDocument();
    expect(foldedCard("Corolla híbrido")).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => expect(pinNames()).toEqual([pinName("Volkswagen Golf 2.0 TDI", "13.900")]));
    expect(normalized(mapRegion().textContent)).toContain("Golf TDI · Valencia · 25 km");
    expect(zoneShapes()).toHaveLength(2);
    await waitFor(() => expect(fitBounds).toHaveBeenCalledTimes(2));
  });
});

describe("ALERTUI-12: the open alert from the URL", () => {
  it("ALERTUI-12: /alerts?alert=<Clio's id>, resolved by the server, shows Clio barato open and the others folded", () => {
    renderAlerts(clioPage(), { searchParams: `?alert=${ALERT_ID.clio}` });

    expect(openCard("Clio barato")).toBeInTheDocument();
    for (const name of ["Corolla híbrido", "Golf TDI", "Serie 3 diésel"]) {
      expect(foldedCard(name)).toHaveAttribute("aria-expanded", "false");
    }
  });

  it("ALERTUI-12: /alerts?alert=not-a-uuid shows the newest open and leaves the URL as it is", async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderAlerts(adaPage(), { searchParams: "?alert=not-a-uuid", onUrlUpdate });

    expect(openCard("Corolla híbrido")).toBeInTheDocument();
    await act(async () => {
      await Promise.resolve();
    });
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it("ALERTUI-12: pressing Corolla híbrido from ?alert=<Clio's id> removes the parameter as a new entry", async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderAlerts(clioPage(), { searchParams: `?alert=${ALERT_ID.clio}`, onUrlUpdate });

    await userEvent.click(foldedCard("Corolla híbrido"));

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    const event = onUrlUpdate.mock.lastCall?.[0];
    expect(event?.searchParams.has("alert")).toBe(false);
    expect(event?.options.history).toBe("push");
  });
});

describe("ALERTUI-14: the zone", () => {
  it("ALERTUI-14: with a place, the map draws a circle of the criteria radius at the criteria point and a centre dot, hidden from assistive tech, under the pins", async () => {
    renderAlerts();
    await findPin(pinName("Toyota Corolla 125H", "16.200"));

    await waitFor(() => expect(zoneShapes()).toHaveLength(2));
    // Map layers drawn on the canvas — under the markers' elements, where the
    // pins are, and with no element for assistive tech to read, as
    // aria-hidden made Leaflet's paths.
    expect(mapIn(mapRegion()).layers.map((layer) => layer.id)).toEqual([
      "zone-fill",
      "zone-line",
      "zone-centre",
    ]);
    const [circle, centre] = zoneShapes();
    // Madrid, 50 km: the ring's first vertex is due north, 50 / 6371 rad =
    // 0.449661° of latitude away (lib/map/zone.test.ts works it by hand).
    expect(circle.geometry.type).toBe("Polygon");
    const ring = circle.geometry.type === "Polygon" ? circle.geometry.coordinates[0] : [];
    expect(ring).toHaveLength(65);
    expect(ring[0][0]).toBeCloseTo(-3.7038, 6);
    expect(ring[0][1]).toBeCloseTo(40.8665, 4);
    expect(centre.geometry).toEqual({ type: "Point", coordinates: [-3.7038, 40.4168] });
  });

  it("ALERTUI-14: with no place, no circle and no centre dot — Serie 3 diésel", async () => {
    renderAlerts(serie3Page());
    await findPin(`2 coches · desde 17.900${NBSP}€`);

    expect(zoneShapes()).toHaveLength(0);
  });
});

describe("ALERTUI-15: the map's pill", () => {
  it("ALERTUI-15: with a place name reads «Corolla híbrido · Madrid · 50 km», the zone in lime, with no role", async () => {
    renderAlerts();
    const map = await screen.findByRole("region", { name: ALERT_COPY.mapLabel });

    const pill = byWholeText(map, `Corolla híbrido · Madrid · 50${NBSP}km`);
    expect(pill.closest('[role="status"]')).toBeNull();
    expect(byWholeText(pill, `Madrid · 50${NBSP}km`)).toHaveClass("text-lime");
  });

  it("ALERTUI-15: with a place but no place name reads «Clio barato · 50 km», the radius alone in lime", async () => {
    renderAlerts(clioPage());
    const map = await screen.findByRole("region", { name: ALERT_COPY.mapLabel });

    const pill = byWholeText(map, `Clio barato · 50${NBSP}km`);
    expect(byWholeText(pill, `50${NBSP}km`)).toHaveClass("text-lime");
  });

  it("ALERTUI-15: with no place reads the name alone, «Serie 3 diésel», with nothing in lime", async () => {
    renderAlerts(serie3Page());
    const map = await screen.findByRole("region", { name: ALERT_COPY.mapLabel });

    const pill = byWholeText(map, "Serie 3 diésel");
    expect(pill.closest('[role="status"]')).toBeNull();
    expect(pill.querySelector(".text-lime")).toBeNull();
  });

  it("ALERTUI-15: the map's pill has the same inset on the right as on the left and is cut to one line with «…»", async () => {
    const long = "San Sebastián de los Reyes, Comunidad de Madrid";
    renderAlerts(
      adaPage({ alerts: [adaAlert("corolla", { placeName: long }), ...adaAlerts().slice(1)] }),
    );
    const map = await screen.findByRole("region", { name: ALERT_COPY.mapLabel });

    const pill = byWholeText(map, `Corolla híbrido · ${long} · 50${NBSP}km`);
    expect(pill).toHaveClass("w-fit", "max-w-full", "truncate");
    expect(pill.parentElement).toHaveClass("left-4.5", "right-4.5");
  });
});

describe("ALERTUI-16: the pins", () => {
  it("ALERTUI-16: one pin per match with coordinates, every match and not only the four shown — eleven for Serie 3's twelve, two sharing one", async () => {
    renderAlerts(serie3Page());
    await findPin(`2 coches · desde 17.900${NBSP}€`);

    // The 318d 03 to 12 at 15.100 € to 16.000 €, 100 € apart (test/fixtures/alert-listings.ts).
    const prices = [
      "15.100",
      "15.200",
      "15.300",
      "15.400",
      "15.500",
      "15.600",
      "15.700",
      "15.800",
      "15.900",
      "16.000",
    ];
    const singles = prices.map((price, index) => pinName(serie3Title(index + 3), price));
    expect(pinNames()).toEqual([`2 coches · desde 17.900${NBSP}€`, ...singles].sort());
  });

  it("ALERTUI-16: the grouped pin's preview stacks its cars in price order — the 318d 02 at 17.900 €, then the 320d xDrive at 19.500 €", async () => {
    renderAlerts(serie3Page());

    const preview = await openPreview(`2 coches · desde 17.900${NBSP}€`);

    const names = within(preview)
      .getAllByText(/BMW Serie 3 320d xDrive|BMW 318d 02/)
      .map((element) => element.textContent);
    expect(names).toEqual([serie3Title(2), serie3Title(1)]);
  });

  it("ALERTUI-16: a grouped pin ignores an unknown price for «desde» and lists that car last", async () => {
    const [first, second, ...rest] = serie3Matches();
    renderAlerts(
      adaPage({ openAlertId: ALERT_ID.serie3, matches: [{ ...first, price: 0 }, second, ...rest] }),
    );

    const preview = await openPreview(`2 coches · desde 17.900${NBSP}€`);

    const names = within(preview)
      .getAllByText(/BMW Serie 3 320d xDrive|BMW 318d 02/)
      .map((element) => element.textContent);
    expect(names).toEqual([serie3Title(2), serie3Title(1)]);
  });

  it("ALERTUI-16: the map fits the zone and every pin together once — a pin in Barcelona and Madrid's 50 km circle both inside the bounds", async () => {
    const fitBounds = vi.spyOn(MapLibreMap.prototype, "fitBounds");
    const [first, ...rest] = corollaMatches();
    const barcelona = { ...first, lat: 41.3874, lng: 2.1686 };
    renderAlerts(adaPage({ matches: [barcelona, ...rest] }));
    await findPin(pinName("Toyota Corolla 125H", "16.200"));

    await waitFor(() => expect(fitBounds).toHaveBeenCalledTimes(1));
    const bounds = fitBounds.mock.calls[0][0];
    expect(fittedContains(bounds, 41.3874, 2.1686)).toBe(true);
    for (const match of rest) expect(fittedContains(bounds, match.lat, match.lng)).toBe(true);
    // 50 km is 50 / 111.32 ≈ 0.449° of latitude, and 50 / (111.32 × cos 40.4168°)
    // ≈ 0.590° of longitude at Madrid: the circle's edges, a little inside.
    expect(fittedContains(bounds, 40.4168 + 0.44, -3.7038)).toBe(true);
    expect(fittedContains(bounds, 40.4168 - 0.44, -3.7038)).toBe(true);
    expect(fittedContains(bounds, 40.4168, -3.7038 - 0.58)).toBe(true);
    expect(fittedContains(bounds, 40.4168, -3.7038 + 0.58)).toBe(true);
  });

  it("ALERTUI-16: with no zone the map fits every pin — Serie 3 diésel", async () => {
    const fitBounds = vi.spyOn(MapLibreMap.prototype, "fitBounds");
    renderAlerts(serie3Page());
    await findPin(`2 coches · desde 17.900${NBSP}€`);

    await waitFor(() => expect(fitBounds).toHaveBeenCalledTimes(1));
    const bounds = fitBounds.mock.calls[0][0];
    // Serie 3's twelve points (test/fixtures/alert-listings.ts): the shared
    // 37.3891, -5.9845 of the first two, then 37 + n × 0.1, -6 + n × 0.1 for
    // n = 3 to 12, from 37.3, -5.7 to 38.2, -4.8.
    for (const [lat, lng] of [
      [37.3891, -5.9845],
      [37.3, -5.7],
      [37.7, -5.3],
      [38.2, -4.8],
    ]) {
      expect(fittedContains(bounds, lat, lng), `${lat}, ${lng}`).toBe(true);
    }
    // No zone to add: Madrid stays outside.
    expect(fittedContains(bounds, 40.4168, -3.7038)).toBe(false);
  });

  it("ALERTUI-16: hovering a card does not move the map again", async () => {
    const fitBounds = vi.spyOn(MapLibreMap.prototype, "fitBounds");
    renderAlerts();
    await findPin(pinName("Toyota Corolla 125H", "16.200"));
    await waitFor(() => expect(fitBounds).toHaveBeenCalledTimes(1));

    await userEvent.hover(listingLinks(openCard("Corolla híbrido"))[1]);

    expect(fitBounds).toHaveBeenCalledTimes(1);
  });

  it("ALERTUI-16: with no zone and no pin the map keeps its default view — Clio barato with no point and no match", async () => {
    const fitBounds = vi.spyOn(MapLibreMap.prototype, "fitBounds");
    const { criteria } = adaAlert("clio");
    const { latitude: _lat, longitude: _lng, ...noPoint } = criteria;
    renderAlerts(
      adaPage({
        alerts: [adaAlert("clio", { criteria: noPoint })],
        openAlertId: ALERT_ID.clio,
        matches: [],
      }),
    );
    await screen.findByRole("region", { name: ALERT_COPY.mapLabel });
    await screen.findByRole("button", { name: "Acercar" });

    expect(fitBounds).not.toHaveBeenCalled();
  });

  it("ALERTUI-16: the map keeps «Acercar» and «Alejar»", async () => {
    renderAlerts();

    expect(await screen.findByRole("button", { name: "Acercar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Alejar" })).toBeInTheDocument();
  });
});

describe("ALERTUI-17: the list and the map in sync", () => {
  it("ALERTUI-17: hovering a match card marks its pin active, and leaving it clears the mark", async () => {
    renderAlerts();
    const pin = await findPin(pinName("Toyota Corolla 125H", "16.200"));
    expect(pin).toHaveAttribute("data-active", "false");
    const [card] = listingLinks(openCard("Corolla híbrido"));

    await userEvent.hover(card);
    expect(pin).toHaveAttribute("data-active", "true");

    await userEvent.unhover(card);
    expect(pin).toHaveAttribute("data-active", "false");
  });

  it("ALERTUI-17: focusing a match card marks its pin active", async () => {
    renderAlerts();
    const pin = await findPin(pinName("Toyota Corolla 1.8 Hybrid Active", "17.900"));

    listingLinks(openCard("Corolla híbrido"))[1].focus();

    await waitFor(() => expect(pin).toHaveAttribute("data-active", "true"));
  });

  // docs/specs/redesign-alerts.md (ALERTUI-17, amended 2026-10-18, #134): a
  // match card focused with the keyboard showed both the photo's lime ring
  // and the global focus outline around the whole card (MAPUI-66's bug fix
  // also applies here). The photo's ring is the link's own focus indicator,
  // on `group-focus-visible/card`, so the global outline is always
  // suppressed.
  it("ALERTUI-17: a focused match card's link shows only the photo's lime ring, not a second focus outline", () => {
    renderAlerts();
    const [link] = listingLinks(openCard("Corolla híbrido"));

    expectPhotoFocusRing(link);
  });

  // docs/specs/motion.md (MOTION-9): the active ring on a match card turns
  // on and off with no transition.
  it("MOTION-9: an active match card's photo carries no transition class at all", async () => {
    renderAlerts();
    const [link] = listingLinks(openCard("Corolla híbrido"));

    await userEvent.hover(link);

    const photo = link.querySelector("div");
    expect(photo?.className ?? "").not.toMatch(/(^|\s)transition(-|\s|$)/);
  });

  it("ALERTUI-17: activating a pin opens its preview, marks the pin and outlines its card only", async () => {
    renderAlerts();

    const preview = await openPreview(pinName("Toyota Corolla 125H", "16.200"));

    expect(within(preview).getByText("Toyota Corolla 125H")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: pinName("Toyota Corolla 125H", "16.200") }),
    ).toHaveAttribute("data-active", "true");
    const [first, second] = listingLinks(openCard("Corolla híbrido"));
    expect(isOutlined(first)).toBe(true);
    expect(isOutlined(second)).toBe(false);
  });

  it("ALERTUI-17: a grouped pin outlines every card of its group", async () => {
    renderAlerts(serie3Page());

    await openPreview(`2 coches · desde 17.900${NBSP}€`);

    const [first, second, third] = listingLinks(openCard("Serie 3 diésel"));
    expect(isOutlined(first)).toBe(true);
    expect(isOutlined(second)).toBe(true);
    expect(isOutlined(third)).toBe(false);
  });

  it("ALERTUI-17: a pin whose match is not among the four shown opens its preview and outlines no card — the 318d 07", async () => {
    renderAlerts(serie3Page());

    const preview = await openPreview(pinName(serie3Title(7), "15.500"));

    expect(within(preview).getByText(serie3Title(7))).toBeInTheDocument();
    for (const card of listingLinks(openCard("Serie 3 diésel"))) {
      expect(isOutlined(card)).toBe(false);
    }
  });
});

describe("ALERTUI-18: the saved state of a match in the preview (bug fix)", () => {
  it("ALERTUI-18: the BMW Serie 3 320d xDrive, already saved, reads «Quitar de guardados» in the grouped preview, the 318d 02 «Guardar»; pressing it removes it and it reads «Guardar»", async () => {
    vi.mocked(listFavorites).mockResolvedValue({ ok: true, value: [serie3Matches()[0]] });
    renderAlerts(serie3Page());

    const preview = await openPreview(`2 coches · desde 17.900${NBSP}€`);
    // Each car of the group is one child of the preview's article (MapPreview).
    const [cheaper, saved] = Array.from(preview.children) as HTMLElement[];

    await waitFor(() =>
      expect(within(saved).getByRole("button", { name: ALERT_COPY.unsave })).toBeInTheDocument(),
    );
    expect(within(cheaper).getByRole("button", { name: ALERT_COPY.save })).toBeInTheDocument();

    await userEvent.click(within(saved).getByRole("button", { name: ALERT_COPY.unsave }));

    expect(removeFavorite).toHaveBeenCalledTimes(1);
    expect(removeFavorite).toHaveBeenCalledWith("wallapop-serie3-01");
    expect(within(saved).getByRole("button", { name: ALERT_COPY.save })).toBeInTheDocument();
  });

  it("ALERTUI-18: «Guardar» in the preview saves the listing and it reads «Quitar de guardados»", async () => {
    renderAlerts();

    const preview = await openPreview(pinName("Toyota Corolla 125H", "16.200"));
    await userEvent.click(within(preview).getByRole("button", { name: ALERT_COPY.save }));

    expect(saveFavorite).toHaveBeenCalledTimes(1);
    expect(vi.mocked(saveFavorite).mock.calls[0][0]).toMatchObject({ id: "cochesnet-99" });
    expect(within(preview).getByRole("button", { name: ALERT_COPY.unsave })).toBeInTheDocument();
  });
});

describe("ALERTUI-19: a save that fails", () => {
  it("ALERTUI-19 / FAV-11: a save refused with unauthenticated puts the heart back and toasts «Inicia sesión para guardar coches.»", async () => {
    vi.mocked(saveFavorite).mockResolvedValue(FAVORITE_UNAUTHENTICATED);
    renderAlerts();

    const preview = await openPreview(pinName("Toyota Corolla 125H", "16.200"));
    await userEvent.click(within(preview).getByRole("button", { name: ALERT_COPY.save }));

    expect(await screen.findByText(ALERT_COPY.favoriteUnauthenticated)).toBeInTheDocument();
    expect(within(preview).getByRole("button", { name: ALERT_COPY.save })).toBeInTheDocument();
  });

  it("ALERTUI-19 / FAV-11: a save that throws puts the heart back and toasts «Algo ha salido mal. Inténtalo de nuevo.»", async () => {
    vi.mocked(saveFavorite).mockRejectedValue(new Error("network down"));
    renderAlerts();

    const preview = await openPreview(pinName("Toyota Corolla 125H", "16.200"));
    await userEvent.click(within(preview).getByRole("button", { name: ALERT_COPY.save }));

    expect(await screen.findByText(ALERT_COPY.unexpected)).toBeInTheDocument();
    expect(within(preview).getByRole("button", { name: ALERT_COPY.save })).toBeInTheDocument();
  });
});

describe("ALERTUI-33: the confirmation at desktop width", () => {
  it("ALERTUI-33: «Eliminar» on the open card opens a centred alertdialog «¿Eliminar «Corolla híbrido»?» with «Eliminar» and «Cancelar», no handle and no «×», focus on «Cancelar»", async () => {
    renderAlerts();

    const { dialog } = await confirmFrom("Corolla híbrido");

    expect(
      within(dialog).getByRole("button", { name: ALERT_COPY.deleteShort }),
    ).toBeInTheDocument();
    const cancel = within(dialog).getByRole("button", { name: ALERT_COPY.cancel });
    await waitFor(() => expect(cancel).toHaveFocus());
    expect(within(dialog).queryByRole("button", { name: ALERT_COPY.close })).toBeNull();
    expect(dialog.querySelector("[data-sheet-handle]")).toBeNull();
  });

  it("ALERTUI-33: the title names the alert — «¿Eliminar «Clio barato»?», the dialog's heading and its accessible name", async () => {
    renderAlerts(clioPage(), { searchParams: `?alert=${ALERT_ID.clio}` });

    const { dialog } = await confirmFrom("Clio barato");

    expect(dialog).toHaveAccessibleName("¿Eliminar «Clio barato»?");
    expect(within(dialog).getByText("¿Eliminar «Clio barato»?")).toBeInTheDocument();
    expect(within(dialog).queryByText("¿Eliminar esta alerta?")).not.toBeInTheDocument();
  });

  it("ALERTUI-33: «Cancelar» closes it, fading out with Motion, with nothing sent, and focus returns to «Eliminar»", async () => {
    renderAlerts();

    await withAnimations(async (clock) => {
      const { opener, dialog } = await confirmFrom("Corolla híbrido");
      await clock.finish();
      await userEvent.click(within(dialog).getByRole("button", { name: ALERT_COPY.cancel }));

      // Still mounted while its exit plays, then gone.
      expect(
        screen.getByRole("alertdialog", { name: ALERT_COPY.confirmTitle("Corolla híbrido") }),
      ).toBeInTheDocument();
      await clock.finish();
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(opener).toHaveFocus();
    });
    expect(deleteAlert).not.toHaveBeenCalled();
  });

  it("ALERTUI-33: Escape closes it with nothing sent, and focus returns to «Eliminar»", async () => {
    renderAlerts();
    const { opener } = await confirmFrom("Corolla híbrido");

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
    expect(deleteAlert).not.toHaveBeenCalled();
  });

  it("ALERTUI-33: a press outside it closes it with nothing sent, and focus returns to «Eliminar»", async () => {
    renderAlerts();
    const { opener } = await confirmFrom("Corolla híbrido");

    fireEvent.pointerDown(document.body);
    fireEvent.pointerUp(document.body);
    fireEvent.click(document.body);

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
    expect(deleteAlert).not.toHaveBeenCalled();
  });
});

describe("ALERTUI-35: deleting from /alerts (worked example «Delete»)", () => {
  it("ALERTUI-35: while deleteAlert runs, «Eliminar» shows a spinner, keeps its label and is disabled", async () => {
    vi.mocked(deleteAlert).mockReturnValue(
      new Promise(() => {
        // Intentionally left pending: the delete never answers.
      }),
    );
    renderAlerts();
    const { dialog } = await confirmFrom("Corolla híbrido");
    const confirm = within(dialog).getByRole("button", { name: ALERT_COPY.deleteShort });

    await userEvent.click(confirm);

    expect(confirm).toBeDisabled();
    expect(confirm).toHaveTextContent(ALERT_COPY.deleteShort);
    expect(confirm.querySelector(".animate-spin")).not.toBeNull();
  });

  it("ALERTUI-35: while deleteAlert runs, «Cancelar» is disabled too, the focus stays in the confirmation, and Escape, a press outside and «Cancelar» do nothing", async () => {
    vi.mocked(deleteAlert).mockReturnValue(
      new Promise(() => {
        // Intentionally left pending: the delete never answers.
      }),
    );
    renderAlerts();
    const { dialog } = await confirmFrom("Corolla híbrido");
    const cancel = within(dialog).getByRole("button", { name: ALERT_COPY.cancel });

    await userEvent.click(within(dialog).getByRole("button", { name: ALERT_COPY.deleteShort }));

    expect(cancel).toBeDisabled();
    expect(dialog).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    fireEvent.pointerDown(document.body);
    fireEvent.pointerUp(document.body);
    fireEvent.click(document.body);
    await userEvent.click(cancel);
    expect(
      screen.getByRole("alertdialog", { name: ALERT_COPY.confirmTitle("Corolla híbrido") }),
    ).toBe(dialog);
    expect(deleteAlert).toHaveBeenCalledTimes(1);
  });

  it("ALERTUI-35: from ?alert=<Clio's id>, «Eliminar» then «Eliminar» calls deleteAlert(<Clio's id>) once, removes the parameter, lists the three left with Corolla híbrido open, no toast, focus on «Alertas»", async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const { rerenderWith } = renderAlerts(clioPage(), {
      searchParams: `?alert=${ALERT_ID.clio}`,
      onUrlUpdate,
    });
    const { dialog } = await confirmFrom("Clio barato");

    await userEvent.click(within(dialog).getByRole("button", { name: ALERT_COPY.deleteShort }));

    expect(deleteAlert).toHaveBeenCalledTimes(1);
    expect(deleteAlert).toHaveBeenCalledWith(ALERT_ID.clio);
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    expect(onUrlUpdate.mock.lastCall?.[0].searchParams.has("alert")).toBe(false);
    expect(onUrlUpdate.mock.lastCall?.[0].options.history).toBe("replace");
    expect(replace).not.toHaveBeenCalled();
    expect(listedAlertNames(NAMES)).not.toContain("Clio barato");
    rerenderWith(
      adaPage({
        alerts: adaAlerts().filter((alert) => alert.id !== ALERT_ID.clio),
        openAlertId: ALERT_ID.corolla,
      }),
    );
    expect(listedAlertNames(NAMES)).toEqual(["Corolla híbrido", "Golf TDI", "Serie 3 diésel"]);
    expect(openCard("Corolla híbrido")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: ALERT_COPY.title })).toHaveFocus();
    expect(document.querySelector("[data-sonner-toast]")).toBeNull();
  });
});

describe("ALERTUI-36: a delete that fails", () => {
  it("ALERTUI-36: a throw closes the confirmation, keeps Clio barato open and the URL as it was, toasts «Algo ha salido mal. Inténtalo de nuevo.» and returns focus to «Eliminar»", async () => {
    vi.mocked(deleteAlert).mockRejectedValue(new Error("connection refused"));
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderAlerts(clioPage(), { searchParams: `?alert=${ALERT_ID.clio}`, onUrlUpdate });
    const { opener, dialog } = await confirmFrom("Clio barato");

    await userEvent.click(within(dialog).getByRole("button", { name: ALERT_COPY.deleteShort }));

    expect(await screen.findByText(ALERT_COPY.unexpected)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(listedAlertNames(NAMES)).toHaveLength(4);
    expect(openCard("Clio barato")).toBeInTheDocument();
    expect(onUrlUpdate).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(opener).toHaveFocus();
  });

  it("ALERTUI-36: a refusal with unauthenticated toasts «Inicia sesión para gestionar tus alertas.» and keeps the alert", async () => {
    vi.mocked(deleteAlert).mockResolvedValue(DELETE_UNAUTHENTICATED);
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderAlerts(clioPage(), { searchParams: `?alert=${ALERT_ID.clio}`, onUrlUpdate });
    const { opener, dialog } = await confirmFrom("Clio barato");

    await userEvent.click(within(dialog).getByRole("button", { name: ALERT_COPY.deleteShort }));

    expect(await screen.findByText(ALERT_COPY.unauthenticated)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(openCard("Clio barato")).toBeInTheDocument();
    expect(listedAlertNames(NAMES)).toHaveLength(4);
    expect(onUrlUpdate).not.toHaveBeenCalled();
    expect(opener).toHaveFocus();
  });

  it("PLAT-12: a thrown delete shows the generic error toast copy", async () => {
    // Moved from components/alerts/AlertsList.test.tsx (F6, redesign-alerts.md):
    // the delete now goes through the confirmation (ALERTUI-33).
    vi.mocked(deleteAlert).mockRejectedValue(new Error("connection refused"));
    renderAlerts();
    const { dialog } = await confirmFrom("Corolla híbrido");

    await userEvent.click(within(dialog).getByRole("button", { name: ALERT_COPY.deleteShort }));

    expect(await screen.findByText(ALERT_COPY.unexpected)).toBeInTheDocument();
  });
});

// docs/specs/map-maplibre.md (MAPLIBRE-15); StatusPill/README.md: one pill at a time.
describe("MAPLIBRE-15: without WebGL, one map pill at a time", () => {
  it("MAPLIBRE-15: «El mapa no está disponible en este navegador» replaces «Aquí verás la zona de cada alerta» over the map", async () => {
    failNextMap(new GPUInitializationError("no WebGL"));
    renderAlerts({ alerts: [], openAlertId: null, matches: [] });
    const map = await screen.findByRole("region", { name: ALERT_COPY.mapLabel });

    expect(
      await within(map).findByRole("status", {
        name: "El mapa no está disponible en este navegador",
      }),
    ).toBeInTheDocument();
    await waitFor(() => expect(within(map).queryByText(ALERT_COPY.mapEmpty)).toBeNull());
    expect(within(map).getAllByRole("status")).toHaveLength(1);
  });
});

describe("ALERTUI-40: no alert", () => {
  it("ALERTUI-40: shows «Alertas», «¿Sin alertas?» over «Crea una» (h2), the desktop line, «Nueva alerta», the page's line and «Buscar coches» to /map", () => {
    renderAlerts({ alerts: [], openAlertId: null, matches: [] });

    expect(screen.getByRole("heading", { level: 1, name: ALERT_COPY.title })).toBeInTheDocument();
    const empty = screen.getByRole("heading", { level: 2 });
    expect(empty).toHaveTextContent(ALERT_COPY.emptyTitle);
    expect(empty).toHaveTextContent(ALERT_COPY.emptyPunchline);
    expect(screen.getByText(ALERT_COPY.emptyLine)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: ALERT_COPY.newAlert })).toHaveAttribute("href", "/map");
    expect(screen.getByText(ALERT_COPY.subtitle)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: ALERT_COPY.emptyCta })).toHaveAttribute("href", "/map");
  });

  it("ALERTUI-40: the map shows no zone, no pin and the pill «Aquí verás la zona de cada alerta» with role status", async () => {
    renderAlerts({ alerts: [], openAlertId: null, matches: [] });
    const map = await screen.findByRole("region", { name: ALERT_COPY.mapLabel });

    const pill = within(map).getByText(ALERT_COPY.mapEmpty);
    expect(pill.closest('[role="status"]')).not.toBeNull();
    expect(pinNames()).toEqual([]);
    expect(zoneShapes()).toHaveLength(0);
  });

  it("ALERTUI-40: deleting the last alert brings the same state", async () => {
    const { rerenderWith } = renderAlerts(
      adaPage({
        alerts: [adaAlert("serie3")],
        openAlertId: ALERT_ID.serie3,
        matches: serie3Matches(),
      }),
    );
    const { dialog } = await confirmFrom("Serie 3 diésel");

    await userEvent.click(within(dialog).getByRole("button", { name: ALERT_COPY.deleteShort }));
    await waitFor(() => expect(deleteAlert).toHaveBeenCalledWith(ALERT_ID.serie3));
    rerenderWith({ alerts: [], openAlertId: null, matches: [] });

    expect(await screen.findByText(ALERT_COPY.emptyPunchline)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: ALERT_COPY.emptyCta })).toHaveAttribute("href", "/map");
  });
});

// docs/specs/motion.md (MOTION-19): an alert card's hover and press change
// with no transition, and the switch between the list and its empty state on
// /alerts happens at once.
describe("MOTION-19: AlertsPage — the cards and the empty state never animate", () => {
  it("MOTION-19: a folded alert card carries no transition- class", () => {
    renderAlerts();

    const folded = screen.getByRole("button", { name: "Golf TDI" });
    expect(folded.className).not.toMatch(/(^|\s)transition-/);
  });

  it("MOTION-19: deleting the last alert shows the empty state the moment its card leaves, with no card left behind", async () => {
    let answer: ((result: Awaited<ReturnType<typeof deleteAlert>>) => void) | undefined;
    vi.mocked(deleteAlert).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    await withAnimations(async () => {
      const { rerenderWith } = renderAlerts(
        adaPage({
          alerts: [adaAlert("serie3")],
          openAlertId: ALERT_ID.serie3,
          matches: serie3Matches(),
        }),
      );
      const { dialog } = await confirmFrom("Serie 3 diésel");
      await userEvent.click(within(dialog).getByRole("button", { name: ALERT_COPY.deleteShort }));

      await act(async () => {
        answer?.(DELETE_OK);
      });

      // Right after the delete resolves, with nothing waited for.
      expect(
        screen.queryByRole("article", { name: "Serie 3 diésel", hidden: true }),
      ).not.toBeInTheDocument();
      expect(screen.getByText(ALERT_COPY.emptyPunchline)).toBeInTheDocument();
      rerenderWith({ alerts: [], openAlertId: null, matches: [] });
      expect(screen.getByText(ALERT_COPY.emptyPunchline)).toBeInTheDocument();
    });
  });

  it("MOTION-19: alerts arriving on an empty page replace the empty state in the same tick", async () => {
    await withAnimations(async () => {
      const { rerenderWith } = renderAlerts({ alerts: [], openAlertId: null, matches: [] });
      expect(screen.getByText(ALERT_COPY.emptyPunchline)).toBeInTheDocument();

      rerenderWith(adaPage());

      expect(screen.queryByText(ALERT_COPY.emptyPunchline)).not.toBeInTheDocument();
      expect(openCard("Corolla híbrido")).toBeInTheDocument();
    });
  });
});

describe("ALERTUI-41: an open alert with no match", () => {
  it("ALERTUI-41: Clio barato open shows «Sin coincidencias», its chips, «Te avisaremos …» in place of the matches, no «Ver las …», and «Creada el …» with «Eliminar»", () => {
    renderAlerts(clioPage());
    const clio = openCard("Clio barato");

    expect(within(clio).getByText("Sin coincidencias")).toBeInTheDocument();
    byWholeText(clio, "Renault Clio");
    byWholeText(clio, `50${NBSP}km`);
    expect(within(clio).getByText(ALERT_COPY.noMatchesYet)).toBeInTheDocument();
    expect(listingLinks(clio)).toEqual([]);
    expect(within(clio).queryByText(/Ver las/)).not.toBeInTheDocument();
    expect(within(clio).getByText("Creada el 21 de septiembre")).toBeInTheDocument();
    expect(within(clio).getByRole("button", { name: ALERT_COPY.deleteShort })).toBeInTheDocument();
  });
});

// docs/specs/alerts.md (ALERT-28, ALERT-29, ALERT-39, ALERT-40; amended
// 2026-10-15 by redesign-alerts.md) and core-frontend.md (FRONT-14), moved
// here from components/alerts/AlertsList.test.tsx with the page they test.
describe("ALERT-28, ALERT-29, ALERT-39, ALERT-40 and FRONT-14 on the redesigned /alerts", () => {
  it("ALERT-28: lists every alert as an AlertCard with its criteria (ALERTUI-5) and its count (ALERTUI-9)", () => {
    renderAlerts();

    expect(listedAlertNames(NAMES)).toHaveLength(4);
    expect(within(foldedCard("Golf TDI")).getByText(FOLDED_LINE.golf)).toBeInTheDocument();
    expect(within(foldedCard("Golf TDI")).getByText("1 coincidencia")).toBeInTheDocument();
  });

  it("ALERT-28: marks a paused alert «En pausa» rather than hiding it", () => {
    renderAlerts(adaPage({ alerts: [adaAlert("corolla"), adaAlert("clio", { active: false })] }));

    expect(within(foldedCard("Clio barato")).getByText(ALERT_COPY.paused)).toBeInTheDocument();
  });

  it("ALERT-29: with no alert, «¿Sin alertas?» / «Crea una» offers «Buscar coches» to /map", () => {
    renderAlerts({ alerts: [], openAlertId: null, matches: [] });

    expect(screen.getByText(ALERT_COPY.emptyTitle)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: ALERT_COPY.emptyCta })).toHaveAttribute("href", "/map");
  });

  it("ALERT-29: has no accessibility violations when empty", async () => {
    const { container } = renderAlerts({ alerts: [], openAlertId: null, matches: [] });
    await screen.findByText(ALERT_COPY.emptyTitle);

    expect(await axe(container)).toHaveNoViolations();
  });

  it("ALERT-39: the open card lists the four newest matches from their snapshots, with no request to any source", () => {
    renderAlerts(serie3Page());

    expect(listingLinks(openCard("Serie 3 diésel")).map((link) => link.textContent)).toEqual(
      serie3Matches()
        .slice(0, 4)
        .map((match) => expect.stringContaining(match.title)),
    );
    expect(searchActions.loaded).toBe(false);
  });

  it("ALERT-40: an open alert that has found nothing says it is watching, not a blank list", () => {
    renderAlerts(clioPage());

    expect(within(openCard("Clio barato")).getByText(ALERT_COPY.noMatchesYet)).toBeInTheDocument();
  });

  it("FRONT-14: populated shows the AlertCards", () => {
    renderAlerts();

    expect(openCard("Corolla híbrido")).toBeInTheDocument();
    expect(foldedCard("Serie 3 diésel")).toBeInTheDocument();
  });

  it("FRONT-14: empty shows written copy and a primary-action link", () => {
    renderAlerts({ alerts: [], openAlertId: null, matches: [] });

    expect(screen.getByText(ALERT_COPY.emptyLine)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: ALERT_COPY.emptyCta })).toHaveAttribute("href", "/map");
  });
});

// docs/specs/motion.md (Key MOTION, Approved), MOTION-9: the alerts list
// never animates — a deleted card and the card that opens or folds move with
// no fade (amends ALERTUI-11, ALERTUI-35, whose fade-based assertions this
// replaces). No card is ever reachable twice.
describe("MOTION-9: the cards move with no fade (amends ALERTUI-11, ALERTUI-35)", () => {
  it("MOTION-9: a deleted alert's card is removed at once, with no leaving entry fading behind it", async () => {
    await withAnimations(async () => {
      renderAlerts(clioPage(), { searchParams: `?alert=${ALERT_ID.clio}` });
      const { dialog } = await confirmFrom("Clio barato");

      await userEvent.click(within(dialog).getByRole("button", { name: ALERT_COPY.deleteShort }));

      await waitFor(() => expect(listedAlertNames(NAMES)).not.toContain("Clio barato"));
      expect(screen.queryByText("Clio barato")).not.toBeInTheDocument();
    });
  });

  it("MOTION-9: the card that opens shows at once, with no inline opacity below 1, and each alert has one card throughout", async () => {
    await withAnimations(async () => {
      const { rerenderWith } = renderAlerts();

      await userEvent.click(foldedCard("Golf TDI"));
      rerenderWith(adaPage({ openAlertId: ALERT_ID.golf, matches: golfMatches() }));

      const golf = openCard("Golf TDI");
      const opacity = golf.parentElement?.style.opacity;
      expect(opacity === "" || opacity === undefined || Number(opacity) >= 1).toBe(true);
      expect(screen.queryAllByRole("button", { name: "Golf TDI" })).toHaveLength(0);
      expect(screen.queryAllByRole("article", { name: "Corolla híbrido" })).toHaveLength(0);
      expect(screen.queryAllByRole("button", { name: "Corolla híbrido" })).toHaveLength(1);
    });
  });
});

// docs/specs/redesign-alerts.md (ALERTUI-16, ALERTUI-35): after a delete the
// card open in the deleted one's place waits for the server's next data. Until
// then it draws its matches' placeholders — not «Te avisaremos …», and no
// «Ver las …» — and the map fits it once, when its matches arrive.
describe("ALERTUI-35: the open card until the server's next data", () => {
  it("ALERTUI-35: deleting Corolla híbrido opens Golf TDI with placeholders; with the server's data its one match shows, and the map fits once, around Golf's pin", async () => {
    const fitBounds = vi.spyOn(MapLibreMap.prototype, "fitBounds");
    const { rerenderWith } = renderAlerts();
    await findPin(pinName("Toyota Corolla 125H", "16.200"));
    const { dialog } = await confirmFrom("Corolla híbrido");

    await userEvent.click(within(dialog).getByRole("button", { name: ALERT_COPY.deleteShort }));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));

    const golf = openCard("Golf TDI");
    expect(within(golf).getByTestId("open-card-loading")).toHaveAttribute("aria-busy", "true");
    expect(within(golf).queryByText(ALERT_COPY.noMatchesYet)).not.toBeInTheDocument();
    expect(listingLinks(golf)).toEqual([]);
    const fitsBefore = fitBounds.mock.calls.length;

    rerenderWith(
      adaPage({
        alerts: adaAlerts().filter((alert) => alert.id !== ALERT_ID.corolla),
        openAlertId: ALERT_ID.golf,
        matches: golfMatches(),
      }),
    );

    await waitFor(() => expect(pinNames()).toEqual([pinName("Volkswagen Golf 2.0 TDI", "13.900")]));
    await waitFor(() => expect(fitBounds).toHaveBeenCalledTimes(fitsBefore + 1));
    const [bounds] = fitBounds.mock.calls[fitsBefore];
    // Golf's one match, in Valencia: 39.47, -0.38.
    expect(fittedContains(bounds, 39.47, -0.38)).toBe(true);
    expect(within(openCard("Golf TDI")).queryByTestId("open-card-loading")).not.toBeInTheDocument();
    expect(listingLinks(openCard("Golf TDI"))).toHaveLength(1);
    expect(fitBounds).toHaveBeenCalledTimes(fitsBefore + 1);
  });

  it("ALERTUI-16: after deleting Corolla híbrido the map fits once more only when Golf TDI's data arrives — not on Golf's zone alone before", async () => {
    const fitBounds = vi.spyOn(MapLibreMap.prototype, "fitBounds");
    const { rerenderWith } = renderAlerts();
    await findPin(pinName("Toyota Corolla 125H", "16.200"));
    await waitFor(() => expect(fitBounds).toHaveBeenCalledTimes(1));
    const { dialog } = await confirmFrom("Corolla híbrido");

    await userEvent.click(within(dialog).getByRole("button", { name: ALERT_COPY.deleteShort }));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));

    expect(fitBounds).toHaveBeenCalledTimes(1);
    expect(zoneShapes()).toHaveLength(0);

    rerenderWith(
      adaPage({
        alerts: adaAlerts().filter((alert) => alert.id !== ALERT_ID.corolla),
        openAlertId: ALERT_ID.golf,
        matches: golfMatches(),
      }),
    );

    await waitFor(() => expect(fitBounds).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(zoneShapes()).toHaveLength(2));
    expect(fitBounds).toHaveBeenCalledTimes(2);
  });

  // docs/specs/motion.md (MOTION-9, amends this case): the switch is
  // immediate now, with no cross-fade to wait for.
  it("MOTION-9: the placeholders give way to the matches at once, with no cross-fade to wait for", async () => {
    await withAnimations(async () => {
      const { rerenderWith } = renderAlerts();
      const { dialog } = await confirmFrom("Corolla híbrido");
      await userEvent.click(within(dialog).getByRole("button", { name: ALERT_COPY.deleteShort }));
      await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
      // The closing dialog hides the page from assistive tech while it fades.
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      await screen.findByTestId("open-card-loading");

      rerenderWith(
        adaPage({
          alerts: adaAlerts().filter((alert) => alert.id !== ALERT_ID.corolla),
          openAlertId: ALERT_ID.golf,
          matches: golfMatches(),
        }),
      );

      expect(screen.queryByTestId("open-card-loading")).not.toBeInTheDocument();
      expect(listingLinks(openCard("Golf TDI"))).toHaveLength(1);
    });
  });

  it("ALERTUI-35: «Ver las 12 coincidencias» stays hidden until Serie 3 diésel's matches arrive", async () => {
    const { rerenderWith } = renderAlerts(
      adaPage({ alerts: [adaAlert("corolla"), adaAlert("serie3")] }),
    );
    const { dialog } = await confirmFrom("Corolla híbrido");

    await userEvent.click(within(dialog).getByRole("button", { name: ALERT_COPY.deleteShort }));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));

    expect(within(openCard("Serie 3 diésel")).queryByText(/Ver las/)).not.toBeInTheDocument();

    rerenderWith(
      adaPage({
        alerts: [adaAlert("serie3")],
        openAlertId: ALERT_ID.serie3,
        matches: serie3Matches(),
      }),
    );

    // The matches replace the placeholders at once.
    expect(
      await within(openCard("Serie 3 diésel")).findByRole("link", {
        name: "Ver las 12 coincidencias",
      }),
    ).toHaveAttribute("href", `/alerts/${ALERT_ID.serie3}`);
  });
});

// docs/specs/redesign-alerts.md (ALERTUI-17): the pins belong to the open
// alert. Opening another closes the preview and clears the hover, even where
// a pin of the new alert stands on the old preview's point.
describe("ALERTUI-17: the pins when another alert opens", () => {
  it("ALERTUI-17: with the Corolla 125H's preview open, pressing Golf TDI leaves no preview open once Golf's data arrives — its match standing on the 125H's point", async () => {
    const { rerenderWith } = renderAlerts();
    await openPreview(pinName("Toyota Corolla 125H", "16.200"));

    await userEvent.click(foldedCard("Golf TDI"));
    // Golf's match moved onto the 125H's point (Getafe, 40.3057, -3.7327), so
    // its pin has the open preview's key.
    const [golf] = golfMatches();
    rerenderWith(
      adaPage({
        openAlertId: ALERT_ID.golf,
        matches: [{ ...golf, lat: 40.3057, lng: -3.7327 }],
      }),
    );

    await waitFor(() => expect(pinNames()).toEqual([pinName("Volkswagen Golf 2.0 TDI", "13.900")]));
    expect(
      screen.queryByRole("article", { name: /Vista previa del coche|coches · desde/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: pinName("Volkswagen Golf 2.0 TDI", "13.900") }),
    ).not.toHaveAttribute("data-active", "true");
  });
});

// docs/specs/redesign-alerts.md (ALERTUI-6, ALERTUI-9): a folded card is named
// by its alert and described by «En pausa», its count and its criteria, as
// the saved cars' rows are (RULES.md §19).
describe("ALERTUI-6: the folded card's description", () => {
  /** `text` with each space matching any whitespace: the page writes U+00A0 before «km» and «€». */
  function loosely(text: string): RegExp {
    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`^${escaped.replace(/ /g, "\\s")}$`);
  }

  it("ALERTUI-6: Golf TDI, paused, is described by «En pausa», «1 coincidencia» and its criteria line", () => {
    renderAlerts(
      adaPage({
        alerts: adaAlerts().map((alert) => ({ ...alert, active: alert.id !== ALERT_ID.golf })),
      }),
    );

    expect(foldedCard("Golf TDI")).toHaveAccessibleDescription(
      loosely(`En pausa 1 coincidencia ${FOLDED_LINE.golf}`),
    );
  });

  it("ALERTUI-6: Serie 3 diésel, active, is described by «12 coincidencias» and its criteria line", () => {
    renderAlerts();

    expect(foldedCard("Serie 3 diésel")).toHaveAccessibleDescription(
      loosely(`12 coincidencias ${FOLDED_LINE.serie3}`),
    );
  });
});

// docs/specs/redesign-alerts.md (ALERTUI-57; Decisions › Decided 2026-10-16,
// owner): a press on a folded card moves the focus to that card once the
// server's next data has it open; nothing else does.
describe("ALERTUI-57: the focus on the card a press opens", () => {
  it("ALERTUI-57: Tab to Golf TDI's folded card and Enter: once the server's next data has it open, Golf TDI's open card has the focus", async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const { rerenderWith } = renderAlerts(adaPage(), { onUrlUpdate });
    const golf = foldedCard("Golf TDI");
    for (let step = 0; step < 40 && document.activeElement !== golf; step++) {
      await userEvent.tab();
    }
    expect(golf).toHaveFocus();

    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    expect(onUrlUpdate.mock.lastCall?.[0].searchParams.get("alert")).toBe(ALERT_ID.golf);
    rerenderWith(adaPage({ openAlertId: ALERT_ID.golf, matches: golfMatches() }));

    const opened = openCard("Golf TDI");
    expect(opened).toHaveAttribute("tabindex", "-1");
    expect(opened).toHaveFocus();
  });

  it("ALERTUI-57: on a first load the open card does not take the focus", () => {
    renderAlerts();

    expect(openCard("Corolla híbrido")).not.toHaveFocus();
    expect(document.body).toHaveFocus();
  });

  it("ALERTUI-57: after a delete the card opened in its place does not take the focus — «Alertas» has it", async () => {
    const { rerenderWith } = renderAlerts();
    const { dialog } = await confirmFrom("Corolla híbrido");

    await userEvent.click(within(dialog).getByRole("button", { name: ALERT_COPY.deleteShort }));
    rerenderWith(
      adaPage({
        alerts: adaAlerts().filter((alert) => alert.id !== ALERT_ID.corolla),
        openAlertId: ALERT_ID.golf,
        matches: golfMatches(),
      }),
    );

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1, name: ALERT_COPY.title })).toHaveFocus(),
    );
    expect(openCard("Golf TDI")).not.toHaveFocus();
  });
});

describe("ALERTUI-16: the default view after an alert with a zone", () => {
  it("ALERTUI-16: Corolla híbrido open (Madrid, 50 km), then Clio barato with no point and no match: the map goes back to its default view, [40.4168, -3.7038] at MapLibre zoom 5 (Leaflet's 6, MAPLIBRE-3)", async () => {
    const jumpTo = vi.spyOn(MapLibreMap.prototype, "jumpTo");
    const fitBounds = vi.spyOn(MapLibreMap.prototype, "fitBounds");
    const { latitude: _lat, longitude: _lng, ...noPoint } = adaAlert("clio").criteria;
    const alerts = [adaAlert("corolla"), adaAlert("clio", { criteria: noPoint })];
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const { rerenderWith } = renderAlerts(adaPage({ alerts }), { onUrlUpdate });
    await findPin(pinName("Toyota Corolla 125H", "16.200"));
    await waitFor(() => expect(fitBounds).toHaveBeenCalledTimes(1));
    jumpTo.mockClear();

    await userEvent.click(foldedCard("Clio barato"));
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    rerenderWith(adaPage({ alerts, openAlertId: ALERT_ID.clio, matches: [] }));

    await waitFor(() =>
      expect(jumpTo).toHaveBeenCalledWith({ center: [-3.7038, 40.4168], zoom: 5 }),
    );
    expect(fitBounds).toHaveBeenCalledTimes(1);
  });
});

// docs/specs/redesign-alerts.md (ALERTUI-35; Decisions › Values not drawn in
// the design, decided 2026-10-16): the arrival focus a delete on an alert's
// page leaves for /alerts.
describe("ALERTUI-35: arriving on /alerts", () => {
  afterEach(() => {
    takeArrivalFocus();
  });

  it("ALERTUI-35: after a delete on an alert's page, «Alertas» takes the focus as the page mounts", () => {
    focusAlertsOnArrival();

    renderAlerts();

    expect(screen.getByRole("heading", { level: 1, name: ALERT_COPY.title })).toHaveFocus();
  });

  it("ALERTUI-35: with no delete before, nothing takes the focus", () => {
    renderAlerts();

    expect(screen.getByRole("heading", { level: 1, name: ALERT_COPY.title })).not.toHaveFocus();
    expect(document.body).toHaveFocus();
  });
});

describe("ALERTUI-7: five matches on the open card", () => {
  it("ALERTUI-7: Corolla híbrido with five matches shows the four newest and «Ver las 5 coincidencias», a link to /alerts/<Corolla's id>", () => {
    const four = corollaMatches();
    const fifth = {
      ...four[0],
      id: "cochesnet-corolla-5",
      url: "https://www.coches.net/toyota-corolla-5.htm",
    };
    renderAlerts(
      adaPage({
        alerts: [adaAlert("corolla", { matchCount: 5 }), ...adaAlerts().slice(1)],
        matches: [...four, fifth],
      }),
    );
    const corolla = openCard("Corolla híbrido");

    expect(listingLinks(corolla).map((link) => link.getAttribute("href"))).toEqual([
      "https://www.coches.net/toyota-corolla-125h-99.htm",
      "https://es.wallapop.com/item/corolla-2",
      "https://es.wallapop.com/item/corolla-3",
      "https://www.milanuncios.com/toyota-corolla-4.htm",
    ]);
    expect(within(corolla).getByRole("link", { name: "Ver las 5 coincidencias" })).toHaveAttribute(
      "href",
      "/alerts/0199a000-0000-7000-8000-00000000c001",
    );
  });
});
