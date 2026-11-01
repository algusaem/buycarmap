import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { withAnimations } from "@/test/utils/animations";
import { FilterPanel } from "./FilterPanel";
import { FilterRow } from "./FilterRow";

// The last input is page-wide (lib/input-modality.ts), so every test starts
// from a pointer press, whatever key the test before it pressed last.
beforeEach(() => {
  window.dispatchEvent(new PointerEvent("pointerdown"));
});

// docs/specs/redesign-map.md (MAPUI-13). The row shows «Filtros» with its
// badge (counting the active criteria, lib/search/filter-chips.ts's
// filterChips), a divider and the quick filters (MAPUI-63, tested in
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

  it("MAPUI-75: a minKm and maxKm together count as one active filter, badge 1", () => {
    renderWithI18n(
      <FilterRow
        input={{ minKm: 50000, maxKm: 100000 }}
        onOpenFilters={vi.fn()}
        onApplyQuick={vi.fn()}
        panel={closedPanel}
        panelOpen={false}
        onClosePanel={vi.fn()}
      />,
      { locale: "es" },
    );

    const filtersButton = screen.getByRole("button", { name: "Filtros" });
    expect(within(filtersButton).getByText("1", { exact: true })).toBeInTheDocument();
    expect(filtersButton).toHaveAccessibleDescription("1 filtro activo");
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

  it("MAPUI-19: open, the dropdown holds the header, all seven sections and Ver coches", () => {
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
      "Kilómetros",
      "Año",
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

// docs/specs/map-description-search.md (Key DESC). DESC-1:
// from 1024px the row ends with a divider and the Descripción field; DESC-17:
// the text never counts in the badge. Rendered in English (the default
// locale here), per the spec's Contracts i18n table.
describe("DESC-1: FilterRow — the description field at the end of the row", () => {
  it("DESC-1: shows a field named Search the description, with the applied text and onApplyKeywords wired", () => {
    renderWithI18n(
      <FilterRow
        input={{}}
        onApplyQuick={vi.fn()}
        onOpenFilters={vi.fn()}
        panel={closedPanel}
        panelOpen={false}
        onClosePanel={vi.fn()}
        keywords=""
        onApplyKeywords={vi.fn()}
      />,
    );

    expect(screen.getByRole("searchbox", { name: "Search the description" })).toBeInTheDocument();
  });

  it('DESC-1: with keywords="e46", the field shows it, and Enter calls onApplyKeywords("e46")', async () => {
    const onApplyKeywords = vi.fn();
    renderWithI18n(
      <FilterRow
        input={{ keywords: "e46" }}
        onApplyQuick={vi.fn()}
        onOpenFilters={vi.fn()}
        panel={closedPanel}
        panelOpen={false}
        onClosePanel={vi.fn()}
        keywords="e46"
        onApplyKeywords={onApplyKeywords}
      />,
    );

    const field = screen.getByRole("searchbox", { name: "Search the description" });
    expect(field).toHaveValue("e46");

    await userEvent.type(field, "{Enter}");

    expect(onApplyKeywords).toHaveBeenCalledWith("e46");
  });
});

describe("DESC-17: FilterRow — the text does not count in the Filtros badge", () => {
  it("DESC-17: with only the text applied, Filtros shows no badge", () => {
    renderWithI18n(
      <FilterRow
        input={{ keywords: "e46" }}
        onApplyQuick={vi.fn()}
        onOpenFilters={vi.fn()}
        panel={closedPanel}
        panelOpen={false}
        onClosePanel={vi.fn()}
        keywords="e46"
        onApplyKeywords={vi.fn()}
      />,
      { locale: "es" },
    );

    const filtersButton = screen.getByRole("button", { name: "Filtros" });
    expect(within(filtersButton).queryByText(/^\d+$/)).toBeNull();
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

// docs/specs/motion.md (Key MOTION, Approved), MOTION-6: «Filtros» gains a
// press state alongside its existing hover.
describe("MOTION-6: FilterRow — hover and press on Filtros", () => {
  it("MOTION-6: Filtros carries hover:border-text-muted and active:scale-97, off under reduced motion", () => {
    renderWithI18n(
      <FilterRow
        input={{}}
        onApplyQuick={vi.fn()}
        onOpenFilters={vi.fn()}
        panel={closedPanel}
        panelOpen={false}
        onClosePanel={vi.fn()}
      />,
      { locale: "es" },
    );

    const className = screen.getByRole("button", { name: "Filtros" }).className;
    expect(className).toContain("hover:border-text-muted");
    expect(className).toContain("active:scale-97");
    expect(className).toContain("motion-reduce:active:scale-none");
  });
});

// docs/specs/motion.md (MOTION-10): the desktop «Filtros» dropdown opens and
// closes at once from the keyboard, and still fades for a pointer — the
// worked example «Filtros» (MOTION-10, MOTION-16).
describe("MOTION-10: FilterRow — the dropdown opens and closes at once from the keyboard, but still animates for a pointer", () => {
  function ClosedHarness() {
    const [open, setOpen] = useState(false);
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

  it.each([
    ["Enter", "{Enter}"],
    ["Space", " "],
  ])(
    "MOTION-10: %s on Filtros opens the dropdown with no inline opacity below 1, even with animations enabled",
    async (_key, keys) => {
      await withAnimations(async () => {
        renderWithI18n(<ClosedHarness />, { locale: "es" });
        screen.getByRole("button", { name: "Filtros" }).focus();

        await userEvent.keyboard(keys);

        const dropdown = await screen.findByRole("dialog", { name: "Filtros" });
        const opacity = dropdown.style.opacity;
        expect(opacity === "" || Number(opacity) >= 1).toBe(true);
      });
    },
  );

  it("MOTION-10: Escape closes the dropdown in the same tick, with no exit animation to wait for", async () => {
    await withAnimations(async () => {
      renderWithI18n(<ClosedHarness />, { locale: "es" });
      screen.getByRole("button", { name: "Filtros" }).focus();
      await userEvent.keyboard("{Enter}");
      await screen.findByRole("dialog", { name: "Filtros" });

      await userEvent.keyboard("{Escape}");

      // Not even mounted as a hidden, leaving element.
      expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();
    });
  });

  it("MOTION-10: opened with a click and closed with Escape, the dropdown is gone in the same tick (worked example «Filtros», third row)", async () => {
    await withAnimations(async () => {
      renderWithI18n(<ClosedHarness />, { locale: "es" });
      await userEvent.click(screen.getByRole("button", { name: "Filtros" }));
      await screen.findByRole("dialog", { name: "Filtros" });

      await userEvent.keyboard("{Escape}");

      expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();
    });
  });

  it("MOTION-10: a click on Filtros still fades the dropdown in, with an inline opacity below 1 right after", async () => {
    await withAnimations(async () => {
      renderWithI18n(<ClosedHarness />, { locale: "es" });

      await userEvent.click(screen.getByRole("button", { name: "Filtros" }));

      const dropdown = await screen.findByRole("dialog", { name: "Filtros" });
      expect(Number(dropdown.style.opacity)).toBeLessThan(1);
    });
  });

  it("MOTION-10: a click outside still plays the close animation — the dropdown is still mounted right after", async () => {
    await withAnimations(async (clock) => {
      renderWithI18n(<ClosedHarness />, { locale: "es" });
      await userEvent.click(screen.getByRole("button", { name: "Filtros" }));
      await screen.findByRole("dialog", { name: "Filtros" });
      await clock.finish();

      await userEvent.click(document.body);

      // Still in the document while its exit plays: aria-hidden and inert
      // (PopoverCard.tsx), so it is found only by asking for hidden roles —
      // and an aria-hidden node's computed accessible name is empty, so its
      // identity is checked by the aria-label attribute instead of by name.
      const dropdown = screen.getByRole("dialog", { hidden: true });
      expect(dropdown).toHaveAttribute("aria-label", "Filtros");
    });
  });
  it("MOTION-10: reopened with Enter while its pointer close still plays, the dropdown is drawn whole at once", async () => {
    await withAnimations(async (clock) => {
      renderWithI18n(<ClosedHarness />, { locale: "es" });
      const filtros = screen.getByRole("button", { name: "Filtros" });
      await userEvent.click(filtros);
      await screen.findByRole("dialog", { name: "Filtros" });
      await clock.finish();
      await userEvent.click(document.body);
      // A frame into the 180ms fade out.
      await clock.advance(16);
      const leaving = screen.getByRole("dialog", { hidden: true });
      expect(Number(leaving.style.opacity)).toBeLessThan(1);

      filtros.focus();
      await userEvent.keyboard("{Enter}");
      // Drawn with no time passing: at once, not over a fade.
      await clock.advance(0);

      const dropdown = screen.getByRole("dialog", { name: "Filtros" });
      expect(dropdown.style.opacity === "" || Number(dropdown.style.opacity) >= 1).toBe(true);
    });
  });
});
