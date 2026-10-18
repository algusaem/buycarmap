import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { FilterPanel } from "./FilterPanel";
import { FilterRow } from "./FilterRow";

// docs/specs/redesign-map.md (MAPUI-13). The row shows «Filtros» with its
// badge (counting the active criteria, lib/search/filter-chips.ts's
// filterChips), a divider and the quick filters (MAPUI-58, tested in
// isolation in QuickFilters.test.tsx and lib/search/quick-filters.test.ts);
// it renders no removable chips.

// A closed panel for the tests below that only exercise the row itself —
// FilterPanel's own content is covered by the MAPUI-19 describe below.
const closedPanel = (
  <FilterPanel
    input={{}}
    mode="desktop"
    onChange={vi.fn()}
    onClear={vi.fn()}
    onCloseDesktop={vi.fn()}
  />
);

describe("MAPUI-13: FilterRow — badge and quick filters, no chips", () => {
  it("MAPUI-13: the combined worked example shows a badge of 4, Diésel and Automático pressed, and no remove buttons", () => {
    renderWithI18n(
      <FilterRow
        input={{ engine: ["gasoil"], maxPrice: 20000, gearbox: ["automatic"], timeFilter: "today" }}
        onOpenFilters={vi.fn()}
        onApplyQuick={vi.fn()}
        panel={closedPanel}
        panelOpen={false}
        onClosePanel={vi.fn()}
      />,
      { locale: "es" },
    );

    const filtersButton = screen.getByRole("button", { name: "Filtros" });
    expect(within(filtersButton).getByText("4", { exact: true })).toBeInTheDocument();
    expect(filtersButton).toHaveAccessibleDescription("4 filtros activos");
    expect(screen.getByRole("button", { name: "Diésel" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Automático" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryAllByRole("button", { name: /^Quitar/ })).toHaveLength(0);
  });

  it("MAPUI-13: with no criterion active, shows Filtros with no badge and every quick filter unpressed", () => {
    renderWithI18n(
      <FilterRow
        input={{}}
        onOpenFilters={vi.fn()}
        onApplyQuick={vi.fn()}
        panel={closedPanel}
        panelOpen={false}
        onClosePanel={vi.fn()}
      />,
      { locale: "es" },
    );

    const filtersButton = screen.getByRole("button", { name: "Filtros" });
    expect(within(filtersButton).queryByText(/^\d+$/)).toBeNull();
    for (const name of ["Gasolina", "Diésel", "Manual", "Automático", "Hasta 100.000 km"]) {
      expect(screen.getByRole("button", { name })).toHaveAttribute("aria-pressed", "false");
    }
    expect(screen.queryAllByRole("button", { name: /^Quitar/ })).toHaveLength(0);
  });

  it("MAPUI-13: pressing Filtros opens the filters panel", async () => {
    const onOpenFilters = vi.fn();
    renderWithI18n(
      <FilterRow
        input={{}}
        onApplyQuick={vi.fn()}
        onOpenFilters={onOpenFilters}
        panel={closedPanel}
        panelOpen={false}
        onClosePanel={vi.fn()}
      />,
      { locale: "es" },
    );

    await userEvent.click(screen.getByRole("button", { name: "Filtros" }));

    expect(onOpenFilters).toHaveBeenCalledTimes(1);
  });
});

describe("MAPUI-19: FilterRow — the desktop dropdown", () => {
  const panel = (
    <FilterPanel
      input={{}}
      mode="desktop"
      onChange={vi.fn()}
      onClear={vi.fn()}
      onCloseDesktop={vi.fn()}
    />
  );

  it("MAPUI-19: open, the dropdown holds the header, all six sections and Ver coches", () => {
    renderWithI18n(
      <FilterRow
        input={{}}
        onApplyQuick={vi.fn()}
        onOpenFilters={vi.fn()}
        panel={panel}
        panelOpen
        onClosePanel={vi.fn()}
      />,
      { locale: "es" },
    );

    const dropdown = screen.getByRole("dialog", { name: "Filtros" });
    expect(within(dropdown).getByText("FILTROS")).toBeInTheDocument();
    expect(within(dropdown).getByRole("button", { name: "Borrar" })).toBeInTheDocument();
    expect(
      within(dropdown)
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual([
      "Precio",
      "Combustible",
      "Cambio",
      "Kilómetros y año",
      "Publicado",
      "Marca y modelo",
    ]);
    expect(within(dropdown).getByRole("button", { name: "Ver coches" })).toBeInTheDocument();
  });

  it("MAPUI-19: closed, the dropdown and its fields leave the tree", async () => {
    const { rerender } = renderWithI18n(
      <FilterRow
        input={{}}
        onApplyQuick={vi.fn()}
        onOpenFilters={vi.fn()}
        panel={panel}
        panelOpen
        onClosePanel={vi.fn()}
      />,
      { locale: "es" },
    );
    expect(screen.getByRole("dialog", { name: "Filtros" })).toBeInTheDocument();

    rerender(
      <FilterRow
        input={{}}
        onApplyQuick={vi.fn()}
        onOpenFilters={vi.fn()}
        panel={panel}
        panelOpen={false}
        onClosePanel={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});

describe("MAPUI-19: FilterRow — the dropdown closes without a close button", () => {
  // The caller's open state, held the way MapView holds it.
  function Harness() {
    const [open, setOpen] = useState(true);
    return (
      <FilterRow
        input={{}}
        onApplyQuick={vi.fn()}
        onOpenFilters={() => setOpen(true)}
        panelOpen={open}
        onClosePanel={() => setOpen(false)}
        panel={
          <FilterPanel
            input={{}}
            mode="desktop"
            onChange={vi.fn()}
            onClear={vi.fn()}
            onCloseDesktop={() => setOpen(false)}
          />
        }
      />
    );
  }

  it("MAPUI-19: the open dropdown has no close or «Cerrar» button", () => {
    renderWithI18n(<Harness />, { locale: "es" });

    const dropdown = screen.getByRole("dialog", { name: "Filtros" });
    expect(within(dropdown).queryByRole("button", { name: /cerrar/i })).toBeNull();
  });

  it("MAPUI-19: Escape closes the dropdown", async () => {
    renderWithI18n(<Harness />, { locale: "es" });
    expect(screen.getByRole("dialog", { name: "Filtros" })).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("MAPUI-19: a press outside closes the dropdown", async () => {
    renderWithI18n(<Harness />, { locale: "es" });
    expect(screen.getByRole("dialog", { name: "Filtros" })).toBeInTheDocument();

    await userEvent.click(document.body);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("FilterRow accessibility", () => {
  it("has no accessibility violations with an active fuel and a maximum price", async () => {
    const { container } = renderWithI18n(
      <FilterRow
        input={{ engine: ["gasoil"], maxPrice: 20000 }}
        onApplyQuick={vi.fn()}
        onOpenFilters={vi.fn()}
        panel={closedPanel}
        panelOpen={false}
        onClosePanel={vi.fn()}
      />,
      { locale: "es" },
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
