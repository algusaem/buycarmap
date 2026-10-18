import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import L from "leaflet";
import type { OnUrlUpdateFunction } from "nuqs/adapters/testing";
import { toast } from "sonner";
import { axe } from "vitest-axe";
import { Toaster } from "@/components/Toaster";
import { withAnimations } from "@/test/utils/animations";
import { expectPhotoFocusRing } from "@/test/utils/focus-ring";
import { renderWithI18n } from "@/test/utils/render";
import { card, cardOrder, cards, renderSaved, rowOrder } from "@/test/utils/saved";
import { restoreMatchMedia, stubLayoutBox, stubSwitchableWidth } from "@/test/utils/viewport";
import {
  FAVORITE_INVALID_LISTING,
  FAVORITE_OK,
  FAVORITE_UNAUTHENTICATED,
  type FavoriteActionResult,
  SAVED_COPY,
  unanswered,
} from "@/test/fixtures/favorites";
import {
  makeFavoriteInput,
  makeSortExampleCar,
  SORT_EXAMPLE_ORDER,
  type SortExampleLetter,
  sortExampleFavorites,
} from "@/test/fixtures/favorite-listings";
import { removeFavorite, saveFavorite } from "@/server/favorites/actions";
import { FavoritesList } from "./FavoritesList";

// docs/specs/favorites.md (FAV-13, FAV-14) and docs/specs/redesign-saved.md
// (SAVED) at desktop width, which is jsdom's default: test/setup.jsdom.ts
// stubs matchMedia to match nothing, so useIsPhone reports desktop. The phone
// composition is FavoritesList.phone.test.tsx's.
//
// The saved map is the real ListingsMap on the real Leaflet, as in
// components/map/ListingsMap.preview.test.tsx: its pins, their active state
// and the preview's open and close are Leaflet's own events. jsdom lays
// nothing out, so nothing here asserts a position or a size (SAVED-3,
// SAVED-4 and SAVED-24 are e2e/saved.spec.ts's). The toasts are the real
// Sonner under the app's one Toaster, so «Deshacer» is pressed as a buyer
// presses it.

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  usePathname: () => "/favorites",
  useSearchParams: () => new URLSearchParams(),
}));
// Signed in: the heart's sign-in gate (lib/hooks/useSignInGate.ts) lets the
// press through. The session is not what these tests are about.
interface SessionState {
  data: { user: { id: string; name: string } } | null;
  isPending: boolean;
}
const SIGNED_IN: SessionState = {
  data: { user: { id: "user-ada", name: "Ada" } },
  isPending: false,
};
// Signed in unless a test says otherwise; FAV-18's cases make it still resolving.
const useSession = vi.fn<() => SessionState>(() => SIGNED_IN);
vi.mock("@/lib/auth/auth-client", () => ({
  authClient: { useSession: () => useSession() },
}));
vi.mock("@/server/favorites/actions", () => ({
  saveFavorite: vi.fn(),
  removeFavorite: vi.fn(),
  listFavorites: vi.fn(),
}));
vi.mock("next/image", () => import("@/test/mocks/next-image"));
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_CARTO_API_KEY: undefined } }));
// FAV-13: the search Server Actions (server/search/actions.ts) are the only
// way the browser reaches a listing source (ADR 0016). The factory runs only
// if something the page imports loads them, so `loaded` staying false proves
// no source request can start. The test never imports them itself.
const searchActions = vi.hoisted(() => ({ loaded: false }));
vi.mock("@/server/search/actions", () => {
  searchActions.loaded = true;
  return { searchListings: vi.fn(), listCarModels: vi.fn() };
});

// jsdom has no layout: every element reports a tall box (test/utils/viewport.ts),
// so the virtualised list (SAVED-25) mounts all of these few cars.
stubLayoutBox({ width: 830 });

beforeEach(() => {
  useSession.mockImplementation(() => SIGNED_IN);
  vi.mocked(removeFavorite).mockReset();
  vi.mocked(removeFavorite).mockResolvedValue(FAVORITE_OK);
  vi.mocked(saveFavorite).mockReset();
  vi.mocked(saveFavorite).mockResolvedValue(FAVORITE_OK);
  push.mockClear();
});

afterEach(() => {
  act(() => {
    toast.dismiss();
  });
  vi.restoreAllMocks();
});

// The pins' accessible names, «{title}, {price}» (map.markerLabel), the price
// with the no-break space Intl writes before «€». C and G have no price (0).
const PIN: Record<SortExampleLetter, string> = {
  A: "Audi A3 2.0 TDI, 14.500 €",
  B: "SEAT León 1.5 TSI, 16.500 €",
  C: "Renault Clio TCe 90, 0 €",
  D: "VW Golf 1.6 TDI, 11.900 €",
  E: "Kia Ceed 1.6 CRDi, 14.500 €",
  F: "Mazda MX-5 2.0, 21.500 €",
  G: "Toyota Corolla 125H, 0 €",
};

const RECENT = SORT_EXAMPLE_ORDER.recent;
const PRICE = SORT_EXAMPLE_ORDER.price;
const KM = SORT_EXAMPLE_ORDER.km;

const REMOVED = SAVED_COPY.removed;
const UNDO = SAVED_COPY.undo;
const REMOVE = SAVED_COPY.remove;
const UNEXPECTED = SAVED_COPY.unexpected;

/** The accessible names of every pin on the map, sorted. */
function pinNames(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>(".leaflet-marker-icon"))
    .map((pin) => pin.getAttribute("aria-label") ?? "")
    .sort();
}

/** Waits for the map's pins: the map may load after the list. */
async function findPin(name: string): Promise<HTMLElement> {
  return screen.findByRole("button", { name });
}

async function openPreview(name: string): Promise<HTMLElement> {
  (await findPin(name)).focus();
  await userEvent.keyboard("{Enter}");
  return screen.findByRole("article", { name: /Vista previa del coche|coches · desde/ });
}

function chip(name: "Recientes" | "Precio" | "Km"): HTMLElement {
  return screen.getByRole("button", { name });
}

async function pressHeart(letter: SortExampleLetter) {
  await userEvent.click(within(card(letter)).getByRole("button", { name: REMOVE }));
}

const saved = [
  makeFavoriteInput({ id: "wallapop-abc123", title: "Audi A3 2.0 TDI" }),
  makeFavoriteInput({
    id: "cochesnet-99",
    title: "Seat Leon FR",
    source: "Coches.net",
    price: 11200,
    lat: 41.3874,
    lng: 2.1686,
  }),
];

describe("FavoritesList", () => {
  it("FAV-13: renders every saved listing from stored data alone", async () => {
    renderWithI18n(<FavoritesList favorites={saved} />);

    expect(screen.getByText("Audi A3 2.0 TDI")).toBeInTheDocument();
    expect(screen.getByText("Seat Leon FR")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(2);
    // The whole reason favorites are snapshotted (spec › Decisions and
    // rationale): the page must render with every source unreachable. It
    // cannot reach one at all: nothing it loads imports the search actions.
    expect(searchActions.loaded).toBe(false);
  });

  it("FAV-13: shows the snapshotted price, not a re-fetched one", () => {
    renderWithI18n(<FavoritesList favorites={saved} />);

    // FRONT-11 (docs/specs/core-frontend.md) makes the price locale-aware;
    // renderWithI18n renders English, so formatPrice produces "€11,200".
    expect(screen.getByText(/11,200/)).toBeInTheDocument();
  });

  it("FAV-13: links each saved listing back to its source", () => {
    renderWithI18n(<FavoritesList favorites={[saved[0]]} />);

    // Scoped to the card: the saved map beside it (SAVED-1) carries the
    // tiles' attribution links.
    const link = within(screen.getByRole("article")).getByRole("link");
    expect(link).toHaveAttribute("href", saved[0].url);
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("FAV-14: offers a way back to searching when nothing is saved", () => {
    renderWithI18n(<FavoritesList favorites={[]} />);

    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    // No dead ends: the empty state has to lead somewhere.
    expect(screen.getByRole("link", { name: "Search for cars" })).toHaveAttribute("href", "/map");
  });

  it("FAV-14: has no accessibility violations when empty", async () => {
    const { container } = renderWithI18n(<FavoritesList favorites={[]} />);

    expect(await axe(container)).toHaveNoViolations();
  });

  // FRONT-14 (docs/specs/core-frontend.md): two of the four states —
  // populated and empty-with-a-primary-action — already hold for
  // FavoritesList itself; loading and error are route-level
  // (app/favorites/loading.test.tsx, app/favorites/error.test.tsx), since
  // this component only ever receives already-fetched data as a prop.
  it("FRONT-14: populated shows the saved items", () => {
    renderWithI18n(<FavoritesList favorites={saved} />);

    expect(screen.getAllByRole("article")).toHaveLength(2);
  });

  it("FRONT-14: empty shows written copy and a primary-action link", () => {
    renderWithI18n(<FavoritesList favorites={[]} />);

    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Search for cars" })).toHaveAttribute("href", "/map");
  });

  it("MAPUI-38: renders the redesigned car card — one link per card, the heart outside it", () => {
    renderWithI18n(<FavoritesList favorites={[saved[0]]} />);

    const article = screen.getByRole("article");
    const linksInArticle = screen.getAllByRole("link").filter((link) => article.contains(link));
    expect(linksInArticle).toHaveLength(1);

    const heart = screen.getByRole("button", { name: /Save|Remove from saved/ });
    expect(heart).toBeInTheDocument();
    expect(linksInArticle[0]).not.toContainElement(heart);
  });
});

describe("SAVED-1: the page at desktop width", () => {
  it("SAVED-1: shows the heading «Guardados», the sort chips, the Guardados cards and the map with its pill", async () => {
    renderSaved();

    expect(screen.getByRole("heading", { level: 1, name: "Guardados" })).toBeInTheDocument();
    expect(chip("Recientes")).toBeInTheDocument();
    expect(chip("Precio")).toBeInTheDocument();
    expect(chip("Km")).toBeInTheDocument();
    expect(cards()).toHaveLength(7);
    const map = await screen.findByRole("region", { name: "Mapa de tus guardados" });
    expect(within(map).getByText("Tus guardados en el mapa")).toBeInTheDocument();
  });

  it("SAVED-1: the heading is «Guardados» alone, with no count beside it, and the list offers no link to /map", () => {
    renderSaved();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/^Guardados$/);
    expect(screen.queryByText(/^\(?7\)?$/)).not.toBeInTheDocument();
    const toMap = screen
      .queryAllByRole("link")
      .filter((link) => link.getAttribute("href") === "/map");
    expect(toMap).toEqual([]);
  });
});

describe("SAVED-6: the sort chips", () => {
  it("SAVED-6: are three aria-pressed buttons, «Recientes» pressed with no sort in the URL", () => {
    renderSaved();

    expect(chip("Recientes")).toHaveAttribute("aria-pressed", "true");
    expect(chip("Precio")).toHaveAttribute("aria-pressed", "false");
    expect(chip("Km")).toHaveAttribute("aria-pressed", "false");
    expect(cardOrder()).toEqual(RECENT);
  });

  it("SAVED-6: pressing «Precio» presses it alone and puts the cards in price order — D, E, A, B, F, C, G", async () => {
    renderSaved();

    await userEvent.click(chip("Precio"));

    expect(chip("Precio")).toHaveAttribute("aria-pressed", "true");
    expect(chip("Recientes")).toHaveAttribute("aria-pressed", "false");
    expect(chip("Km")).toHaveAttribute("aria-pressed", "false");
    expect(cardOrder()).toEqual(PRICE);
  });

  it("SAVED-6: pressing «Km» puts the cards in mileage order — G, B, F, C, E, A, D", async () => {
    renderSaved();

    await userEvent.click(chip("Km"));

    expect(chip("Km")).toHaveAttribute("aria-pressed", "true");
    expect(cardOrder()).toEqual(KM);
  });

  it("SAVED-6: a sort does not change the pins", async () => {
    renderSaved();
    await findPin(PIN.A);
    const before = pinNames();
    expect(before).toEqual(Object.values(PIN).sort());

    await userEvent.click(chip("Km"));

    expect(pinNames()).toEqual(before);
  });

  it("SAVED-6: pressing the chip already pressed keeps the order", async () => {
    renderSaved(sortExampleFavorites(), { searchParams: "?sort=price" });

    await userEvent.click(chip("Precio"));

    expect(chip("Precio")).toHaveAttribute("aria-pressed", "true");
    expect(cardOrder()).toEqual(PRICE);
  });
});

describe("SAVED-7: the sort read from and written to the URL", () => {
  it("SAVED-7: /favorites?sort=km opens with «Km» pressed and the cars in that order", () => {
    renderSaved(sortExampleFavorites(), { searchParams: "?sort=km" });

    expect(chip("Km")).toHaveAttribute("aria-pressed", "true");
    expect(cardOrder()).toEqual(KM);
  });

  it.each([
    ["unknown", "?sort=year"],
    ["empty", "?sort="],
  ])("SAVED-7: an %s sort opens as «Recientes», with no error", (_case, searchParams) => {
    renderSaved(sortExampleFavorites(), { searchParams });

    expect(chip("Recientes")).toHaveAttribute("aria-pressed", "true");
    expect(cardOrder()).toEqual(RECENT);
  });

  it("SAVED-7: a chip writes sort=price with a history entry", async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderSaved(sortExampleFavorites(), { onUrlUpdate });

    await userEvent.click(chip("Precio"));

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    const event = onUrlUpdate.mock.lastCall?.[0];
    expect(event?.searchParams.get("sort")).toBe("price");
    expect(event?.options.history).toBe("push");
  });

  it("SAVED-7: pressing «Recientes» from sort=price clears the parameter", async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderSaved(sortExampleFavorites(), { searchParams: "?sort=price", onUrlUpdate });

    await userEvent.click(chip("Recientes"));

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    const event = onUrlUpdate.mock.lastCall?.[0];
    expect(event?.searchParams.has("sort")).toBe(false);
    expect(cardOrder()).toEqual(RECENT);
  });
});

describe("SAVED-9: the Guardados card", () => {
  it("SAVED-9: shows the photo with the source badge and the heart, the name and city, «año · km» without the fuel, and the price with «Ver anuncio»", () => {
    const audi = makeSortExampleCar("A");
    renderSaved([audi]);
    const audiCard = card("A");

    expect(audiCard.querySelector("img")).toHaveAttribute("src", audi.image);
    expect(within(audiCard).getByText("Wallapop")).toBeInTheDocument();
    expect(within(audiCard).getByRole("button", { name: REMOVE })).toBeInTheDocument();
    expect(within(audiCard).getByText("Audi A3 2.0 TDI")).toBeInTheDocument();
    expect(within(audiCard).getByText("Madrid")).toBeInTheDocument();
    // makeFavoriteInput's fuel is "gasoil", which the map card shows as «Diésel».
    expect(within(audiCard).getByText("2018 · 95.000 km")).toBeInTheDocument();
    expect(within(audiCard).queryByText(/Diésel/)).not.toBeInTheDocument();
    const price = within(audiCard).getByText("14.500 €");
    expect(price.parentElement).toHaveTextContent("Ver anuncio");
    expect(audiCard.querySelector(".lucide-arrow-up-right")).not.toBeNull();
  });

  it("SAVED-9: «año · km» shows only the parts that are known", () => {
    renderSaved([makeSortExampleCar("D"), makeSortExampleCar("A", { year: 0 })]);

    // D's km is unknown (0): the year alone. A with no year: the km alone.
    expect(within(card("D")).getByText("2018")).toBeInTheDocument();
    expect(within(card("D")).queryByText(/km/)).not.toBeInTheDocument();
    expect(within(card("A")).getByText("95.000 km")).toBeInTheDocument();
  });

  it("SAVED-9: with no photo it shows the car's tint with the car icon, the badge and heart still over it", () => {
    renderSaved([makeSortExampleCar("A", { image: "" })]);
    const audiCard = card("A");

    expect(audiCard.querySelector("img")).toBeNull();
    expect(audiCard.querySelector(".lucide-car")).not.toBeNull();
    expect(within(audiCard).getByText("Wallapop")).toBeInTheDocument();
    expect(within(audiCard).getByRole("button", { name: REMOVE })).toBeInTheDocument();
  });
});

describe("SAVED-9: a photo that fails to load", () => {
  it("SAVED-9: gives way to the car's tint with the car icon, the badge and the heart still over it", () => {
    renderSaved([makeSortExampleCar("A")]);
    const photo = card("A").querySelector("img");
    expect(photo).not.toBeNull();

    fireEvent.error(photo as HTMLImageElement);

    const audiCard = card("A");
    expect(audiCard.querySelector("img")).toBeNull();
    expect(audiCard.querySelector(".lucide-car")).not.toBeNull();
    expect(within(audiCard).getByText("Wallapop")).toBeInTheDocument();
    expect(within(audiCard).getByRole("button", { name: REMOVE })).toBeInTheDocument();
  });
});

describe("SAVED-10: the card's link and heart", () => {
  it("SAVED-10: the card is one link to the listing in a new tab, with «Ver anuncio» inside it", () => {
    const audi = makeSortExampleCar("A");
    renderSaved([audi]);
    const audiCard = card("A");

    const links = within(audiCard).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", audi.url);
    expect(links[0]).toHaveAttribute("target", "_blank");
    expect(links[0]).toHaveAttribute("rel", "noopener noreferrer");
    expect(links[0]).toHaveTextContent("Ver anuncio");
  });

  it("SAVED-10: the heart is a button outside the link, named «Quitar de guardados»", () => {
    renderSaved([makeSortExampleCar("A")]);
    const audiCard = card("A");

    const heart = within(audiCard).getByRole("button", { name: REMOVE });
    expect(within(audiCard).getByRole("link")).not.toContainElement(heart);
  });
});

describe("SAVED-11: list and map", () => {
  it("SAVED-11: hovering a card marks its pin active, and leaving it clears the mark", async () => {
    renderSaved();
    const pin = await findPin(PIN.A);
    expect(pin).toHaveAttribute("data-active", "false");

    await userEvent.hover(card("A"));
    expect(pin).toHaveAttribute("data-active", "true");

    await userEvent.unhover(card("A"));
    expect(pin).toHaveAttribute("data-active", "false");
  });

  it("SAVED-11: focusing a card's link marks its pin active", async () => {
    renderSaved();
    const pin = await findPin(PIN.B);

    within(card("B")).getByRole("link").focus();

    await waitFor(() => expect(pin).toHaveAttribute("data-active", "true"));
  });

  // docs/specs/redesign-saved.md (SAVED-11, amended 2026-10-18, #134): a
  // card focused with the keyboard showed both the photo's lime ring and the
  // global focus outline around the whole card (MAPUI-61's bug fix also
  // applies here). The photo's ring is the link's own focus indicator, on
  // `group-focus-visible/card`, so the global outline is always suppressed.
  it("SAVED-11: a focused card's link shows only the photo's lime ring, not a second focus outline", () => {
    renderSaved();
    const link = within(card("B")).getByRole("link");

    expectPhotoFocusRing(link);
  });

  it("SAVED-11: activating a pin opens its preview with the heart «Quitar de guardados», marks the pin and outlines its card", async () => {
    renderSaved();

    const preview = await openPreview(PIN.A);

    expect(within(preview).getByText("Audi A3 2.0 TDI")).toBeInTheDocument();
    expect(within(preview).getByRole("button", { name: REMOVE })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: PIN.A })).toHaveAttribute("data-active", "true");
    expect(card("A")).toHaveAttribute("data-active", "true");
    expect(card("B")).not.toHaveAttribute("data-active", "true");
  });

  it("SAVED-11: a grouped pin outlines every card of its group (worked example «Grouped pin»)", async () => {
    // R3-favoritos: the Audi (14.500 €) and the Corolla (19.750 €) saved in Madrid at one point.
    const audi = makeSortExampleCar("A");
    const corolla = makeSortExampleCar("G", {
      price: 19750,
      location: "Madrid",
      lat: audi.lat,
      lng: audi.lng,
    });
    renderSaved([corolla, audi, makeSortExampleCar("B")]);

    const preview = await openPreview("2 coches · desde 14.500 €");

    const names = within(preview)
      .getAllByText(/Audi A3 2.0 TDI|Toyota Corolla 125H/)
      .map((element) => element.textContent);
    expect(names).toEqual(["Audi A3 2.0 TDI", "Toyota Corolla 125H"]);
    expect(within(preview).getAllByRole("button", { name: REMOVE })).toHaveLength(2);
    expect(within(preview).getAllByRole("link", { name: /Ver anuncio/ })).toHaveLength(2);
    expect(card("A")).toHaveAttribute("data-active", "true");
    expect(card("G")).toHaveAttribute("data-active", "true");
    expect(card("B")).not.toHaveAttribute("data-active", "true");
  });
});

describe("SAVED-12: the saved map's pins", () => {
  it("SAVED-12: one pin per saved car with coordinates", async () => {
    renderSaved();
    await findPin(PIN.A);

    expect(pinNames()).toEqual(Object.values(PIN).sort());
  });

  it("SAVED-12: a car without coordinates stays in the list with no pin", async () => {
    renderSaved([
      makeSortExampleCar("A"),
      makeSortExampleCar("B", { lat: Number.NaN, lng: Number.NaN }),
    ]);
    await findPin(PIN.A);

    expect(cardOrder()).toEqual(["A", "B"]);
    expect(pinNames()).toEqual([PIN.A]);
  });

  it("SAVED-12: the pins account for exactly the cars in the list, after a removal and after an undo", async () => {
    renderSaved();
    await findPin(PIN.A);

    await pressHeart("A");
    expect(pinNames()).toEqual(
      Object.values(PIN)
        .filter((name) => name !== PIN.A)
        .sort(),
    );

    await userEvent.click(await screen.findByRole("button", { name: UNDO }));
    await waitFor(() => expect(pinNames()).toEqual(Object.values(PIN).sort()));
  });

  it("SAVED-12: the map fits the pins once on load, and neither a removal nor an undo moves it", async () => {
    const fitBounds = vi.spyOn(L.Map.prototype, "fitBounds");
    renderSaved();
    await findPin(PIN.A);
    expect(fitBounds).toHaveBeenCalledTimes(1);

    await pressHeart("A");
    await userEvent.click(await screen.findByRole("button", { name: UNDO }));
    await findPin(PIN.A);

    expect(fitBounds).toHaveBeenCalledTimes(1);
  });

  it("SAVED-12: the map keeps «Acercar» and «Alejar»", async () => {
    renderSaved();
    const map = await screen.findByRole("region", { name: "Mapa de tus guardados" });

    expect(within(map).getByRole("button", { name: "Acercar" })).toBeInTheDocument();
    expect(within(map).getByRole("button", { name: "Alejar" })).toBeInTheDocument();
  });
});

describe("SAVED-13: the saved map's pill", () => {
  it("SAVED-13: reads «Tus guardados en el mapa», with no role, while there are saved cars", async () => {
    renderSaved();

    const pill = await screen.findByText("Tus guardados en el mapa");
    expect(pill.closest('[role="status"]')).toBeNull();
    expect(screen.queryByText("Aquí saldrán tus guardados")).not.toBeInTheDocument();
  });

  it("SAVED-13: with none it reads «Aquí saldrán tus guardados» as a status", async () => {
    renderSaved([]);

    const pill = await screen.findByText("Aquí saldrán tus guardados");
    expect(pill.closest('[role="status"]')).not.toBeNull();
    expect(screen.queryByText("Tus guardados en el mapa")).not.toBeInTheDocument();
  });
});

describe("SAVED-14: removing a saved car (desktop)", () => {
  it("SAVED-14: the heart removes the card and its pin at once, calls removeFavorite and toasts «Quitado de guardados» with «Deshacer»", async () => {
    // The server never answers here: everything below happens before it does.
    vi.mocked(removeFavorite).mockReturnValue(unanswered());
    renderSaved(sortExampleFavorites(), { searchParams: "?sort=price" });
    await findPin(PIN.A);

    await pressHeart("A");

    expect(cardOrder()).toEqual(["D", "E", "B", "F", "C", "G"]);
    expect(screen.queryByRole("button", { name: PIN.A })).not.toBeInTheDocument();
    expect(removeFavorite).toHaveBeenCalledWith("wallapop-a");
    expect(await screen.findByText(REMOVED)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: UNDO })).toBeInTheDocument();
    // No confirmation: the undo window is the toast (Decisions › Removal with undo).
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("SAVED-14: the «Quitado de guardados» toast is created with an 8-second duration (Edge cases › The removal toast's duration)", async () => {
    // Asserted on the call rather than with fake timers: Sonner's own timers
    // pause while the document is hidden or the toast is hovered, so a clock
    // walked to 7999 ms would test Sonner, not this page's choice.
    const success = vi.spyOn(toast, "success");
    vi.mocked(removeFavorite).mockReturnValue(unanswered());
    renderSaved(sortExampleFavorites(), { searchParams: "?sort=price" });
    await findPin(PIN.A);

    await pressHeart("A");

    expect(success).toHaveBeenCalledWith(REMOVED, expect.objectContaining({ duration: 8000 }));
  });

  it("SAVED-14: the preview's heart removes its car; a single car's preview closes with its pin", async () => {
    renderSaved(sortExampleFavorites(), { searchParams: "?sort=price" });
    const preview = await openPreview(PIN.A);

    await userEvent.click(within(preview).getByRole("button", { name: REMOVE }));

    expect(cardOrder()).toEqual(["D", "E", "B", "F", "C", "G"]);
    expect(removeFavorite).toHaveBeenCalledWith("wallapop-a");
    await waitFor(() =>
      expect(
        screen.queryByRole("article", { name: "Vista previa del coche" }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole("button", { name: PIN.A })).not.toBeInTheDocument();
    expect(await screen.findByText(REMOVED)).toBeInTheDocument();
  });

  it("SAVED-14: removing the Audi from a grouped preview relabels the pin «19.750 €» and leaves the preview open with the Corolla", async () => {
    const audi = makeSortExampleCar("A");
    const corolla = makeSortExampleCar("G", {
      price: 19750,
      location: "Madrid",
      lat: audi.lat,
      lng: audi.lng,
    });
    renderSaved([corolla, audi]);
    const preview = await openPreview("2 coches · desde 14.500 €");

    const [audiHeart] = within(preview).getAllByRole("button", { name: REMOVE });
    await userEvent.click(audiHeart);

    expect(cardOrder()).toEqual(["G"]);
    expect(await findPin("Toyota Corolla 125H, 19.750 €")).toBeInTheDocument();
    const stillOpen = await screen.findByRole("article", { name: "Vista previa del coche" });
    expect(within(stillOpen).getByText("Toyota Corolla 125H")).toBeInTheDocument();
    expect(within(stillOpen).queryByText("Audi A3 2.0 TDI")).not.toBeInTheDocument();
  });
});

/** The removed cars still fading out where they were drawn. */
function leavingEntries(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-leaving]"));
}

/** The element a card fades on: its own wrapper in the list's row. */
function fadeOf(letter: SortExampleLetter): HTMLElement {
  const wrapper = card(letter).parentElement;
  expect(wrapper, "the card's wrapper").not.toBeNull();
  return wrapper as HTMLElement;
}

describe("SAVED-14, SAVED-15: a removed car fades out where it was, and an undone one fades in", () => {
  it("SAVED-14: with «Precio», A's heart leaves A fading out, inert and hidden, while the list is D, E, B, F, C, G at once", async () => {
    renderSaved(sortExampleFavorites(), { searchParams: "?sort=price" });

    await withAnimations(async () => {
      await pressHeart("A");

      const leaving = leavingEntries();
      expect(leaving).toHaveLength(1);
      expect(leaving[0]).toHaveTextContent("Audi A3 2.0 TDI");
      expect(leaving[0]).toHaveAttribute("inert");
      expect(leaving[0]).toHaveAttribute("aria-hidden", "true");
      expect(cardOrder()).toEqual(["D", "E", "B", "F", "C", "G"]);

      await waitFor(() => expect(leavingEntries()).toEqual([]));
    });
  });

  it("SAVED-15: «Deshacer» pressed while A still fades out drops its leaving entry — D, E, A, B, F, C, G", async () => {
    renderSaved(sortExampleFavorites(), { searchParams: "?sort=price" });

    await withAnimations(async () => {
      await pressHeart("A");
      const undo = await screen.findByRole("button", { name: UNDO });
      expect(leavingEntries()).toHaveLength(1);

      await userEvent.click(undo);

      expect(
        leavingEntries().filter((entry) => entry.textContent?.includes("Audi A3 2.0 TDI")),
      ).toEqual([]);
      expect(cardOrder()).toEqual(PRICE);
    });
  });

  it("SAVED-15: the undone car fades in once — a sort that moves it to another row draws it at once", async () => {
    renderSaved(sortExampleFavorites(), { searchParams: "?sort=price" });

    await withAnimations(async () => {
      await pressHeart("A");
      await userEvent.click(await screen.findByRole("button", { name: UNDO }));

      // Back in its place, D, E, A, B, …, still fading in from transparent.
      expect(cardOrder()).toEqual(PRICE);
      expect(Number(fadeOf("A").style.opacity)).toBeLessThan(1);
      await waitFor(() => expect(fadeOf("A").style.opacity).toBe("1"));

      // Two cards a row (jsdom's matchMedia matches nothing): «Precio» puts A
      // in the second row, «Km» (G, B, F, C, E, A, D) in the third, so A is
      // drawn anew there, opaque from its first frame.
      await userEvent.click(chip("Km"));
      expect(cardOrder()).toEqual(KM);
      expect(fadeOf("A").style.opacity).toBe("1");
    });
  });
});

describe("SAVED-15: undoing a removal", () => {
  it("SAVED-15: «Deshacer» calls saveFavorite with the car, which comes back in its place with its pin and its heart saved", async () => {
    const audi = makeSortExampleCar("A");
    renderSaved(sortExampleFavorites(), { searchParams: "?sort=price" });
    await findPin(PIN.A);
    await pressHeart("A");

    await userEvent.click(await screen.findByRole("button", { name: UNDO }));

    expect(saveFavorite).toHaveBeenCalledWith(audi);
    expect(cardOrder()).toEqual(PRICE);
    expect(await findPin(PIN.A)).toBeInTheDocument();
    expect(within(card("A")).getByRole("button", { name: REMOVE })).toBeInTheDocument();
  });

  it("SAVED-15: after a sort change the undone car takes its place under the new sort — G, B, F, C, E, A, D", async () => {
    renderSaved(sortExampleFavorites(), { searchParams: "?sort=price" });
    await pressHeart("A");

    await userEvent.click(chip("Km"));
    expect(cardOrder()).toEqual(["G", "B", "F", "C", "E", "D"]);

    await userEvent.click(await screen.findByRole("button", { name: UNDO }));
    expect(cardOrder()).toEqual(KM);
  });
});

describe("SAVED-16: a removal that fails", () => {
  it("SAVED-16: a removal that throws puts the car back in its place and gives way to «Algo ha salido mal. Inténtalo de nuevo.»", async () => {
    const pending = Promise.withResolvers<FavoriteActionResult>();
    vi.mocked(removeFavorite).mockReturnValue(pending.promise);
    renderSaved(sortExampleFavorites(), { searchParams: "?sort=price" });
    await findPin(PIN.B);

    await pressHeart("B");
    expect(cardOrder()).toEqual(["D", "E", "A", "F", "C", "G"]);
    expect(await screen.findByText(REMOVED)).toBeInTheDocument();

    await act(async () => {
      pending.reject(new Error("connection reset"));
    });

    await waitFor(() => expect(cardOrder()).toEqual(PRICE));
    expect(await findPin(PIN.B)).toBeInTheDocument();
    expect(await screen.findByText(UNEXPECTED)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(REMOVED)).not.toBeInTheDocument());
  });

  it("SAVED-16: a refused removal puts the car back and toasts the refusal's copy", async () => {
    vi.mocked(removeFavorite).mockResolvedValue(FAVORITE_UNAUTHENTICATED);
    renderSaved(sortExampleFavorites(), { searchParams: "?sort=price" });

    await pressHeart("B");

    expect(await screen.findByText("Inicia sesión para guardar coches.")).toBeInTheDocument();
    await waitFor(() => expect(cardOrder()).toEqual(PRICE));
    await waitFor(() => expect(screen.queryByText(REMOVED)).not.toBeInTheDocument());
  });
});

describe("SAVED-17: an undo that fails", () => {
  it("SAVED-17: a refused undo shows the car back at once, then takes it out of the list and the map with «No se pudo guardar ese anuncio.»", async () => {
    const pending = Promise.withResolvers<FavoriteActionResult>();
    vi.mocked(saveFavorite).mockReturnValue(pending.promise);
    renderSaved(sortExampleFavorites(), { searchParams: "?sort=price" });
    await findPin(PIN.A);
    await pressHeart("A");

    await userEvent.click(await screen.findByRole("button", { name: UNDO }));
    expect(cardOrder()).toEqual(PRICE);

    await act(async () => {
      pending.resolve(FAVORITE_INVALID_LISTING);
    });

    await waitFor(() => expect(cardOrder()).toEqual(["D", "E", "B", "F", "C", "G"]));
    expect(screen.queryByRole("button", { name: PIN.A })).not.toBeInTheDocument();
    expect(await screen.findByText("No se pudo guardar ese anuncio.")).toBeInTheDocument();
  });

  it("SAVED-17: an undo that throws ends with the car out, and «Algo ha salido mal. Inténtalo de nuevo.»", async () => {
    vi.mocked(saveFavorite).mockRejectedValue(new Error("connection reset"));
    renderSaved(sortExampleFavorites(), { searchParams: "?sort=price" });
    await pressHeart("A");

    await userEvent.click(await screen.findByRole("button", { name: UNDO }));

    expect(await screen.findByText(UNEXPECTED)).toBeInTheDocument();
    await waitFor(() => expect(cardOrder()).toEqual(["D", "E", "B", "F", "C", "G"]));
  });
});

// docs/specs/redesign-saved.md › Edge cases: narrowing to a phone leaves the
// URL's sort alone, so widening again brings the sort back (SAVED-8).
describe("SAVED-8: narrowing to a phone and widening again", () => {
  afterEach(() => restoreMatchMedia());

  it("SAVED-8: ?sort=price — desktop D, E, A, B, F, C, G; phone C, E, B, D, A, G, F with no chips; desktop D, E, A, B, F, C, G again; the URL never written", async () => {
    const width = stubSwitchableWidth("desktop");
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderSaved(sortExampleFavorites(), { searchParams: "?sort=price", onUrlUpdate });

    expect(cardOrder()).toEqual(["D", "E", "A", "B", "F", "C", "G"]);
    expect(chip("Precio")).toHaveAttribute("aria-pressed", "true");

    act(() => width.switchTo("phone"));

    await waitFor(() => expect(rowOrder()).toEqual(["C", "E", "B", "D", "A", "G", "F"]));
    expect(screen.queryByRole("button", { name: "Recientes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Precio" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Km" })).not.toBeInTheDocument();
    expect(onUrlUpdate).not.toHaveBeenCalled();

    act(() => width.switchTo("desktop"));

    await waitFor(() => expect(cardOrder()).toEqual(["D", "E", "A", "B", "F", "C", "G"]));
    expect(chip("Precio")).toHaveAttribute("aria-pressed", "true");
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });
});

describe("SAVED-18: where focus goes after a removal (desktop)", () => {
  it("SAVED-18: to the next card's link", async () => {
    renderSaved(sortExampleFavorites(), { searchParams: "?sort=price" });

    await pressHeart("A");

    // Precio: D, E, A, B, … — B follows A.
    expect(within(card("B")).getByRole("link")).toHaveFocus();
  });

  it("SAVED-18: to the previous card's link when the removed card was the last", async () => {
    renderSaved(sortExampleFavorites(), { searchParams: "?sort=price" });

    await pressHeart("G");

    // Worked example: «Press G's heart, the last card» → focus on C's link.
    expect(within(card("C")).getByRole("link")).toHaveFocus();
  });

  it("SAVED-18: to the empty state's heading when none is left", async () => {
    renderSaved([makeSortExampleCar("A")]);

    await pressHeart("A");

    // The list fades out before the empty state mounts (SAVED-31, RULES.md §17).
    await waitFor(() => expect(screen.getByRole("heading", { level: 2 })).toHaveFocus());
  });

  it("SAVED-18: from the preview's heart, to the next card's link", async () => {
    renderSaved(sortExampleFavorites(), { searchParams: "?sort=price" });
    const preview = await openPreview(PIN.A);

    await userEvent.click(within(preview).getByRole("button", { name: REMOVE }));

    await waitFor(() => expect(within(card("B")).getByRole("link")).toHaveFocus());
  });
});

describe("SAVED-31: the empty state (desktop)", () => {
  it("SAVED-31: shows «Guardados», «¿Aún nada?» over «Guarda alguno», the desktop line and «Buscar coches» to /map, and no chips", () => {
    renderSaved([]);

    expect(screen.getByRole("heading", { level: 1, name: "Guardados" })).toBeInTheDocument();
    const empty = screen.getByRole("heading", { level: 2 });
    expect(empty).toHaveTextContent("¿Aún nada?");
    expect(empty).toHaveTextContent("Guarda alguno");
    expect(
      screen.getByText(
        "Pulsa el corazón en cualquier coche y aparecerá aquí, con su precio del día.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Pulsa el corazón en cualquier coche y aparecerá aquí."),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Buscar coches" })).toHaveAttribute("href", "/map");
    expect(screen.queryByRole("button", { name: "Recientes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Precio" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Km" })).not.toBeInTheDocument();
  });

  it("SAVED-31: the map shows no pin and the pill «Aquí saldrán tus guardados»", async () => {
    renderSaved([]);

    const map = await screen.findByRole("region", { name: "Mapa de tus guardados" });
    expect(within(map).getByText("Aquí saldrán tus guardados")).toBeInTheDocument();
    expect(pinNames()).toEqual([]);
  });

  it("SAVED-31: removing the last saved car brings the empty state, with «Deshacer» still in the toast", async () => {
    renderSaved([makeSortExampleCar("A")]);

    await pressHeart("A");

    // The list fades out, then the empty state fades in (RULES.md §17).
    await waitFor(() => expect(cards()).toEqual([]));
    expect(await screen.findByRole("heading", { level: 2 })).toHaveTextContent("¿Aún nada?");
    expect(await screen.findByText(REMOVED)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: UNDO })).toBeInTheDocument();
  });
});

/** The toast in front: Sonner stacks the older ones behind it. */
function frontToast(): HTMLElement {
  const front = document.querySelector<HTMLElement>('[data-sonner-toast][data-front="true"]');
  expect(front, "the toast in front").not.toBeNull();
  return front as HTMLElement;
}

describe("SAVED-15: each undo restores only its own car", () => {
  it("SAVED-15: with «Precio», removing A then B, B's «Deshacer» brings back B alone — D, E, B, F, C, G — then A's brings back A — D, E, A, B, F, C, G", async () => {
    renderSaved(sortExampleFavorites(), { searchParams: "?sort=price" });
    await pressHeart("A");
    await pressHeart("B");
    expect(cardOrder()).toEqual(["D", "E", "F", "C", "G"]);
    await waitFor(() => expect(screen.getAllByRole("button", { name: UNDO })).toHaveLength(2));

    // B's toast is the newer one, in front.
    await userEvent.click(within(frontToast()).getByRole("button", { name: UNDO }));

    expect(saveFavorite).toHaveBeenCalledTimes(1);
    expect(saveFavorite).toHaveBeenCalledWith(makeSortExampleCar("B"));
    expect(cardOrder()).toEqual(["D", "E", "B", "F", "C", "G"]);

    await waitFor(() => expect(screen.getAllByRole("button", { name: UNDO })).toHaveLength(1));
    await userEvent.click(within(frontToast()).getByRole("button", { name: UNDO }));

    expect(saveFavorite).toHaveBeenLastCalledWith(makeSortExampleCar("A"));
    expect(cardOrder()).toEqual(["D", "E", "A", "B", "F", "C", "G"]);
  });
});

describe("FAV-18: on /favorites while the session is still resolving", () => {
  it("FAV-18: pressing A's heart does nothing — no removal, the order unchanged, no toast and no sign-in redirect", async () => {
    useSession.mockImplementation(() => ({ data: null, isPending: true }));
    renderSaved();

    await pressHeart("A");
    await act(async () => {
      // Lets any toast or redirect the press might have scheduled land.
    });

    expect(removeFavorite).not.toHaveBeenCalled();
    expect(cardOrder()).toEqual(["C", "E", "B", "D", "A", "G", "F"]);
    expect(screen.queryByText(REMOVED)).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("SAVED-16, edge cases: «Deshacer» pressed before the removal answers", () => {
  it("SAVED-16: the undo succeeds, then the removal throws — the car stays, in PRICE order, with no error toast", async () => {
    const removal = Promise.withResolvers<FavoriteActionResult>();
    vi.mocked(removeFavorite).mockReturnValue(removal.promise);
    renderSaved(sortExampleFavorites(), { searchParams: "?sort=price" });
    await pressHeart("A");

    await userEvent.click(await screen.findByRole("button", { name: UNDO }));
    expect(saveFavorite).toHaveBeenCalledWith(makeSortExampleCar("A"));
    expect(cardOrder()).toEqual(PRICE);

    await act(async () => {
      removal.reject(new Error("connection reset"));
    });

    expect(cardOrder()).toEqual(PRICE);
    expect(screen.queryByText(UNEXPECTED)).not.toBeInTheDocument();
  });

  it("SAVED-16: with the undo held, the removal answers OK and then the undo does — PRICE order, no error toast", async () => {
    const removal = Promise.withResolvers<FavoriteActionResult>();
    const save = Promise.withResolvers<FavoriteActionResult>();
    vi.mocked(removeFavorite).mockReturnValue(removal.promise);
    vi.mocked(saveFavorite).mockReturnValue(save.promise);
    renderSaved(sortExampleFavorites(), { searchParams: "?sort=price" });
    await pressHeart("A");
    await userEvent.click(await screen.findByRole("button", { name: UNDO }));

    await act(async () => {
      removal.resolve(FAVORITE_OK);
    });
    expect(cardOrder()).toEqual(PRICE);
    await act(async () => {
      save.resolve(FAVORITE_OK);
    });

    expect(cardOrder()).toEqual(PRICE);
    expect(screen.queryByText(UNEXPECTED)).not.toBeInTheDocument();
  });

  it("SAVED-14, edge cases: leaving /favorites dismisses its «Quitado de guardados» toast", async () => {
    vi.mocked(removeFavorite).mockReturnValue(unanswered());
    const { rerender } = renderSaved(sortExampleFavorites(), { searchParams: "?sort=price" });
    await pressHeart("A");
    expect(await screen.findByText(REMOVED)).toBeInTheDocument();

    // The list goes, the app's Toaster stays: the page was left.
    rerender(<Toaster />);

    await waitFor(() => expect(screen.queryByText(REMOVED)).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: UNDO })).not.toBeInTheDocument();
  });
});
