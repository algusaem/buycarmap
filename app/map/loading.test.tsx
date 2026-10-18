import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import Loading from "./loading";

// docs/specs/redesign-map.md (MAPUI-30, MAPUI-34); docs/design/canvas/
// F0-estado-cargando.dc.html. At desktop width, "/map"'s own loading state is
// the list-column skeleton (FRONT-14 pattern). Below lg it
// mirrors the map screen itself: the band with the search summary, «Filtros»
// and the quick filters over a plain map surface, and the results sheet in its
// middle position with the loading heading and one placeholder card.

describe("MAPUI-30: /map loading.tsx", () => {
  it("MAPUI-30: has no accessibility violations", async () => {
    const { container } = renderWithI18n(<Loading />, { locale: "es" });

    expect(await axe(container)).toHaveNoViolations();
  });

  it("MAPUI-30: a named busy region exists for each width, both reading the same loading status", () => {
    const { container } = renderWithI18n(<Loading />, { locale: "es" });

    const regions = container.querySelectorAll('[aria-busy="true"]');
    // Both carry the status (ResultsSkeleton's `label`, and the phone
    // frame's own wrapper outside its `inert` part): CSS, which jsdom does
    // not evaluate, is what keeps only one of the two shown at a given
    // width.
    expect(regions).toHaveLength(2);
    for (const region of regions) {
      expect(region).toHaveTextContent("Buscando coches…");
    }
  });

  it("MAPUI-30: the phone frame is inert", () => {
    const { container } = renderWithI18n(<Loading />, { locale: "es" });

    const inertFrame = container.querySelector("[inert]");
    expect(inertFrame).not.toBeNull();
    expect(inertFrame).toContainElement(screen.getByRole("button", { name: "Filtros" }));
  });

  it("MAPUI-30: the phone summary reads like the live page with no place and no filters", () => {
    renderWithI18n(<Loading />, { locale: "es" });

    expect(screen.getByText("Toda España")).toBeInTheDocument();
    expect(screen.getByText("Cualquier marca · Cualquier precio")).toBeInTheDocument();
  });

  it("MAPUI-30: Filtros is present", () => {
    renderWithI18n(<Loading />, { locale: "es" });

    expect(screen.getByRole("button", { name: "Filtros" })).toBeInTheDocument();
  });

  it("MAPUI-30: below lg, shows the results sheet in its middle position with the loading heading and one placeholder card", () => {
    renderWithI18n(<Loading />, { locale: "es" });

    expect(screen.getByText("BUSCANDO COCHES…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lista de resultados" })).toBeInTheDocument();

    const sheet = screen.getByTestId("results-sheet");
    expect(sheet.querySelectorAll(".rounded-card")).toHaveLength(1);
  });

  it("MAPUI-30: keeps the desktop column of placeholders, shown only from lg", () => {
    renderWithI18n(<Loading />, { locale: "es" });

    const desktopColumn = screen.getByTestId("map-loading-desktop");
    expect(desktopColumn.className).toContain("hidden");
    expect(desktopColumn.className).toContain("lg:block");
  });

  it("MAPUI-30: the phone loading frame shows the quick filters, none pressed", () => {
    renderWithI18n(<Loading />, { locale: "es" });

    const quickFilters = screen.getByRole("group", { name: "Filtros rápidos" });
    const buttons = within(quickFilters).getAllByRole("button");
    expect(buttons).toHaveLength(5);
    for (const button of buttons) {
      expect(button).toHaveAttribute("aria-pressed", "false");
    }
  });
});
