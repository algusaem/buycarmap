import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithI18n } from "@/test/utils/render";
import { ALERT_COPY } from "@/test/fixtures/alert-listings";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/alerts/alert-1",
}));
vi.mock("next/image", () => import("@/test/mocks/next-image"));
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_CARTO_API_KEY: undefined } }));

// FRONT-14 (docs/specs/core-frontend.md): /alerts/[id]'s loading state,
// amended 2026-10-15 by docs/specs/redesign-alerts.md (ALERTUI-39): it
// mirrors the alert page — on the phone, bars for the name, the criteria and
// the date, the 180px gap of the zone, a bar for the count and three
// placeholder rows; on desktop, «Volver», the bars, placeholder Guardados
// cards and the map with only the pill «Cargando…». The phone header's
// «Volver» is components/nav/SiteHeader.test.tsx's. Both compositions are
// drawn and CSS picks one; jsdom applies no CSS, so each is found by its
// breakpoint classes.
import Loading from "./loading";

function placeholders(composition: HTMLElement): Element[] {
  return Array.from(composition.querySelectorAll(":scope > [aria-hidden='true']"));
}

function bars(element: Element): number {
  return element.querySelectorAll('[data-slot="skeleton"]').length;
}

describe("AlertMatchesLoading", () => {
  it("FRONT-14: shows one busy region of placeholders that mirror the alert page", () => {
    const { container } = renderWithI18n(<Loading />, { locale: "es" });

    expect(container.querySelectorAll('[aria-busy="true"]')).toHaveLength(1);
  });
});

describe("ALERTUI-39: /alerts/[id]'s loading state", () => {
  it("ALERTUI-39: at phone width shows bars for the name, the criteria and the date, the 180px zone gap, a bar for the count and three rows of the 110×86 thumbnail and three bars", () => {
    const { container } = renderWithI18n(<Loading />, { locale: "es" });

    const phone = screen.getByTestId("alert-loading-phone");
    expect(phone).toHaveClass("lg:hidden");
    expect(container.querySelector('[aria-busy="true"]')).toContainElement(phone);
    expect(phone.querySelector(".h-45")).not.toBeNull();
    const rows = Array.from(phone.querySelectorAll("[data-testid='alert-loading-row']"));
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row).toHaveAttribute("aria-hidden", "true");
      expect(row.querySelector(".h-21\\.5.w-27\\.5")).not.toBeNull();
      expect(bars(row)).toBe(4);
    }
    // The name, the criteria, the date and the count: four bars over the rows.
    const heading = Array.from(phone.querySelectorAll('[data-slot="skeleton"]')).filter(
      (bar) => !rows.some((row) => row.contains(bar)) && !bar.classList.contains("h-45"),
    );
    expect(heading).toHaveLength(4);
    const status = within(phone).getByRole("status");
    expect(status).toHaveTextContent(ALERT_COPY.loading);
    expect(status).toHaveClass("sr-only");
  });

  it("ALERTUI-39: at desktop width shows «Volver» to /alerts, bars for the name, the criteria, the date and the count, and six Guardados-card placeholders", () => {
    renderWithI18n(<Loading />, { locale: "es" });

    const desktop = screen.getByTestId("alert-loading-desktop");
    // Hidden below `lg`, shown from it.
    expect(desktop).toHaveClass("hidden");
    expect(desktop.className).toMatch(/(^|\s)lg:(flex|grid|block)(\s|$)/);
    expect(within(desktop).getByRole("link", { name: ALERT_COPY.back })).toHaveAttribute(
      "href",
      "/alerts",
    );
    const grid = within(desktop).getByTestId("alert-loading-grid");
    expect(grid).toHaveClass("lg:grid-cols-2", "xl:grid-cols-3");
    const cards = placeholders(grid);
    expect(cards).toHaveLength(6);
    for (const card of cards) expect(card.querySelector(".aspect-20\\/17")).not.toBeNull();
    const headingBars = Array.from(desktop.querySelectorAll('[data-slot="skeleton"]')).filter(
      (bar) => !grid.contains(bar),
    );
    expect(headingBars).toHaveLength(4);
  });

  it("ALERTUI-39: at desktop width the map shows no zone and no pin, only the pill «Cargando…» with role status", () => {
    const { container } = renderWithI18n(<Loading />, { locale: "es" });

    const map = screen.getByRole("region", { name: ALERT_COPY.mapLabel });
    expect(map).toHaveClass("hidden", "lg:flex");
    expect(within(map).getByRole("status")).toHaveTextContent(ALERT_COPY.loading);
    expect(container.querySelector(".leaflet-marker-icon")).toBeNull();
    expect(container.querySelector(".leaflet-overlay-pane path")).toBeNull();
  });

  it("ALERTUI-39: each composition holds exactly one live region", () => {
    renderWithI18n(<Loading />, { locale: "es" });

    const map = screen.getByRole("region", { name: ALERT_COPY.mapLabel });
    const phone = screen.getByTestId("alert-loading-phone");
    const statuses = screen.getAllByRole("status");
    expect(statuses).toHaveLength(2);
    expect(statuses.filter((status) => map.contains(status))).toHaveLength(1);
    expect(statuses.filter((status) => phone.contains(status))).toHaveLength(1);
  });
});
