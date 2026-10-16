import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import L from "leaflet";
import { toast } from "sonner";
import { TabBar } from "@/components/nav/TabBar";
import { renderWithI18n } from "@/test/utils/render";
import { byWholeText, matchRow, renderAlert, zonePaths } from "@/test/utils/alerts";
import { rows } from "@/test/utils/saved";
import { restoreMatchMedia, stubLayoutBox, stubPhoneWidth } from "@/test/utils/viewport";
import {
  ALERT_COPY,
  ALERT_ID,
  alertWithMatches,
  corollaMatches,
  DELETE_OK,
} from "@/test/fixtures/alert-listings";
import { FAVORITE_OK, FAVORITE_UNAUTHENTICATED } from "@/test/fixtures/favorites";
import { deleteAlert } from "@/server/alerts/actions";
import { listFavorites, removeFavorite, saveFavorite } from "@/server/favorites/actions";

// docs/specs/redesign-alerts.md (ALERTUI-22 to ALERTUI-26, ALERTUI-34,
// ALERTUI-35, ALERTUI-41) for /alerts/[id] at phone width: the alert's name,
// its criteria and date, the static zone map, the compact rows and the car
// sheet, and «Eliminar alerta» with its confirmation sheet. The phone
// header's «Volver» is components/nav/SiteHeader.test.tsx's; the sizes, the
// drag and the virtualised list are e2e/alerts-ui.spec.ts's.

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

stubLayoutBox({ width: 390 });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-15T12:00:00.000Z"));
  stubPhoneWidth();
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
  restoreMatchMedia();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const NBSP = " ";

function follows(first: Element, second: Element): boolean {
  return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
}

async function openSheet(title: string): Promise<HTMLElement> {
  await userEvent.click(matchRow(title));
  return screen.findByRole("dialog", { name: title });
}

/** Opens the confirmation sheet for the alert named `name`, the page's own. */
async function openConfirmation(
  name: string,
): Promise<{ opener: HTMLElement; sheet: HTMLElement }> {
  const opener = screen.getByRole("button", { name: ALERT_COPY.delete });
  await userEvent.click(opener);
  const sheet = await screen.findByRole("alertdialog", { name: ALERT_COPY.confirmTitle(name) });
  return { opener, sheet };
}

describe("ALERTUI-22: /alerts/[id] at phone width", () => {
  it("ALERTUI-22: shows the name (h1), the chips, «Creada el …», the zone, the count (h2), the rows newest first and «Eliminar alerta» at full width, with no alert map and no Guardados card", async () => {
    renderAlert(alertWithMatches("corolla"));

    const heading = screen.getByRole("heading", { level: 1, name: "Corolla híbrido" });
    const firstChip = screen.getByText("Toyota Corolla");
    const created = screen.getByText("Creada el 2 de octubre");
    const zone = screen.getByRole("region", { name: ALERT_COPY.zoneLabel });
    const count = screen.getByRole("heading", { level: 2, name: "4 coincidencias" });
    const matchList = rows();
    const remove = screen.getByRole("button", { name: ALERT_COPY.delete });
    for (const [first, second] of [
      [heading, firstChip],
      [firstChip, created],
      [created, zone],
      [zone, count],
      [count, matchList[0]],
      [matchList[3], remove],
    ] as const) {
      expect(follows(first, second)).toBe(true);
    }
    expect(matchList.map((row) => row.textContent)).toEqual(
      corollaMatches().map((match) => expect.stringContaining(match.title)),
    );
    expect(remove).toHaveClass("w-full");
    expect(screen.queryByRole("region", { name: ALERT_COPY.mapLabel })).not.toBeInTheDocument();
    expect(screen.queryAllByRole("article")).toEqual([]);
  });

  it("ALERTUI-22: the zone holds the circle and the dot, the pill «Madrid · 50 km» in lime, and no pin", async () => {
    renderAlert(alertWithMatches("corolla"));
    const zone = screen.getByRole("region", { name: ALERT_COPY.zoneLabel });

    await waitFor(() => expect(zonePaths()).toHaveLength(2));
    for (const path of zonePaths()) expect(zone.contains(path)).toBe(true);
    expect(byWholeText(zone, `Madrid · 50${NBSP}km`)).toHaveClass("text-lime");
    expect(zone.querySelector(".leaflet-marker-icon")).toBeNull();
  });

  it("ALERTUI-22: the Clio's zone pill reads the radius alone, «50 km»", async () => {
    renderAlert(alertWithMatches("clio"));
    const zone = screen.getByRole("region", { name: ALERT_COPY.zoneLabel });

    expect(byWholeText(zone, `50${NBSP}km`)).toHaveClass("text-lime");
  });

  it("ALERTUI-22: the tab bar beside it has «Alertas» current", () => {
    renderWithI18n(<TabBar />, { locale: "es" });

    expect(screen.getByRole("link", { name: /Alertas/ })).toHaveAttribute("aria-current", "page");
  });
});

describe("ALERTUI-23: an alert with no place on the phone", () => {
  it("ALERTUI-23: Serie 3 diésel has no zone region: the count's heading follows «Creada el …»", () => {
    renderAlert(alertWithMatches("serie3"));

    expect(screen.queryByRole("region", { name: ALERT_COPY.zoneLabel })).not.toBeInTheDocument();
    expect(zonePaths()).toHaveLength(0);
    const created = screen.getByText("Creada el 14 de septiembre");
    const count = screen.getByRole("heading", { level: 2, name: "12 coincidencias" });
    expect(follows(created, count)).toBe(true);
  });
});

describe("ALERTUI-24: the phone zone map is static", () => {
  it("ALERTUI-24: dragging, scroll-wheel, double-click, touch, box and keyboard zoom are off, with no zoom control and no focusable element", async () => {
    const addLayer = vi.spyOn(L.Map.prototype, "addLayer");
    renderAlert(alertWithMatches("corolla"));
    const zone = screen.getByRole("region", { name: ALERT_COPY.zoneLabel });
    await waitFor(() => expect(zonePaths()).toHaveLength(2));

    const map = addLayer.mock.contexts.find(
      (context): context is L.Map => context instanceof L.Map,
    );
    expect(map, "the zone's Leaflet map").toBeDefined();
    const handlers = map as L.Map;
    expect(handlers.dragging.enabled()).toBe(false);
    expect(handlers.scrollWheelZoom.enabled()).toBe(false);
    expect(handlers.doubleClickZoom.enabled()).toBe(false);
    expect(handlers.touchZoom.enabled()).toBe(false);
    expect(handlers.boxZoom.enabled()).toBe(false);
    expect(handlers.keyboard.enabled()).toBe(false);
    expect(zone.querySelector(".leaflet-control-zoom")).toBeNull();
    expect(within(zone).queryByRole("button", { name: "Acercar" })).toBeNull();
    const focusable = zone.querySelectorAll(
      'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    expect(Array.from(focusable)).toEqual([]);
  });
});

describe("ALERTUI-25: the phone match row", () => {
  it("ALERTUI-25: is one button opening a dialog, with the 110×86 thumbnail, the name, «año · km» with no city, and the price — no badge and no heart", () => {
    renderAlert(alertWithMatches("corolla"));
    const row = matchRow("Toyota Corolla 125H");
    const [cochesnet] = corollaMatches();

    expect(row.tagName).toBe("BUTTON");
    expect(row).toHaveAttribute("aria-haspopup", "dialog");
    expect(row.querySelector("img")).toHaveAttribute("src", cochesnet.image);
    expect(row.querySelector(".h-21\\.5.w-27\\.5")).not.toBeNull();
    expect(within(row).getByText("Toyota Corolla 125H")).toBeInTheDocument();
    expect(within(row).getByText("2021 · 41.000 km")).toBeInTheDocument();
    expect(within(row).queryByText(/Getafe/)).not.toBeInTheDocument();
    expect(within(row).getByText("16.200 €")).toBeInTheDocument();
    expect(within(row).queryByText("coches.net")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: ALERT_COPY.save })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: ALERT_COPY.unsave })).not.toBeInTheDocument();
  });

  it("ALERTUI-25: with no photo the thumbnail is the car's tint with the car icon, and an unknown year leaves «km» alone", () => {
    const [first, ...rest] = corollaMatches();
    renderAlert(
      alertWithMatches("corolla", { matches: [{ ...first, image: "", year: 0 }, ...rest] }),
    );
    const row = matchRow("Toyota Corolla 125H");

    expect(row.querySelector("img")).toBeNull();
    expect(row.querySelector(".lucide-car")).not.toBeNull();
    expect(within(row).getByText("41.000 km")).toBeInTheDocument();
  });
});

describe("ALERTUI-26: the car sheet", () => {
  it("ALERTUI-26: a row opens a dialog named by the car, with «Cerrar» hidden, the photo and badge, name and city, «año · km · combustible», the price, «Guardar» and «Ver anuncio»", async () => {
    renderAlert(alertWithMatches("corolla"));
    const [cochesnet] = corollaMatches();

    const sheet = await openSheet("Toyota Corolla 125H");

    expect(within(sheet).getByRole("button", { name: ALERT_COPY.close })).toHaveClass("sr-only");
    expect(sheet.querySelector("[data-sheet-handle]")).not.toBeNull();
    expect(sheet.querySelector("img")).toHaveAttribute("src", cochesnet.image);
    expect(within(sheet).getByText("coches.net")).toBeInTheDocument();
    expect(within(sheet).getByText("Getafe")).toBeInTheDocument();
    expect(within(sheet).getByText("2021 · 41.000 km · Híbrido")).toBeInTheDocument();
    expect(within(sheet).getByText("16.200 €")).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: ALERT_COPY.save })).toBeInTheDocument();
    const viewListing = within(sheet).getByRole("link", { name: /Ver anuncio/ });
    expect(viewListing).toHaveAttribute("href", cochesnet.url);
    expect(viewListing).toHaveAttribute("target", "_blank");
    expect(viewListing).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("ALERTUI-26: «Guardar» saves the listing and leaves the sheet open, reading «Quitar de guardados»", async () => {
    renderAlert(alertWithMatches("corolla"));
    const sheet = await openSheet("Toyota Corolla 125H");

    await userEvent.click(within(sheet).getByRole("button", { name: ALERT_COPY.save }));

    expect(saveFavorite).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog", { name: "Toyota Corolla 125H" })).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: ALERT_COPY.unsave })).toBeInTheDocument();
  });

  it.each(["Escape", "a press outside", "«Cerrar»"])(
    "ALERTUI-26: %s closes it and focus returns to its row",
    async (how) => {
      renderAlert(alertWithMatches("corolla"));
      const sheet = await openSheet("Toyota Corolla 1.8 Hybrid Active");

      if (how === "Escape") await userEvent.keyboard("{Escape}");
      if (how === "a press outside") {
        fireEvent.pointerDown(document.body);
        fireEvent.pointerUp(document.body);
        fireEvent.click(document.body);
      }
      if (how === "«Cerrar»") {
        await userEvent.click(within(sheet).getByRole("button", { name: ALERT_COPY.close }));
      }

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(matchRow("Toyota Corolla 1.8 Hybrid Active")).toHaveFocus();
    },
  );
});

describe("ALERTUI-18: the car sheet's saved state (worked example «Saved state», bug fix)", () => {
  it("ALERTUI-18: cochesnet-99, already saved, reads «Quitar de guardados»; pressing it calls removeFavorite(«cochesnet-99») and it reads «Guardar»", async () => {
    vi.mocked(listFavorites).mockResolvedValue({ ok: true, value: [corollaMatches()[0]] });
    renderAlert(alertWithMatches("corolla"));
    const sheet = await openSheet("Toyota Corolla 125H");

    const button = await within(sheet).findByRole("button", { name: ALERT_COPY.unsave });
    await userEvent.click(button);

    expect(removeFavorite).toHaveBeenCalledWith("cochesnet-99");
    expect(within(sheet).getByRole("button", { name: ALERT_COPY.save })).toBeInTheDocument();
    // Read from the DOM: the open modal hides the rows from the accessibility tree.
    expect(document.querySelectorAll('button[aria-haspopup="dialog"]')).toHaveLength(4);
  });

  it("ALERTUI-19 / FAV-11: a save refused with unauthenticated puts «Guardar» back and toasts «Inicia sesión para guardar coches.»", async () => {
    vi.mocked(saveFavorite).mockResolvedValue(FAVORITE_UNAUTHENTICATED);
    renderAlert(alertWithMatches("corolla"));
    const sheet = await openSheet("Toyota Corolla 125H");

    await userEvent.click(within(sheet).getByRole("button", { name: ALERT_COPY.save }));

    expect(await screen.findByText(ALERT_COPY.favoriteUnauthenticated)).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: ALERT_COPY.save })).toBeInTheDocument();
  });
});

describe("ALERTUI-34: the confirmation sheet", () => {
  it("ALERTUI-34: «Eliminar alerta» opens an alertdialog «¿Eliminar «Serie 3 diésel»?», named by its title, with the handle, «Eliminar» and «Cancelar», and no «×» or «Cerrar»", async () => {
    renderAlert(alertWithMatches("serie3"));

    const { sheet } = await openConfirmation("Serie 3 diésel");

    expect(sheet).toHaveAccessibleName("¿Eliminar «Serie 3 diésel»?");
    expect(within(sheet).getByText("¿Eliminar «Serie 3 diésel»?")).toBeInTheDocument();

    expect(sheet.querySelector("[data-sheet-handle]")).not.toBeNull();
    expect(within(sheet).getByRole("button", { name: ALERT_COPY.deleteShort })).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: ALERT_COPY.cancel })).toBeInTheDocument();
    expect(within(sheet).queryByRole("button", { name: ALERT_COPY.close })).toBeNull();
  });

  it.each(["«Cancelar»", "Escape", "a press outside"])(
    "ALERTUI-34: %s closes it with nothing sent, and focus returns to «Eliminar alerta»",
    async (how) => {
      renderAlert(alertWithMatches("serie3"));
      const { opener, sheet } = await openConfirmation("Serie 3 diésel");

      if (how === "«Cancelar»") {
        await userEvent.click(within(sheet).getByRole("button", { name: ALERT_COPY.cancel }));
      }
      if (how === "Escape") await userEvent.keyboard("{Escape}");
      if (how === "a press outside") {
        fireEvent.pointerDown(document.body);
        fireEvent.pointerUp(document.body);
        fireEvent.click(document.body);
      }

      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(opener).toHaveFocus();
      expect(deleteAlert).not.toHaveBeenCalled();
    },
  );
});

describe("ALERTUI-35: deleting on the phone", () => {
  it("ALERTUI-35: «Eliminar alerta» then «Eliminar» on Serie 3 diésel calls deleteAlert once and replaces the page with /alerts", async () => {
    renderAlert(alertWithMatches("serie3"));
    const { sheet } = await openConfirmation("Serie 3 diésel");

    await userEvent.click(within(sheet).getByRole("button", { name: ALERT_COPY.deleteShort }));

    expect(deleteAlert).toHaveBeenCalledTimes(1);
    expect(deleteAlert).toHaveBeenCalledWith(ALERT_ID.serie3);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/alerts"));
    expect(push).not.toHaveBeenCalled();
  });

  it("ALERTUI-35: while deleteAlert runs, Escape and a press outside leave «¿Eliminar «Serie 3 diésel»?» open, «Cancelar» disabled, and deleteAlert called once", async () => {
    vi.mocked(deleteAlert).mockReturnValue(
      new Promise(() => {
        // Intentionally left pending: the delete never answers.
      }),
    );
    renderAlert(alertWithMatches("serie3"));
    const { sheet } = await openConfirmation("Serie 3 diésel");

    await userEvent.click(within(sheet).getByRole("button", { name: ALERT_COPY.deleteShort }));
    await userEvent.keyboard("{Escape}");
    fireEvent.pointerDown(document.body);
    fireEvent.pointerUp(document.body);
    fireEvent.click(document.body);

    expect(screen.getByRole("alertdialog", { name: "¿Eliminar «Serie 3 diésel»?" })).toBe(sheet);
    expect(within(sheet).getByRole("button", { name: ALERT_COPY.cancel })).toBeDisabled();
    expect(deleteAlert).toHaveBeenCalledTimes(1);
  });
});

describe("ALERTUI-36: a delete that fails on the phone", () => {
  it("ALERTUI-36: a throw closes the sheet, stays on the page, toasts «Algo ha salido mal. Inténtalo de nuevo.» and returns focus to «Eliminar alerta»", async () => {
    vi.mocked(deleteAlert).mockRejectedValue(new Error("connection refused"));
    renderAlert(alertWithMatches("serie3"));
    const { opener, sheet } = await openConfirmation("Serie 3 diésel");

    await userEvent.click(within(sheet).getByRole("button", { name: ALERT_COPY.deleteShort }));

    expect(await screen.findByText(ALERT_COPY.unexpected)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(replace).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { level: 1, name: "Serie 3 diésel" })).toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});

describe("ALERTUI-22: long text on the phone", () => {
  it("ALERTUI-22: the zone's pill has the same inset on the right as on the left and is cut to one line with «…»", async () => {
    const long = "San Sebastián de los Reyes, Comunidad de Madrid";
    renderAlert(alertWithMatches("corolla", { placeName: long }));
    const zone = await screen.findByRole("region", { name: ALERT_COPY.zoneLabel });

    const pill = byWholeText(zone, `${long} · 50${NBSP}km`);
    expect(pill).toHaveClass("w-fit", "max-w-full", "truncate");
    expect(pill.parentElement).toHaveClass("left-4.5", "right-4.5");
  });
});

describe("ALERTUI-41: no match on the phone", () => {
  it("ALERTUI-41: Clio barato shows «Sin coincidencias» as the section heading, then «Te avisaremos …», then «Eliminar alerta», and no row", () => {
    renderAlert(alertWithMatches("clio"));

    const heading = screen.getByRole("heading", { level: 2, name: "Sin coincidencias" });
    const line = screen.getByText(ALERT_COPY.noMatchesYet);
    const remove = screen.getByRole("button", { name: ALERT_COPY.delete });
    expect(follows(heading, line)).toBe(true);
    expect(follows(line, remove)).toBe(true);
    expect(rows()).toEqual([]);
  });
});
