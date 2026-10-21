import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "@/test/utils/render";
import { LandingSearch } from "./LandingSearch";

// docs/specs/redesign-entry.md (ENTRY-2, ENTRY-3, ENTRY-5, ENTRY-6).
// LandingSearch.tsx reuses the map's own search pieces
// (components/map/search/SearchPill.tsx + its three popovers for desktop,
// components/map/phone/SearchSheet.tsx for phone) the way the spec's
// "Shared pieces" section requires. Two always-mounted, testid-scoped
// regions ("landing-search-desktop"/"landing-search-phone"), the same
// convention Landing.test.tsx and components/nav/SiteHeader.tsx use.
//
// listCarModels is mocked at the Server Action boundary exactly as
// CarPopover.test.tsx and SearchSheet.test.tsx do; Nominatim goes through
// MSW's shared default handler (test/msw/handlers.ts), which already
// resolves any query to the Madrid fixture the worked example uses.
vi.mock("@/server/search/actions", () => ({
  listCarModels: vi.fn(async (make: string) => ({
    ok: true,
    value: make === "Volkswagen" ? [{ id: "Golf", label: "Golf" }] : [],
  })),
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

beforeEach(() => {
  push.mockReset();
});

function pathOf(url: string): string {
  return new URL(url, "http://localhost").pathname;
}
function parsedParams(url: string): Record<string, string> {
  return Object.fromEntries(new URL(url, "http://localhost").searchParams.entries());
}

describe("ENTRY-2: LandingSearch — desktop segments", () => {
  it("ENTRY-2: shows Dónde, Coche, Precio and Buscar, each opening the map's own popover", async () => {
    renderWithI18n(<LandingSearch />, { locale: "es" });
    const desktop = within(screen.getByTestId("landing-search-desktop"));

    expect(desktop.getByRole("button", { name: "Ciudad o código postal…" })).toBeInTheDocument();
    expect(desktop.getByRole("button", { name: "Marca o modelo…" })).toBeInTheDocument();
    expect(desktop.getByRole("button", { name: "Cualquiera" })).toBeInTheDocument();
    expect(desktop.getByRole("button", { name: "Buscar" })).toBeInTheDocument();

    await userEvent.click(desktop.getByRole("button", { name: "Ciudad o código postal…" }));

    expect(screen.getByRole("dialog", { name: "Dónde" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Ciudad o código postal" })).toBeInTheDocument();
  });

  it("ENTRY-2: with «Dónde» open, pressing «Coche» opens «Coche»", async () => {
    renderWithI18n(<LandingSearch />, { locale: "es" });
    const desktop = within(screen.getByTestId("landing-search-desktop"));
    const carSegment = desktop.getByRole("button", { name: "Marca o modelo…" });

    await userEvent.click(desktop.getByRole("button", { name: "Ciudad o código postal…" }));
    expect(screen.getByRole("dialog", { name: "Dónde" })).toBeInTheDocument();

    await userEvent.click(carSegment);

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Dónde" })).toBeNull());
    expect(screen.getByRole("dialog", { name: "Coche" })).toBeInTheDocument();
    expect(carSegment).toHaveAttribute("aria-expanded", "true");
  });

  it("ENTRY-2: a choice made in a popover is shown in its segment, and nothing is searched yet", async () => {
    renderWithI18n(<LandingSearch />, { locale: "es" });
    const desktop = within(screen.getByTestId("landing-search-desktop"));

    await userEvent.click(desktop.getByRole("button", { name: "Marca o modelo…" }));
    await userEvent.type(screen.getByRole("combobox", { name: "Marca o modelo" }), "Volks");
    await userEvent.click(await screen.findByRole("option", { name: "Volkswagen" }));

    expect(desktop.getByRole("button", { name: "Volkswagen" })).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  // F4 review round 2 (T2): the three segments reflect every choice, in the
  // one combined scenario ENTRY-3's own full-combination test below drives
  // through to Buscar — here stopping short of it.
  it("ENTRY-2: Madrid, Volkswagen Golf and Hasta 10.000 € show in their own segments before Buscar is pressed", async () => {
    renderWithI18n(<LandingSearch />, { locale: "es" });
    const desktop = within(screen.getByTestId("landing-search-desktop"));

    await userEvent.click(desktop.getByRole("button", { name: "Ciudad o código postal…" }));
    await userEvent.type(screen.getByRole("combobox", { name: "Ciudad o código postal" }), "Ma");
    await userEvent.click(await screen.findByRole("option", { name: "MadridComunidad de Madrid" }));

    await userEvent.click(desktop.getByRole("button", { name: "Marca o modelo…" }));
    await userEvent.type(screen.getByRole("combobox", { name: "Marca o modelo" }), "Volks");
    await userEvent.click(await screen.findByRole("option", { name: "Volkswagen" }));
    await userEvent.click(await screen.findByRole("option", { name: "Golf" }));

    await userEvent.click(desktop.getByRole("button", { name: "Cualquiera" }));
    const shortcuts = screen.getByRole("radiogroup", { name: "Precio máximo" });
    await userEvent.click(within(shortcuts).getByRole("radio", { name: "Hasta 10.000 €" }));

    expect(desktop.getByRole("button", { name: "Madrid · 50 km" })).toBeInTheDocument();
    expect(desktop.getByRole("button", { name: "Volkswagen Golf" })).toBeInTheDocument();
    expect(desktop.getByRole("button", { name: "Hasta 10.000 €" })).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("ENTRY-3: LandingSearch — Buscar navigates with exactly what was chosen", () => {
  it("ENTRY-3: with nothing chosen, Buscar goes to /map with no query", async () => {
    renderWithI18n(<LandingSearch />, { locale: "es" });
    const desktop = within(screen.getByTestId("landing-search-desktop"));

    await userEvent.click(desktop.getByRole("button", { name: "Buscar" }));

    expect(push).toHaveBeenCalledTimes(1);
    const url = push.mock.calls[0][0] as string;
    expect(pathOf(url)).toBe("/map");
    expect(parsedParams(url)).toEqual({});
  });

  it("ENTRY-3: with only BMW chosen, Buscar goes to /map?make=BMW", async () => {
    renderWithI18n(<LandingSearch />, { locale: "es" });
    const desktop = within(screen.getByTestId("landing-search-desktop"));

    await userEvent.click(desktop.getByRole("button", { name: "Marca o modelo…" }));
    await userEvent.type(screen.getByRole("combobox", { name: "Marca o modelo" }), "BMW");
    await userEvent.click(await screen.findByRole("option", { name: "BMW" }));
    await userEvent.click(desktop.getByRole("button", { name: "Buscar" }));

    expect(push).toHaveBeenCalledTimes(1);
    const url = push.mock.calls[0][0] as string;
    expect(pathOf(url)).toBe("/map");
    expect(parsedParams(url)).toEqual({ make: "BMW" });
  });

  it("ENTRY-3: Madrid at 50 km, Volkswagen Golf and up to 10.000 € go to /map with all of it, radius included", async () => {
    renderWithI18n(<LandingSearch />, { locale: "es" });
    const desktop = within(screen.getByTestId("landing-search-desktop"));

    await userEvent.click(desktop.getByRole("button", { name: "Ciudad o código postal…" }));
    await userEvent.type(screen.getByRole("combobox", { name: "Ciudad o código postal" }), "Ma");
    await userEvent.click(await screen.findByRole("option", { name: "MadridComunidad de Madrid" }));

    await userEvent.click(desktop.getByRole("button", { name: "Marca o modelo…" }));
    await userEvent.type(screen.getByRole("combobox", { name: "Marca o modelo" }), "Volks");
    await userEvent.click(await screen.findByRole("option", { name: "Volkswagen" }));
    await userEvent.click(await screen.findByRole("option", { name: "Golf" }));

    await userEvent.click(desktop.getByRole("button", { name: "Cualquiera" }));
    const shortcuts = screen.getByRole("radiogroup", { name: "Precio máximo" });
    await userEvent.click(within(shortcuts).getByRole("radio", { name: "Hasta 10.000 €" }));

    await userEvent.click(desktop.getByRole("button", { name: "Buscar" }));

    expect(push).toHaveBeenCalledTimes(1);
    const url = push.mock.calls[0][0] as string;
    expect(pathOf(url)).toBe("/map");
    expect(parsedParams(url)).toEqual({
      lat: "40.4168",
      lng: "-3.7038",
      placeId: "1",
      locationName: "Madrid",
      radius: "50",
      make: "Volkswagen",
      model: "Golf",
      maxPrice: "10000",
    });
  });
});

describe("ENTRY-6: LandingSearch — never produces ?q=", () => {
  it("ENTRY-6: offers no free-text search box, and Buscar never includes q= even with a brand chosen", async () => {
    renderWithI18n(<LandingSearch />, { locale: "es" });
    const desktop = within(screen.getByTestId("landing-search-desktop"));

    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();

    await userEvent.click(desktop.getByRole("button", { name: "Marca o modelo…" }));
    await userEvent.type(screen.getByRole("combobox", { name: "Marca o modelo" }), "BMW");
    await userEvent.click(await screen.findByRole("option", { name: "BMW" }));
    await userEvent.click(desktop.getByRole("button", { name: "Buscar" }));

    const url = push.mock.calls[0][0] as string;
    expect(parsedParams(url)).not.toHaveProperty("q");
  });
});

describe("ENTRY-5: LandingSearch — the phone card opens the BUSCAR sheet", () => {
  it("ENTRY-5: shows a card with Dónde and Coche over Buscar, and tapping it opens the BUSCAR sheet over the landing", async () => {
    renderWithI18n(<LandingSearch />, { locale: "es" });
    const card = screen.getByTestId("landing-search-phone");
    const phone = within(card);

    expect(phone.getByText("Dónde")).toBeInTheDocument();
    expect(phone.getByText("Coche")).toBeInTheDocument();
    expect(phone.getByText("Buscar")).toBeInTheDocument();

    await userEvent.click(card);

    expect(screen.getByRole("dialog", { name: "BUSCAR" })).toBeInTheDocument();
  });

  it("ENTRY-5: Ver coches navigates to /map with what was chosen in the sheet", async () => {
    renderWithI18n(<LandingSearch />, { locale: "es" });
    await userEvent.click(screen.getByTestId("landing-search-phone"));

    await userEvent.type(screen.getByRole("textbox", { name: "Máximo" }), "15000");
    await userEvent.click(screen.getByRole("button", { name: "Ver coches" }));

    expect(push).toHaveBeenCalledTimes(1);
    const url = push.mock.calls[0][0] as string;
    expect(pathOf(url)).toBe("/map");
    expect(parsedParams(url)).toEqual({ maxPrice: "15000" });
  });

  it("ENTRY-5: closing the sheet without Ver coches changes nothing", async () => {
    renderWithI18n(<LandingSearch />, { locale: "es" });
    await userEvent.click(screen.getByTestId("landing-search-phone"));
    await userEvent.type(screen.getByRole("textbox", { name: "Máximo" }), "15000");

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "BUSCAR" })).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();

    // F4 review round 2 (T4): the discarded draft doesn't survive a reopen
    // either — the sheet's own content remounts from the landing's
    // untouched draft, not from what was typed and then discarded.
    await userEvent.click(screen.getByTestId("landing-search-phone"));
    expect(screen.getByRole("textbox", { name: "Máximo" })).toHaveValue("");
    expect(push).not.toHaveBeenCalled();
  });

  // F4 review round 2 (T3): a place, a brand+model and a price together,
  // through the phone sheet rather than ENTRY-3's desktop pill — the sheet's
  // own control names, taken from SearchSheet.test.tsx.
  it("ENTRY-5: Madrid, Volkswagen Golf and Máximo 10000 together in the sheet navigate with all of it", async () => {
    renderWithI18n(<LandingSearch />, { locale: "es" });
    await userEvent.click(screen.getByTestId("landing-search-phone"));

    await userEvent.type(screen.getByRole("combobox", { name: "Ciudad o código postal" }), "Ma");
    await userEvent.click(await screen.findByRole("option", { name: "MadridComunidad de Madrid" }));

    await userEvent.type(screen.getByRole("combobox", { name: "Marca o modelo" }), "Volks");
    await userEvent.click(await screen.findByRole("option", { name: "Volkswagen" }));
    await userEvent.click(await screen.findByRole("option", { name: "Golf" }));

    await userEvent.type(screen.getByRole("textbox", { name: "Máximo" }), "10000");
    await userEvent.click(screen.getByRole("button", { name: "Ver coches" }));

    expect(push).toHaveBeenCalledTimes(1);
    const url = push.mock.calls[0][0] as string;
    expect(pathOf(url)).toBe("/map");
    expect(parsedParams(url)).toEqual({
      lat: "40.4168",
      lng: "-3.7038",
      placeId: "1",
      locationName: "Madrid",
      radius: "50",
      make: "Volkswagen",
      model: "Golf",
      maxPrice: "10000",
    });
  });

  // Amended 2026-10-21 (MAPUI-21, issue #117): the sheet leaves the place out
  // while «Dónde» is untouched, so the place chosen on the landing stands.
  it("ENTRY-5: «Ver coches» with «Dónde» untouched in the phone sheet keeps the place chosen on the landing", async () => {
    renderWithI18n(<LandingSearch />, { locale: "es" });
    const desktop = within(screen.getByTestId("landing-search-desktop"));

    await userEvent.click(desktop.getByRole("button", { name: "Ciudad o código postal…" }));
    await userEvent.type(screen.getByRole("combobox", { name: "Ciudad o código postal" }), "Ma");
    await userEvent.click(await screen.findByRole("option", { name: "MadridComunidad de Madrid" }));
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Dónde" })).toBeNull());

    await userEvent.click(screen.getByTestId("landing-search-phone"));
    await userEvent.type(screen.getByRole("textbox", { name: "Máximo" }), "15000");
    await userEvent.click(screen.getByRole("button", { name: "Ver coches" }));

    expect(push).toHaveBeenCalledTimes(1);
    const url = push.mock.calls[0][0] as string;
    expect(pathOf(url)).toBe("/map");
    expect(parsedParams(url)).toEqual({
      lat: "40.4168",
      lng: "-3.7038",
      placeId: "1",
      locationName: "Madrid",
      radius: "50",
      maxPrice: "15000",
    });
  });

  it("ENTRY-5: «Borrar» in the phone sheet clears a place chosen on the landing", async () => {
    renderWithI18n(<LandingSearch />, { locale: "es" });
    const desktop = within(screen.getByTestId("landing-search-desktop"));

    await userEvent.click(desktop.getByRole("button", { name: "Ciudad o código postal…" }));
    await userEvent.type(screen.getByRole("combobox", { name: "Ciudad o código postal" }), "Ma");
    await userEvent.click(await screen.findByRole("option", { name: "MadridComunidad de Madrid" }));
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Dónde" })).toBeNull());

    await userEvent.click(screen.getByTestId("landing-search-phone"));
    await userEvent.click(screen.getByRole("button", { name: "Borrar" }));
    await userEvent.click(screen.getByRole("button", { name: "Ver coches" }));

    expect(push).toHaveBeenCalledTimes(1);
    const url = push.mock.calls[0][0] as string;
    expect(pathOf(url)).toBe("/map");
    expect(parsedParams(url)).toEqual({});
  });
});

// docs/specs/motion.md (Key MOTION, Approved), MOTION-21: the phone search
// card gains the hover and press of the map's phone summary (MOTION-6), in
// the state transition.
describe("MOTION-21: LandingSearch — hover and press on the phone card", () => {
  it("MOTION-21: the card carries transition-[border-color,scale], hover:border-text-muted and active:scale-97, off under reduced motion", () => {
    renderWithI18n(<LandingSearch />, { locale: "es" });

    const classes = screen.getByTestId("landing-search-phone").className.split(/\s+/);
    expect(classes).toContain("cursor-pointer");
    expect(classes).toContain("transition-[border-color,scale]");
    expect(classes).toContain("hover:border-text-muted");
    expect(classes).toContain("active:scale-97");
    expect(classes).toContain("motion-reduce:active:scale-none");
  });
});
