import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithI18n } from "@/test/utils/render";
import { ALERT_COPY } from "@/test/fixtures/alert-listings";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/alerts",
}));
vi.mock("next/image", () => import("@/test/mocks/next-image"));
vi.mock("maplibre-gl", () => import("@/test/utils/maplibre"));

// FRONT-14 (docs/specs/core-frontend.md): /alerts' loading state, amended
// 2026-10-15 by docs/specs/redesign-alerts.md (ALERTUI-38): it mirrors the
// redesigned page — at desktop width the heading, «Nueva alerta», the line,
// four folded AlertCard placeholders and the map with only the pill
// «Cargando…»; at phone width the heading and four phone AlertCard
// placeholders. Both compositions are drawn and CSS breakpoints pick one, as
// /favorites' loading state does (app/favorites/loading.test.tsx); jsdom
// applies no CSS, so each composition is found by its breakpoint classes.
import Loading from "./loading";
import { zoneShapes } from "@/test/utils/alerts";

/** The aria-hidden placeholders directly inside a composition. */
function placeholders(composition: HTMLElement): Element[] {
  return Array.from(composition.children).filter(
    (child) => child.getAttribute("aria-hidden") === "true",
  );
}

function bars(placeholder: Element): number {
  return placeholder.querySelectorAll('[data-slot="skeleton"]').length;
}

describe("AlertsLoading", () => {
  it("FRONT-14: shows one busy region of placeholders that mirror the AlertCards", () => {
    const { container } = renderWithI18n(<Loading />, { locale: "es" });

    expect(container.querySelectorAll('[aria-busy="true"]')).toHaveLength(1);
  });
});

describe("ALERTUI-38: /alerts' loading state", () => {
  it("ALERTUI-38: at desktop width shows «Alertas», «Nueva alerta», the line and four folded-card placeholders, with no open card", () => {
    const { container } = renderWithI18n(<Loading />, { locale: "es" });

    expect(screen.getByRole("heading", { level: 1, name: ALERT_COPY.title })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: ALERT_COPY.newAlert })).toHaveAttribute("href", "/map");
    expect(screen.getByText(ALERT_COPY.subtitle)).toBeInTheDocument();
    const desktop = screen.getByTestId("alerts-loading-desktop");
    // Hidden below `lg`, shown from it.
    expect(desktop).toHaveClass("hidden");
    expect(desktop.className).toMatch(/(^|\s)lg:(flex|grid|block)(\s|$)/);
    expect(container.querySelector('[aria-busy="true"]')).toContainElement(desktop);
    const cards = placeholders(desktop);
    expect(cards).toHaveLength(4);
    // The name and the badge on one row, the criteria, the date.
    for (const card of cards) expect(bars(card)).toBe(4);
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("ALERTUI-38: at desktop width the map shows no zone and no pin, only the pill «Cargando…» with role status", () => {
    const { container } = renderWithI18n(<Loading />, { locale: "es" });

    const map = screen.getByRole("region", { name: ALERT_COPY.mapLabel });
    expect(map).toHaveClass("hidden", "lg:flex");
    const pill = within(map).getByRole("status");
    expect(pill).toHaveTextContent(ALERT_COPY.loading);
    expect(container.querySelector(".maplibregl-marker")).toBeNull();
    expect(zoneShapes()).toEqual([]);
  });

  it("ALERTUI-38: at phone width shows the heading and four phone-card placeholders, with a visually hidden «Cargando…» in a polite status inside the busy region", () => {
    const { container } = renderWithI18n(<Loading />, { locale: "es" });

    const phone = screen.getByTestId("alerts-loading-phone");
    expect(phone).toHaveClass("lg:hidden");
    const busy = container.querySelector<HTMLElement>('[aria-busy="true"]');
    expect(busy).toContainElement(phone);
    const cards = placeholders(phone);
    expect(cards).toHaveLength(4);
    // The name and the badge, the criteria.
    for (const card of cards) expect(bars(card)).toBe(3);
    const status = within(phone).getByRole("status");
    expect(status).toHaveTextContent(ALERT_COPY.loading);
    expect(status).toHaveClass("sr-only");
    expect(status.closest("[aria-live='off']")).toBeNull();
  });

  it("ALERTUI-38: each composition holds exactly one live region — the pill on desktop, the hidden status on the phone", () => {
    renderWithI18n(<Loading />, { locale: "es" });

    const map = screen.getByRole("region", { name: ALERT_COPY.mapLabel });
    const phone = screen.getByTestId("alerts-loading-phone");
    const statuses = screen.getAllByRole("status");
    expect(statuses).toHaveLength(2);
    expect(statuses.filter((status) => map.contains(status))).toHaveLength(1);
    expect(statuses.filter((status) => phone.contains(status))).toHaveLength(1);
  });
});
