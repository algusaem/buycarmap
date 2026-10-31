import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithI18n } from "@/test/utils/render";
import { Landing } from "./Landing";

// docs/specs/redesign-entry.md (ENTRY-1, ENTRY-4, ENTRY-7). The "Shared
// pieces"/"Contracts" sections of the spec are this file's contract for
// what Landing.tsx composes: LandingSearch (its own test file)
// and a map preview, in two always-mounted regions
// (data-testid="landing-desktop"/"landing-phone") chosen by CSS, the same
// convention components/nav/SiteHeader.tsx already uses for
// "header-desktop"/"header-phone" — jsdom applies no responsive CSS, so a
// region split, not a viewport, is what lets a test assert "shown on
// desktop, not on phone" or vice versa.
vi.mock("@/server/search/actions", () => ({
  listCarModels: vi.fn(async () => ({ ok: true, value: [] })),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("ENTRY-1: Landing — the body", () => {
  it("ENTRY-1: shows the headline, the subheadline and one Ver el mapa link per region, with no figures and no sign-in CTA", () => {
    renderWithI18n(<Landing />, { locale: "es" });

    expect(screen.getByRole("heading", { name: /¿En busca de coche\?/ })).toHaveTextContent(
      "Mira el mapa",
    );
    expect(
      screen.getByText("Una web, toda la segunda mano, sin cincuenta pestañas."),
    ).toBeInTheDocument();

    // "Ver el mapa" as a separate link, alongside the map-preview link that
    // also carries that name, is explicitly out (ENTRY-1) — scoped to one
    // region so the desktop/phone duplication the two-region convention
    // produces in jsdom is not mistaken for that.
    const desktop = within(screen.getByTestId("landing-desktop"));
    expect(desktop.getAllByRole("link", { name: "Ver el mapa" })).toHaveLength(1);

    for (const figure of ["50K+", "12", "100%"]) {
      expect(screen.queryByText(figure)).not.toBeInTheDocument();
    }
    // The signed-in/signed-out difference sits in the header and tab bar
    // (SiteHeader.test.tsx, TabBar.test.tsx) — Landing's own body reads no
    // session, so this CTA (the old Hero's, for a signed-out visitor) has no
    // branch left to appear from at all.
    expect(screen.queryByText("Accede para guardar búsquedas")).not.toBeInTheDocument();
  });
});

describe("ENTRY-4: Landing — Populares", () => {
  function hrefParams(link: HTMLElement): URLSearchParams {
    return new URL(link.getAttribute("href") ?? "", "http://localhost").searchParams;
  }

  it("ENTRY-4: desktop lists Golf, SEAT León, BMW Serie 3 and Audi A4 as links to /map with their brand and model", () => {
    renderWithI18n(<Landing />, { locale: "es" });
    const popular = within(screen.getByTestId("landing-popular"));

    function hrefPath(link: HTMLElement): string {
      return new URL(link.getAttribute("href") ?? "", "http://localhost").pathname;
    }
    // F4 review round 2 (T5): the label over the chips, and every chip's
    // path, asserted once rather than only its params.
    expect(popular.getByText("Populares")).toBeInTheDocument();

    const golf = popular.getByRole("link", { name: "Golf" });
    expect(hrefPath(golf)).toBe("/map");
    expect(Object.fromEntries(hrefParams(golf))).toEqual({ make: "Volkswagen", model: "Golf" });

    const leon = popular.getByRole("link", { name: "SEAT León" });
    expect(hrefPath(leon)).toBe("/map");
    expect(Object.fromEntries(hrefParams(leon))).toEqual({ make: "Seat", model: "León" });

    const serie3 = popular.getByRole("link", { name: "BMW Serie 3" });
    expect(hrefPath(serie3)).toBe("/map");
    expect(Object.fromEntries(hrefParams(serie3))).toEqual({ make: "BMW", model: "Serie 3" });

    const a4 = popular.getByRole("link", { name: "Audi A4" });
    expect(hrefPath(a4)).toBe("/map");
    expect(Object.fromEntries(hrefParams(a4))).toEqual({ make: "Audi", model: "A4" });
  });

  it("ENTRY-4: the phone region shows no Populares list", () => {
    renderWithI18n(<Landing />, { locale: "es" });

    expect(
      within(screen.getByTestId("landing-phone")).queryByTestId("landing-popular"),
    ).not.toBeInTheDocument();
  });
});

// F4 review round 2 (ENTRY-2): the landing's own SearchPill (`variant="landing"`)
// never offers it — it has no results list of its own to attach an alert to.
describe("Landing — no Crear alerta", () => {
  it("ENTRY-2: the desktop landing has no Crear alerta button", () => {
    renderWithI18n(<Landing />, { locale: "es" });

    expect(screen.queryByRole("button", { name: "Crear alerta" })).not.toBeInTheDocument();
  });
});

describe("ENTRY-7: Landing — the map preview", () => {
  it("ENTRY-7: desktop shows one link to /map named Ver el mapa, with the example car card and five pins", () => {
    renderWithI18n(<Landing />, { locale: "es" });
    const desktopEl = screen.getByTestId("landing-desktop");
    const desktop = within(desktopEl);

    const preview = desktop.getByRole("link", { name: "Ver el mapa" });
    expect(preview).toHaveAttribute("href", "/map");
    // vehicle-sale-lime.svg (spec › Contracts › Illustrations) used to be
    // asserted here too, on the premise that it was scoped to this same
    // desktop-only region together with the preview. Amended 2026-10-14
    // (ENTRY-23, ENTRY-24): the illustration now shows from 1024px wide,
    // while this region's preview and arrows only show from 1440px — a
    // breakpoint split this binary desktop/phone testid region (jsdom
    // applies no responsive CSS) cannot represent. Covered instead by the
    // e2e layout tests (e2e/landing.spec.ts, ENTRY-23, ENTRY-24, ENTRY-26).
    expect(desktop.getByTestId("landing-preview-car-card")).toBeInTheDocument();
    // MapPreview.tsx's DESKTOP_PINS: five example price pins, each the
    // shared `PIN_BASE_CLASSES` pill (`rounded-pill`) — the only elements
    // carrying that class inside the preview link itself.
    expect(preview.querySelectorAll(".rounded-pill")).toHaveLength(5);
  });

  it("ENTRY-7: the phone region shows the example car card inside the map, no illustration and two pins", () => {
    renderWithI18n(<Landing />, { locale: "es" });
    const phoneEl = screen.getByTestId("landing-phone");
    const phone = within(phoneEl);

    const preview = phone.getByRole("link", { name: "Ver el mapa" });
    expect(preview).toHaveAttribute("href", "/map");
    expect(phoneEl.querySelector('img[src*="vehicle-sale-lime.svg"]')).toBeNull();
    expect(phone.getByTestId("landing-preview-car-card")).toBeInTheDocument();
    // MapPreview.tsx's PHONE_PINS: two example price pins.
    expect(preview.querySelectorAll(".rounded-pill")).toHaveLength(2);
  });

  // docs/specs/redesign-entry.md (ENTRY-32, bug fix): the phone preview's
  // road svg scales to the preview's own box instead of a fixed 350×300
  // grid, and the link itself never shrinks under 440px tall.
  it("ENTRY-32: the phone preview's roads fill the preview, however tall", () => {
    renderWithI18n(<Landing />, { locale: "es" });
    const phone = within(screen.getByTestId("landing-phone"));

    const preview = phone.getByRole("link", { name: "Ver el mapa" });
    const roads = preview.querySelector("svg");
    expect(roads).toHaveAttribute("viewBox", "0 0 350 440");
    expect(roads).toHaveAttribute("preserveAspectRatio", "xMinYMin slice");
    expect(preview.className).toContain("min-h-110");
  });
});
