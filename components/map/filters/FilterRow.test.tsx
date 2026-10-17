import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import type { ChipKey } from "@/lib/search/filter-chips";
import type { SearchInput } from "@/lib/search/schema";
import { FilterPanel } from "./FilterPanel";
import { FilterRow } from "./FilterRow";

// docs/specs/redesign-map.md (MAPUI-13). Chip texts and the badge count come
// from lib/search/filter-chips.ts's filterChips, tested in isolation there;
// this file is about the row rendering them and wiring the remove button.

describe("MAPUI-13: FilterRow — badge and chips", () => {
  it("MAPUI-13: the combined worked example shows a badge of 4 and the four chip texts", () => {
    renderWithI18n(
      <FilterRow
        input={{ engine: ["gasoil"], maxPrice: 20000, gearbox: ["automatic"], timeFilter: "today" }}
        onRemove={vi.fn()}
        onOpenFilters={vi.fn()}
      />,
      { locale: "es" },
    );

    const filtersButton = screen.getByRole("button", { name: "Filtros4" });
    expect(filtersButton.textContent).toBe("Filtros4");
    for (const label of ["Diésel", "Hasta 20.000 €", "Automático", "Últimas 24 h"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("MAPUI-13: with no criterion active, shows Filtros with no badge", () => {
    renderWithI18n(<FilterRow input={{}} onRemove={vi.fn()} onOpenFilters={vi.fn()} />, {
      locale: "es",
    });

    const filtersButton = screen.getByRole("button", { name: "Filtros" });
    expect(filtersButton).not.toHaveTextContent(/\d/);
  });

  it("MAPUI-13: pressing Filtros opens the filters panel", async () => {
    const onOpenFilters = vi.fn();
    renderWithI18n(<FilterRow input={{}} onRemove={vi.fn()} onOpenFilters={onOpenFilters} />, {
      locale: "es",
    });

    await userEvent.click(screen.getByRole("button", { name: "Filtros" }));

    expect(onOpenFilters).toHaveBeenCalledTimes(1);
  });
});

describe("MAPUI-13: FilterRow — removing a chip", () => {
  it("MAPUI-13: removing the Diésel chip reports its key", async () => {
    const onRemove = vi.fn();
    renderWithI18n(
      <FilterRow input={{ engine: ["gasoil"] }} onRemove={onRemove} onOpenFilters={vi.fn()} />,
      { locale: "es" },
    );

    await userEvent.click(screen.getByRole("button", { name: "Quitar Diésel" }));

    expect(onRemove).toHaveBeenCalledWith("engine:gasoil");
  });
});

// A harness that actually removes the criterion, unlike the stubbed
// `onRemove` above — focus moves depending on which chip is left where the
// removed one stood, so the chips list must really change.
function RemovalHarness({ initial }: { initial: SearchInput }) {
  const [input, setInput] = useState<SearchInput>(initial);

  function onRemove(key: ChipKey) {
    setInput((current) => {
      const next = { ...current };
      if (key === "gearbox") next.gearbox = undefined;
      else if (key === "maxPrice") next.maxPrice = undefined;
      else if (key.startsWith("engine:")) next.engine = undefined;
      return next;
    });
  }

  return <FilterRow input={input} onRemove={onRemove} onOpenFilters={vi.fn()} />;
}

describe("FilterRow — focus after removing a chip", () => {
  it("MAPUI-13: removing a middle chip moves focus to the chip now in its place", async () => {
    renderWithI18n(
      <RemovalHarness initial={{ engine: ["gasoil"], maxPrice: 20000, gearbox: ["automatic"] }} />,
      { locale: "es" },
    );

    await userEvent.click(screen.getByRole("button", { name: /^Quitar Hasta 20.000/ }));

    expect(screen.getByRole("button", { name: "Quitar Automático" })).toHaveFocus();
  });

  it("MAPUI-13: removing the last chip moves focus to the previous chip", async () => {
    renderWithI18n(
      <RemovalHarness initial={{ engine: ["gasoil"], maxPrice: 20000, gearbox: ["automatic"] }} />,
      { locale: "es" },
    );

    await userEvent.click(screen.getByRole("button", { name: "Quitar Automático" }));

    expect(screen.getByRole("button", { name: /^Quitar Hasta 20.000/ })).toHaveFocus();
  });

  it("MAPUI-13: removing the only chip left moves focus to Filtros", async () => {
    renderWithI18n(<RemovalHarness initial={{ engine: ["gasoil"] }} />, { locale: "es" });

    await userEvent.click(screen.getByRole("button", { name: "Quitar Diésel" }));

    expect(screen.getByRole("button", { name: "Filtros" })).toHaveFocus();
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
      <FilterRow input={{}} onRemove={vi.fn()} onOpenFilters={vi.fn()} panel={panel} panelOpen />,
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
      <FilterRow input={{}} onRemove={vi.fn()} onOpenFilters={vi.fn()} panel={panel} panelOpen />,
      { locale: "es" },
    );
    expect(screen.getByRole("dialog", { name: "Filtros" })).toBeInTheDocument();

    rerender(
      <FilterRow
        input={{}}
        onRemove={vi.fn()}
        onOpenFilters={vi.fn()}
        panel={panel}
        panelOpen={false}
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
        onRemove={vi.fn()}
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

describe("MAPUI-13: FilterRow — the row scrolls sideways at every width (design accepted 2026-10-14)", () => {
  it("MAPUI-13: keeps Filtros fixed outside the chips' horizontal scroller on desktop", () => {
    renderWithI18n(
      <FilterRow
        input={{ engine: ["gasoil"], maxPrice: 20000, gearbox: ["automatic"], timeFilter: "today" }}
        onRemove={vi.fn()}
        onOpenFilters={vi.fn()}
      />,
      { locale: "es" },
    );

    const filtersButton = screen.getByRole("button", { name: "Filtros4" });
    const chip = screen.getByText("Diésel");
    const scroller = chip.closest(".overflow-x-auto");

    expect(scroller).not.toBeNull();
    expect(scroller?.contains(filtersButton)).toBe(false);
  });

  it("MAPUI-13: keeps Filtros fixed outside the chips' horizontal scroller over the phone map", () => {
    renderWithI18n(
      <FilterRow
        input={{ engine: ["gasoil"], maxPrice: 20000, gearbox: ["automatic"], timeFilter: "today" }}
        onRemove={vi.fn()}
        onOpenFilters={vi.fn()}
        overMap
      />,
      { locale: "es" },
    );

    const filtersButton = screen.getByRole("button", { name: "Filtros4" });
    const chip = screen.getByText("Diésel");
    const scroller = chip.closest(".overflow-x-auto");

    expect(scroller).not.toBeNull();
    expect(scroller?.contains(filtersButton)).toBe(false);
  });
});

describe("FilterRow accessibility", () => {
  it("has no accessibility violations with an active fuel and a maximum price", async () => {
    const { container } = renderWithI18n(
      <FilterRow
        input={{ engine: ["gasoil"], maxPrice: 20000 }}
        onRemove={vi.fn()}
        onOpenFilters={vi.fn()}
      />,
      { locale: "es" },
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
