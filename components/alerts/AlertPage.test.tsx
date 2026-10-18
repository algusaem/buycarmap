import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import L from "leaflet";
import { toast } from "sonner";
import { axe } from "vitest-axe";
import {
  byWholeText,
  guardadosCards,
  isOutlined,
  listingLinks,
  pinNames,
  renderAlert,
  zonePaths,
} from "@/test/utils/alerts";
import { expectPhotoFocusRing } from "@/test/utils/focus-ring";
import { stubLayoutBox } from "@/test/utils/viewport";
import {
  ALERT_COPY,
  ALERT_ID,
  alertWithMatches,
  corollaMatches,
  DELETE_OK,
  DELETE_UNAUTHENTICATED,
  serie3Matches,
  serie3Title,
} from "@/test/fixtures/alert-listings";
import { FAVORITE_OK, FAVORITE_INVALID_LISTING } from "@/test/fixtures/favorites";
import { deleteAlert } from "@/server/alerts/actions";
import { listFavorites, removeFavorite, saveFavorite } from "@/server/favorites/actions";

// docs/specs/redesign-alerts.md (ALERTUI) for /alerts/[id] at desktop width
// (jsdom's default: no media query matches). The phone composition is
// AlertPage.phone.test.tsx's. The map is the real ListingsMap on the real
// Leaflet, as in AlertsPage.test.tsx; the cards are the Guardados card
// (components/favorites/SavedCard.tsx), whose heart here follows the
// buyer's favorites (ALERTUI-18) instead of removing.

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  usePathname: () => "/alerts/0199a000-0000-7000-8000-00000000c001",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: "user-ada", name: "Ada" } }, isPending: false }),
  },
}));
vi.mock("@/server/favorites/actions", () => ({
  saveFavorite: vi.fn(),
  removeFavorite: vi.fn(),
  listFavorites: vi.fn(),
}));
vi.mock("@/server/alerts/actions", () => ({ deleteAlert: vi.fn(), createAlert: vi.fn() }));
vi.mock("next/image", () => import("@/test/mocks/next-image"));
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_CARTO_API_KEY: undefined } }));
const searchActions = vi.hoisted(() => ({ loaded: false }));
vi.mock("@/server/search/actions", () => {
  searchActions.loaded = true;
  return { searchListings: vi.fn(), listCarModels: vi.fn() };
});

// Every element reports a tall box, so the virtualised grid mounts all of these few cards.
stubLayoutBox({ width: 830 });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-15T12:00:00.000Z"));
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
});

afterEach(() => {
  act(() => {
    toast.dismiss();
  });
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const NBSP = " ";

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

function cardOf(title: string): HTMLElement {
  const card = guardadosCards().find((article) => article.textContent?.includes(title));
  expect(card, `the card of ${title}`).toBeDefined();
  return card as HTMLElement;
}

function follows(first: Element, second: Element): boolean {
  return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
}

/** Opens the confirmation for the alert named `name`, the page's own. */
async function confirm(name: string): Promise<{ opener: HTMLElement; dialog: HTMLElement }> {
  const opener = screen.getByRole("button", { name: ALERT_COPY.delete });
  await userEvent.click(opener);
  const dialog = await screen.findByRole("alertdialog", { name: ALERT_COPY.confirmTitle(name) });
  return { opener, dialog };
}

describe("ALERTUI-20: /alerts/[id] at desktop width", () => {
  it("ALERTUI-20: shows «Volver» to /alerts and the name (h1), the chips, «Creada el …», the count (h2, in capitals), every match newest first as a Guardados card, then «Eliminar alerta»", async () => {
    renderAlert(alertWithMatches("corolla"));

    const back = screen.getByRole("link", { name: ALERT_COPY.back });
    expect(back).toHaveAttribute("href", "/alerts");
    const heading = screen.getByRole("heading", { level: 1, name: "Corolla híbrido" });
    const firstChip = screen.getByText("Toyota Corolla");
    const created = screen.getByText("Creada el 2 de octubre");
    const count = screen.getByRole("heading", { level: 2, name: "4 coincidencias" });
    expect(count).toHaveClass("uppercase");
    const cards = guardadosCards();
    expect(cards.map((card) => within(card).getByRole("link").getAttribute("href"))).toEqual(
      corollaMatches().map((match) => match.url),
    );
    const remove = screen.getByRole("button", { name: ALERT_COPY.delete });
    const order = [back, heading, firstChip, created, count, cards[0], remove];
    for (let index = 1; index < order.length; index++) {
      expect(follows(order[index - 1], order[index]), `element ${index} in order`).toBe(true);
    }
    expect(await screen.findByRole("region", { name: ALERT_COPY.mapLabel })).toBeInTheDocument();
  });

  it("ALERTUI-20: the chips are the criteria of ALERTUI-5 — Toyota Corolla, Híbrido, Hasta 18.000 €, Madrid · 50 km", () => {
    renderAlert(alertWithMatches("corolla"));
    // The chips row: the map's pill repeats «Madrid · 50 km» (ALERTUI-15).
    const chips = screen.getByText("Toyota Corolla").closest("ul") as HTMLElement;

    for (const chip of [
      "Toyota Corolla",
      "Híbrido",
      `Hasta 18.000${NBSP}€`,
      `Madrid · 50${NBSP}km`,
    ]) {
      byWholeText(chips, chip);
    }
  });

  it("ALERTUI-20: a chip longer than the row is cut to one line with «…», its whole text still in the page", () => {
    const long = "San Sebastián de los Reyes, Comunidad de Madrid";
    renderAlert(alertWithMatches("corolla", { placeName: long }));
    const chips = screen.getByText("Toyota Corolla").closest("ul") as HTMLElement;

    const chip = byWholeText(chips, `${long} · 50${NBSP}km`);
    expect(chip.tagName).toBe("LI");
    expect(chip).toHaveClass("truncate", "max-w-full", "min-w-0");
  });

  it("ALERTUI-20: each Guardados card's heart follows the favorites — «Guardar» for a match not saved", () => {
    renderAlert(alertWithMatches("corolla"));

    expect(
      within(cardOf("Toyota Corolla 125H")).getByRole("button", { name: ALERT_COPY.save }),
    ).toBeInTheDocument();
  });
});

describe("ALERTUI-33 on /alerts/[id]: the title names the alert", () => {
  it("ALERTUI-33: «Eliminar alerta» opens «¿Eliminar «Corolla híbrido»?», the dialog's accessible name", async () => {
    renderAlert(alertWithMatches("corolla"));

    const { dialog } = await confirm("Corolla híbrido");

    expect(dialog).toHaveAccessibleName("¿Eliminar «Corolla híbrido»?");
    expect(within(dialog).getByText("¿Eliminar «Corolla híbrido»?")).toBeInTheDocument();
  });
});

describe("ALERTUI-14 to ALERTUI-17 on /alerts/[id]", () => {
  it("ALERTUI-14: with a place, the zone's circle and dot, aria-hidden; with none, neither", async () => {
    const { unmount } = renderAlert(alertWithMatches("corolla"));
    await findPin(pinName("Toyota Corolla 125H", "16.200"));
    await waitFor(() => expect(zonePaths()).toHaveLength(2));
    for (const path of zonePaths()) expect(path).toHaveAttribute("aria-hidden", "true");
    unmount();

    renderAlert(alertWithMatches("serie3"));
    await findPin(`2 coches · desde 17.900${NBSP}€`);
    expect(zonePaths()).toHaveLength(0);
  });

  it("ALERTUI-15: the pill reads «Corolla híbrido · Madrid · 50 km», the zone in lime, with no role", async () => {
    renderAlert(alertWithMatches("corolla"));
    const map = await screen.findByRole("region", { name: ALERT_COPY.mapLabel });

    const pill = byWholeText(map, `Corolla híbrido · Madrid · 50${NBSP}km`);
    expect(pill.closest('[role="status"]')).toBeNull();
    expect(byWholeText(pill, `Madrid · 50${NBSP}km`)).toHaveClass("text-lime");
  });

  it("ALERTUI-16: one pin per match — eleven for Serie 3's twelve, two sharing «2 coches · desde 17.900 €»", async () => {
    renderAlert(alertWithMatches("serie3"));
    await findPin(`2 coches · desde 17.900${NBSP}€`);

    expect(pinNames()).toHaveLength(11);
  });

  it("ALERTUI-16: the map fits the zone and every pin once", async () => {
    const fitBounds = vi.spyOn(L.Map.prototype, "fitBounds");
    renderAlert(alertWithMatches("corolla"));
    await findPin(pinName("Toyota Corolla 125H", "16.200"));

    await waitFor(() => expect(fitBounds).toHaveBeenCalledTimes(1));
    const fitted = fitBounds.mock.calls[0][0];
    const bounds =
      fitted instanceof L.LatLngBounds ? fitted : L.latLngBounds(fitted as L.LatLngExpression[]);
    // Madrid's 50 km circle: about 0.449° of latitude and 0.590° of longitude.
    expect(bounds.contains([40.4168 + 0.44, -3.7038])).toBe(true);
    expect(bounds.contains([40.4168, -3.7038 - 0.58])).toBe(true);
    for (const match of corollaMatches())
      expect(bounds.contains([match.lat, match.lng])).toBe(true);
  });

  it("ALERTUI-16: with a zone and no pin the map fits the zone alone — Clio barato", async () => {
    const fitBounds = vi.spyOn(L.Map.prototype, "fitBounds");
    renderAlert(alertWithMatches("clio"));
    await screen.findByRole("region", { name: ALERT_COPY.mapLabel });

    await waitFor(() => expect(fitBounds).toHaveBeenCalledTimes(1));
    const fitted = fitBounds.mock.calls[0][0];
    const bounds =
      fitted instanceof L.LatLngBounds ? fitted : L.latLngBounds(fitted as L.LatLngExpression[]);
    // The zone's bounds (components/map/ZoneLayers.tsx's zoneBounds, Leaflet's
    // toBounds of 2 × 50 km): ±180 × 100 000 / 40 075 017 ≈ ±0.449° of
    // latitude, and 0.449° / cos 40.4168° ≈ ±0.590° of longitude, around
    // Madrid's 40.4168, -3.7038. The points 0.44° and 0.58° out lie inside.
    for (const point of [
      [40.8568, -3.7038],
      [39.9768, -3.7038],
      [40.4168, -4.2838],
      [40.4168, -3.1238],
    ] satisfies L.LatLngTuple[]) {
      expect(bounds.contains(point), point.join(", ")).toBe(true);
    }
    expect(bounds.contains([41.3874, 2.1686]), "Barcelona").toBe(false);
  });

  it("ALERTUI-16: a match without coordinates is listed with no pin — four cards, three pins", async () => {
    const [first, ...rest] = corollaMatches();
    renderAlert(
      alertWithMatches("corolla", {
        matches: [first, ...rest.slice(0, 2), { ...rest[2], lat: Number.NaN, lng: Number.NaN }],
      }),
    );
    await findPin(pinName("Toyota Corolla 125H", "16.200"));

    expect(guardadosCards()).toHaveLength(4);
    expect(cardOf("Toyota Corolla 2.0 Hybrid")).toBeInTheDocument();
    await waitFor(() => expect(pinNames()).toHaveLength(3));
    expect(pinNames().some((name) => name.startsWith("Toyota Corolla 2.0 Hybrid"))).toBe(false);
  });

  it("ALERTUI-17: hovering a Guardados card marks its pin active", async () => {
    renderAlert(alertWithMatches("corolla"));
    const pin = await findPin(pinName("Toyota Corolla 125H", "16.200"));

    await userEvent.hover(cardOf("Toyota Corolla 125H"));

    expect(pin).toHaveAttribute("data-active", "true");
  });

  it("ALERTUI-17: focusing a Guardados card's link marks its pin active", async () => {
    renderAlert(alertWithMatches("corolla"));
    const pin = await findPin(pinName("Toyota Corolla 125H", "16.200"));

    listingLinks(cardOf("Toyota Corolla 125H"))[0].focus();

    await waitFor(() => expect(pin).toHaveAttribute("data-active", "true"));
  });

  it("ALERTUI-17: activating a grouped pin outlines both cards of its group, and no other", async () => {
    renderAlert(alertWithMatches("serie3"));

    await openPreview(`2 coches · desde 17.900${NBSP}€`);

    expect(isOutlined(cardOf(serie3Title(1)))).toBe(true);
    expect(isOutlined(cardOf(serie3Title(2)))).toBe(true);
    expect(isOutlined(cardOf(serie3Title(3)))).toBe(false);
  });

  // docs/specs/redesign-alerts.md (ALERTUI-17, amended 2026-10-18, #134):
  // /alerts/[id] renders its matches with SavedCard (components/favorites/
  // SavedCard.tsx), via SavedList; the photo's ring is that link's own focus
  // indicator, on `group-focus-visible/card`, so the global outline is
  // always suppressed (SAVED-11's bug fix applies here too).
  it("ALERTUI-17: a focused match card shows only its photo ring", () => {
    renderAlert(alertWithMatches("corolla"));
    const [link] = listingLinks(cardOf("Toyota Corolla 125H"));

    expectPhotoFocusRing(link);
  });
});

describe("ALERTUI-18: the saved state of a match (worked example «Saved state», bug fix)", () => {
  it("ALERTUI-18: cochesnet-99, saved from /map, reads «Quitar de guardados», filled violet, on its card and in its preview; pressing the card's calls removeFavorite and both read «Guardar»", async () => {
    vi.mocked(listFavorites).mockResolvedValue({ ok: true, value: [corollaMatches()[0]] });
    renderAlert(alertWithMatches("corolla"));
    const card = cardOf("Toyota Corolla 125H");

    const heart = await within(card).findByRole("button", { name: ALERT_COPY.unsave });
    expect(heart).toHaveClass("bg-violet");
    const preview = await openPreview(pinName("Toyota Corolla 125H", "16.200"));
    expect(within(preview).getByRole("button", { name: ALERT_COPY.unsave })).toBeInTheDocument();

    // The card's heart is a press outside the preview, which closes it (MAPUI-27).
    await userEvent.click(heart);

    expect(removeFavorite).toHaveBeenCalledTimes(1);
    expect(removeFavorite).toHaveBeenCalledWith("cochesnet-99");
    expect(within(card).getByRole("button", { name: ALERT_COPY.save })).toBeInTheDocument();
    const reopened = await openPreview(pinName("Toyota Corolla 125H", "16.200"));
    expect(within(reopened).getByRole("button", { name: ALERT_COPY.save })).toBeInTheDocument();
    // The heart toggles: the card stays in the list.
    expect(guardadosCards()).toHaveLength(4);
  });

  it("ALERTUI-18: «Guardar» on a card saves its listing, and the card and the preview read «Quitar de guardados»", async () => {
    renderAlert(alertWithMatches("corolla"));
    const card = cardOf("Toyota Corolla 1.8 Hybrid Active");

    await userEvent.click(within(card).getByRole("button", { name: ALERT_COPY.save }));

    expect(saveFavorite).toHaveBeenCalledTimes(1);
    expect(vi.mocked(saveFavorite).mock.calls[0][0]).toMatchObject({ id: "wallapop-corolla-2" });
    expect(within(card).getByRole("button", { name: ALERT_COPY.unsave })).toBeInTheDocument();
    const preview = await openPreview(pinName("Toyota Corolla 1.8 Hybrid Active", "17.900"));
    expect(within(preview).getByRole("button", { name: ALERT_COPY.unsave })).toBeInTheDocument();
  });
});

describe("ALERTUI-19: a save that fails on /alerts/[id]", () => {
  it("ALERTUI-19 / FAV-11: a refused save puts the heart back and toasts the refusal's copy, «No se pudo guardar ese anuncio.»", async () => {
    vi.mocked(saveFavorite).mockResolvedValue(FAVORITE_INVALID_LISTING);
    renderAlert(alertWithMatches("corolla"));
    const card = cardOf("Toyota Corolla 125H");

    await userEvent.click(within(card).getByRole("button", { name: ALERT_COPY.save }));

    expect(await screen.findByText("No se pudo guardar ese anuncio.")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: ALERT_COPY.save })).toBeInTheDocument();
  });

  it("ALERTUI-19 / FAV-11: a removal that throws puts the heart back saved and toasts «Algo ha salido mal. Inténtalo de nuevo.»", async () => {
    vi.mocked(listFavorites).mockResolvedValue({ ok: true, value: [corollaMatches()[0]] });
    vi.mocked(removeFavorite).mockRejectedValue(new Error("network down"));
    renderAlert(alertWithMatches("corolla"));
    const card = cardOf("Toyota Corolla 125H");
    const heart = await within(card).findByRole("button", { name: ALERT_COPY.unsave });

    await userEvent.click(heart);

    expect(await screen.findByText(ALERT_COPY.unexpected)).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: ALERT_COPY.unsave })).toBeInTheDocument();
  });
});

describe("ALERTUI-33: the confirmation from «Eliminar alerta»", () => {
  it("ALERTUI-33: opens the centred alertdialog with «Eliminar» and «Cancelar», no handle and no «×», focus on «Cancelar»", async () => {
    renderAlert(alertWithMatches("corolla"));

    const { dialog } = await confirm("Corolla híbrido");

    expect(
      within(dialog).getByRole("button", { name: ALERT_COPY.deleteShort }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: ALERT_COPY.cancel })).toHaveFocus(),
    );
    expect(within(dialog).queryByRole("button", { name: ALERT_COPY.close })).toBeNull();
    expect(dialog.querySelector("[data-sheet-handle]")).toBeNull();
  });

  it("ALERTUI-33: «Cancelar» closes it with deleteAlert not called, and focus returns to «Eliminar alerta» (worked example «Delete»)", async () => {
    renderAlert(alertWithMatches("corolla"));
    const { opener, dialog } = await confirm("Corolla híbrido");

    await userEvent.click(within(dialog).getByRole("button", { name: ALERT_COPY.cancel }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
    expect(deleteAlert).not.toHaveBeenCalled();
  });

  it("ALERTUI-33: Escape and a press outside close it with nothing sent", async () => {
    renderAlert(alertWithMatches("corolla"));
    const { opener } = await confirm("Corolla híbrido");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(opener).toHaveFocus();

    await confirm("Corolla híbrido");
    fireEvent.pointerDown(document.body);
    fireEvent.pointerUp(document.body);
    fireEvent.click(document.body);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
    expect(deleteAlert).not.toHaveBeenCalled();
  });
});

describe("ALERTUI-35: deleting from /alerts/[id]", () => {
  it("ALERTUI-35: «Eliminar» calls deleteAlert(<Corolla's id>) once, then replaces the alert page's history entry with /alerts, with no toast", async () => {
    renderAlert(alertWithMatches("corolla"));
    const { dialog } = await confirm("Corolla híbrido");

    await userEvent.click(within(dialog).getByRole("button", { name: ALERT_COPY.deleteShort }));

    expect(deleteAlert).toHaveBeenCalledTimes(1);
    expect(deleteAlert).toHaveBeenCalledWith(ALERT_ID.corolla);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/alerts"));
    expect(push).not.toHaveBeenCalled();
    expect(document.querySelector("[data-sonner-toast]")).toBeNull();
  });

  it("ALERTUI-35: while it runs, «Eliminar» shows a spinner, keeps its label and is disabled", async () => {
    vi.mocked(deleteAlert).mockReturnValue(
      new Promise(() => {
        // Intentionally left pending: the delete never answers.
      }),
    );
    renderAlert(alertWithMatches("corolla"));
    const { dialog } = await confirm("Corolla híbrido");
    const button = within(dialog).getByRole("button", { name: ALERT_COPY.deleteShort });

    await userEvent.click(button);

    expect(button).toBeDisabled();
    expect(button).toHaveTextContent(ALERT_COPY.deleteShort);
    expect(button.querySelector(".animate-spin")).not.toBeNull();
  });
});

describe("ALERTUI-36: a delete that fails on /alerts/[id]", () => {
  it("ALERTUI-36: a throw closes the confirmation, stays on the page, toasts «Algo ha salido mal. Inténtalo de nuevo.» and returns focus to «Eliminar alerta»", async () => {
    vi.mocked(deleteAlert).mockRejectedValue(new Error("connection refused"));
    renderAlert(alertWithMatches("corolla"));
    const { opener, dialog } = await confirm("Corolla híbrido");

    await userEvent.click(within(dialog).getByRole("button", { name: ALERT_COPY.deleteShort }));

    expect(await screen.findByText(ALERT_COPY.unexpected)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(replace).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(opener).toHaveFocus();
  });

  it("ALERTUI-36: a refusal with unauthenticated toasts «Inicia sesión para gestionar tus alertas.»", async () => {
    vi.mocked(deleteAlert).mockResolvedValue(DELETE_UNAUTHENTICATED);
    renderAlert(alertWithMatches("corolla"));
    const { opener, dialog } = await confirm("Corolla híbrido");

    await userEvent.click(within(dialog).getByRole("button", { name: ALERT_COPY.deleteShort }));

    expect(await screen.findByText(ALERT_COPY.unauthenticated)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    expect(opener).toHaveFocus();
  });
});

describe("ALERTUI-41: an alert with no match on /alerts/[id]", () => {
  it("ALERTUI-41: «Sin coincidencias» is the section heading, then «Te avisaremos …», then «Eliminar alerta»; the map shows the zone and the pill and no pin", async () => {
    renderAlert(alertWithMatches("clio"));

    const heading = screen.getByRole("heading", { level: 2, name: "Sin coincidencias" });
    const line = screen.getByText(ALERT_COPY.noMatchesYet);
    const remove = screen.getByRole("button", { name: ALERT_COPY.delete });
    expect(follows(heading, line)).toBe(true);
    expect(follows(line, remove)).toBe(true);
    expect(guardadosCards()).toEqual([]);
    const map = await screen.findByRole("region", { name: ALERT_COPY.mapLabel });
    byWholeText(map, `Clio barato · 50${NBSP}km`);
    await waitFor(() => expect(zonePaths()).toHaveLength(2));
    expect(pinNames()).toEqual([]);
  });
});

// docs/specs/alerts.md (ALERT-39, ALERT-40), redesign-map.md (MAPUI-38) and
// core-frontend.md (FRONT-14), amended 2026-10-15 by redesign-alerts.md:
// moved here from components/alerts/AlertMatchesList.test.tsx with the page
// they test.
describe("ALERT-39, ALERT-40, MAPUI-38 and FRONT-14 on the redesigned /alerts/[id]", () => {
  it("ALERT-39: renders every match, newest first, from its snapshot, with no request to any source", () => {
    // The grid is virtualised: each row reports the desktop row's 300px while
    // the view stays 4000px tall, so all six rows of two fit and every one of
    // the 12 is mounted.
    const boxHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get(this: HTMLElement) {
        return this.hasAttribute("data-index") ? 300 : 4000;
      },
    });
    try {
      renderAlert(alertWithMatches("serie3"));

      expect(
        guardadosCards().map((card) => within(card).getByRole("link").getAttribute("href")),
      ).toEqual(serie3Matches().map((match) => match.url));
      expect(searchActions.loaded).toBe(false);
    } finally {
      if (boxHeight) Object.defineProperty(HTMLElement.prototype, "offsetHeight", boxHeight);
    }
  });

  it("ALERT-39: shows the price each match was found at", () => {
    renderAlert(alertWithMatches("corolla"));

    expect(within(cardOf("Toyota Corolla 125H")).getByText("16.200 €")).toBeInTheDocument();
  });

  it("ALERT-40: an alert that has found nothing says it is watching, under its name", () => {
    renderAlert(alertWithMatches("clio"));

    expect(screen.getByRole("heading", { level: 1, name: "Clio barato" })).toBeInTheDocument();
    expect(screen.getByText(ALERT_COPY.noMatchesYet)).toBeInTheDocument();
  });

  it("MAPUI-38: at desktop width each match is the Guardados card — one link to the listing in a new tab, the heart outside it", () => {
    renderAlert(alertWithMatches("corolla"));
    const card = cardOf("Toyota Corolla 125H");
    const link = within(card).getByRole("link");

    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    const heart = within(card).getByRole("button", { name: ALERT_COPY.save });
    expect(link.contains(heart)).toBe(false);
    expect(within(link).getByText(ALERT_COPY.viewListing)).toBeInTheDocument();
  });

  it("FRONT-14: populated shows the matches", () => {
    renderAlert(alertWithMatches("corolla"));

    expect(guardadosCards()).toHaveLength(4);
  });

  it("FRONT-14: empty shows written copy and a way on — «Volver» to /alerts and «Eliminar alerta»", () => {
    renderAlert(alertWithMatches("clio"));

    expect(screen.getByText(ALERT_COPY.noMatchesYet)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: ALERT_COPY.back })).toHaveAttribute("href", "/alerts");
    expect(screen.getByRole("button", { name: ALERT_COPY.delete })).toBeInTheDocument();
  });

  it("ALERT-40: has no accessibility violations when empty", async () => {
    const { container } = renderAlert(alertWithMatches("clio"));
    await screen.findByRole("region", { name: ALERT_COPY.mapLabel });

    expect(await axe(container)).toHaveNoViolations();
  });
});

// FAV-10, moved here from components/map/CarListingCard.test.tsx when F6
// removed that card (docs/specs/redesign-alerts.md, Contracts › Client): an
// alert's match is now saved from the Guardados card, whose heart flips at
// once, before the server has answered.
describe("FAV-10 on /alerts/[id]", () => {
  it("FAV-10: the heart flips before the save has come back", async () => {
    vi.mocked(saveFavorite).mockReturnValue(
      new Promise(() => {
        // Intentionally left pending: the assertion is about the request in flight.
      }),
    );
    renderAlert(alertWithMatches("corolla"));
    const card = cardOf("Toyota Corolla 125H");

    await userEvent.click(within(card).getByRole("button", { name: ALERT_COPY.save }));

    expect(within(card).getByRole("button", { name: ALERT_COPY.unsave })).toBeInTheDocument();
    expect(vi.mocked(saveFavorite).mock.calls[0][0]).toMatchObject({ id: "cochesnet-99" });
  });
});
