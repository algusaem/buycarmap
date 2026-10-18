import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { PhoneSearchBar, type PhoneSearchBarProps } from "./PhoneSearchBar";

// docs/specs/redesign-map.md (MAPUI-20, MAPUI-62). The "no zoom control, no
// app header" and "the tab bar runs along the bottom" parts of MAPUI-20
// describe the phone map screen as a whole, not this isolated bar, so they
// are tested in components/map/MapView.test.tsx.
//
// The band carries one real, visible «Filters» button (map.filters), named
// in English because these tests render with the default English locale so
// the exact accessible name (MAPUI-62: "named «Filtros»") is asserted
// literally.

const BASE: PhoneSearchBarProps = {
  placeSummary: "Toda España",
  carPriceSummary: "Cualquier marca · hasta 20.000 €",
  input: {},
  onOpenSearch: vi.fn(),
  onOpenFilters: vi.fn(),
  onApplyQuick: vi.fn(),
};

describe("MAPUI-20: PhoneSearchBar — the search summary", () => {
  it('MAPUI-20: shows "Madrid · 50 km" over "Cualquier marca · hasta 20.000 €"', async () => {
    renderWithI18n(
      <PhoneSearchBar
        {...BASE}
        placeSummary="Madrid · 50 km"
        carPriceSummary="Cualquier marca · hasta 20.000 €"
      />,
      { locale: "es" },
    );

    const summary = await screen.findByRole("button", { name: /Madrid/ });
    expect(summary).toHaveTextContent("Madrid · 50 km");
    expect(summary).toHaveTextContent("Cualquier marca · hasta 20.000 €");
  });

  it('MAPUI-20: shows "Toda España" with no place chosen', () => {
    renderWithI18n(<PhoneSearchBar {...BASE} placeSummary="Toda España" />, { locale: "es" });

    expect(screen.getByRole("button", { name: /Toda España/ })).toBeInTheDocument();
  });

  it("MAPUI-20: tapping the summary opens the search sheet", async () => {
    const onOpenSearch = vi.fn();
    renderWithI18n(<PhoneSearchBar {...BASE} onOpenSearch={onOpenSearch} />, { locale: "es" });

    await userEvent.click(screen.getByRole("button", { name: /Toda España/ }));

    expect(onOpenSearch).toHaveBeenCalledTimes(1);
  });
});

describe("MAPUI-62: PhoneSearchBar — the Filters button", () => {
  it('MAPUI-62: shows the round "Filters" button beside the summary and opens the filters dialog', async () => {
    const onOpenFilters = vi.fn();
    renderWithI18n(
      <PhoneSearchBar {...BASE} onOpenFilters={onOpenFilters} onApplyQuick={vi.fn()} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Filters" }));

    expect(onOpenFilters).toHaveBeenCalledTimes(1);
  });

  it("MAPUI-62: shows the count 3 as visible text for an input with three panel criteria", () => {
    renderWithI18n(
      <PhoneSearchBar
        {...BASE}
        input={{ engine: ["gasoil"], gearbox: ["automatic"], timeFilter: "today" }}
        onApplyQuick={vi.fn()}
      />,
    );

    const button = screen.getByRole("button", { name: "Filters" });
    expect(within(button).getByText("3", { exact: true })).toBeInTheDocument();
    expect(button).toHaveAccessibleDescription("3 active filters");
  });

  it("MAPUI-62: shows the singular count 1 for an input with one panel criterion", () => {
    renderWithI18n(
      <PhoneSearchBar {...BASE} input={{ engine: ["gasoil"] }} onApplyQuick={vi.fn()} />,
    );

    const button = screen.getByRole("button", { name: "Filters" });
    expect(within(button).getByText("1", { exact: true })).toBeInTheDocument();
    expect(button).toHaveAccessibleDescription("1 active filter");
  });

  it("MAPUI-62: shows the Spanish singular «1 filtro activo» for an input with one panel criterion", () => {
    renderWithI18n(
      <PhoneSearchBar {...BASE} input={{ engine: ["gasoil"] }} onApplyQuick={vi.fn()} />,
      { locale: "es" },
    );

    const button = screen.getByRole("button", { name: "Filtros" });
    expect(within(button).getByText("1", { exact: true })).toBeInTheDocument();
    expect(button).toHaveAccessibleDescription("1 filtro activo");
  });

  it("MAPUI-62: shows no count with no active criterion", () => {
    renderWithI18n(<PhoneSearchBar {...BASE} input={{}} onApplyQuick={vi.fn()} />);

    const button = screen.getByRole("button", { name: "Filters" });
    expect(within(button).queryByText(/^\d+$/)).toBeNull();
    expect(button).not.toHaveAccessibleDescription();
  });
});

describe("MAPUI-58/MAPUI-62: PhoneSearchBar — the quick filters, no chip remove buttons", () => {
  it("MAPUI-58: renders the quick filters group under the summary and the Filters button", () => {
    renderWithI18n(
      <PhoneSearchBar {...BASE} input={{ engine: ["gasoil"] }} onApplyQuick={vi.fn()} />,
    );

    expect(screen.getByRole("group", { name: "Quick filters" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Diesel" })).toHaveAttribute("aria-pressed", "true");
  });

  it("MAPUI-62: renders no chip remove buttons", () => {
    renderWithI18n(
      <PhoneSearchBar {...BASE} input={{ engine: ["gasoil"] }} onApplyQuick={vi.fn()} />,
    );

    expect(screen.queryAllByRole("button", { name: /^Remove/ })).toHaveLength(0);
  });
});

describe("PhoneSearchBar accessibility", () => {
  it("has no accessibility violations", async () => {
    const { container } = renderWithI18n(
      <PhoneSearchBar {...BASE} input={{ engine: ["gasoil"] }} />,
      { locale: "es" },
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
