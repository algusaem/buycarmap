import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithI18n } from "@/test/utils/render";

// FRONT-14 (docs/specs/core-frontend.md): /favorites needs a loading state —
// a skeleton mirroring the final card grid (RULES.md §19: "Skeletons mirror
// final content to avoid layout shift") — alongside the error state
// app/favorites/error.tsx already has (PLAT-14) and the empty/populated
// states FavoritesList already renders.
//
// Amended by docs/specs/redesign-saved.md (SAVED-30, SAVED-13): the loading
// state mirrors the redesigned page, at desktop width the heading, the
// chips, Guardados-card placeholders and the map with only its pill, at phone
// width the heading and row placeholders. It is a Server Component that draws
// both compositions and lets CSS breakpoints pick one; jsdom applies no CSS,
// so each composition is found by its breakpoint classes.
import Loading from "./loading";

describe("FavoritesLoading", () => {
  it("FRONT-14: shows a loading skeleton that mirrors the card grid", () => {
    const { container } = renderWithI18n(<Loading />);

    // aria-busy, not colour alone, marks the region as loading for assistive
    // tech (RULES.md §19 "redundant status cues"). Not role="status": that
    // would clash with PlaceField's own live region on the map's results
    // list under strict mode (MAP-20).
    // Note (2026-10-15): SAVED-30 requires a polite status inside the busy
    // region, so this page's busy region does hold one (the case below).
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });
});

/** The aria-hidden placeholders inside a composition. */
function placeholders(composition: HTMLElement): Element[] {
  return Array.from(composition.children).filter(
    (child) => child.getAttribute("aria-hidden") === "true",
  );
}

describe("SAVED-30: the loading state", () => {
  it("SAVED-30: at desktop width shows the heading and the chips, aria-hidden card placeholders in one busy region, and the map with only its pill", () => {
    const { container } = renderWithI18n(<Loading />, { locale: "es" });

    expect(screen.getByRole("heading", { level: 1, name: "Guardados" })).toBeInTheDocument();
    const chips = screen.getByTestId("saved-loading-chips");
    // SortChips hides itself below lg (components/favorites/SortChips.tsx).
    expect(chips.firstElementChild).toHaveClass("max-lg:hidden");
    expect(within(chips).getByText("Recientes")).toBeInTheDocument();
    expect(within(chips).getByText("Precio")).toBeInTheDocument();
    expect(within(chips).getByText("Km")).toBeInTheDocument();

    const busy = container.querySelectorAll('[aria-busy="true"]');
    expect(busy).toHaveLength(1);
    const desktop = screen.getByTestId("saved-loading-desktop");
    expect(busy[0]).toContainElement(desktop);
    expect(desktop).toHaveClass("hidden", "lg:grid", "lg:grid-cols-2", "xl:grid-cols-3");
    // Six cards: two rows at three columns, three rows at two.
    expect(placeholders(desktop)).toHaveLength(6);
    expect(desktop.querySelector(".aspect-20\\/17")).not.toBeNull();

    const map = screen.getByRole("region", { name: "Mapa de tus guardados" });
    expect(map).toHaveClass("hidden", "lg:flex");
    expect(within(map).getByText("Tus guardados en el mapa")).toBeInTheDocument();
    expect(container.querySelector(".leaflet-marker-icon")).toBeNull();
  });

  it("SAVED-30: holds a visually hidden «Cargando…» in a polite status, the page's only live region", () => {
    const { container } = renderWithI18n(<Loading />, { locale: "es" });

    const [busy] = Array.from(container.querySelectorAll<HTMLElement>('[aria-busy="true"]'));
    expect(busy).toBeDefined();
    const status = within(busy).getByRole("status");
    expect(status).toHaveTextContent("Cargando…");
    expect(status.closest("[aria-live='off']")).toBeNull();
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(
      container.querySelectorAll("[aria-live]:not([aria-live='off'])").length,
    ).toBeLessThanOrEqual(1);
  });

  it("SAVED-30: at phone width shows the heading and row placeholders, with the chips and the map hidden below lg", () => {
    const { container } = renderWithI18n(<Loading />, { locale: "es" });

    expect(screen.getByRole("heading", { level: 1, name: "Guardados" })).toBeInTheDocument();
    const phone = screen.getByTestId("saved-loading-phone");
    expect(phone).toHaveClass("lg:hidden");
    expect(container.querySelector('[aria-busy="true"]')).toContainElement(phone);
    // Seven rows, each the 110×86 thumbnail and three bars.
    const rows = placeholders(phone);
    expect(rows).toHaveLength(7);
    for (const row of rows) {
      expect(row.querySelector(".h-21\\.5.w-27\\.5")).not.toBeNull();
      expect(row.querySelectorAll(".rounded-skeleton-sm, .rounded-skeleton")).toHaveLength(3);
    }
    expect(screen.getByTestId("saved-loading-chips").firstElementChild).toHaveClass(
      "max-lg:hidden",
    );
    expect(screen.getByRole("region", { name: "Mapa de tus guardados" })).toHaveClass("hidden");
  });

  it("SAVED-13: while the page loads, the map's pill reads «Tus guardados en el mapa» with no role", () => {
    renderWithI18n(<Loading />, { locale: "es" });

    const pill = screen.getByText("Tus guardados en el mapa");
    expect(pill.closest('[role="status"]')).toBeNull();
  });
});
