import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { PhoneSearchBar, type PhoneSearchBarProps } from "./PhoneSearchBar";

// docs/specs/redesign-map.md (MAPUI-20). The "no zoom control, no app
// header" and "the tab bar runs along the bottom" parts of MAPUI-20 describe
// the phone map screen as a whole, not this isolated bar, so they are tested
// in components/map/MapView.test.tsx.

const BASE: PhoneSearchBarProps = {
  placeSummary: "Toda España",
  carPriceSummary: "Cualquier marca · hasta 20.000 €",
  input: {},
  onOpenSearch: vi.fn(),
  onOpenFilters: vi.fn(),
  onRemoveChip: vi.fn(),
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

describe("MAPUI-20: PhoneSearchBar — the filters button and row", () => {
  it("MAPUI-20: shows the filters button beside the summary", async () => {
    const onOpenFilters = vi.fn();
    renderWithI18n(<PhoneSearchBar {...BASE} onOpenFilters={onOpenFilters} />, { locale: "es" });

    await userEvent.click(screen.getByRole("button", { name: /Filtros/ }));

    expect(onOpenFilters).toHaveBeenCalledTimes(1);
  });

  it("MAPUI-20: renders the filters row's chips for the active criteria", () => {
    renderWithI18n(<PhoneSearchBar {...BASE} input={{ engine: ["gasoil"] }} />, { locale: "es" });

    expect(screen.getByText("Diésel")).toBeInTheDocument();
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
