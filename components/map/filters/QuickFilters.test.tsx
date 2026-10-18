import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { QuickFilters } from "./QuickFilters";

// docs/specs/redesign-map.md (MAPUI-63). The toggle semantics themselves are
// lib/search/quick-filters.ts's job, tested in isolation there; this file is
// about the five buttons rendering in order, their pressed state and wiring
// clicks to `onApply`.

describe("MAPUI-63: QuickFilters — rendering", () => {
  it("MAPUI-63: renders the five quick filters, in order, inside a group, each a toggle button", () => {
    renderWithI18n(<QuickFilters input={{}} onApply={vi.fn()} />);

    const group = screen.getByRole("group", { name: "Quick filters" });
    const buttons = within(group).getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual([
      "Petrol",
      "Diesel",
      "Manual",
      "Automatic",
      "Up to 100,000 km",
    ]);
    for (const button of buttons) {
      expect(button).toHaveAttribute("aria-pressed");
    }
  });
});

describe("MAPUI-63: QuickFilters — pressed state", () => {
  it("MAPUI-63: with engine=gasoil and gearbox=automatic, exactly Diesel and Automatic are pressed", () => {
    renderWithI18n(
      <QuickFilters input={{ engine: ["gasoil"], gearbox: ["automatic"] }} onApply={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: "Diesel" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Automatic" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Petrol" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Manual" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Up to 100,000 km" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("MAPUI-63/LOOK-12: the pressed Diesel reads font-extrabold, the unpressed Petrol font-semibold", () => {
    renderWithI18n(<QuickFilters input={{ engine: ["gasoil"] }} onApply={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Diesel" })).toHaveClass("font-extrabold");
    expect(screen.getByRole("button", { name: "Petrol" })).toHaveClass("font-semibold");
  });
});

describe("MAPUI-63: QuickFilters — applying a patch at once", () => {
  it("MAPUI-63: clicking Manual on engine=gasoil, gearbox=automatic applies gearbox=manual", async () => {
    const onApply = vi.fn();
    renderWithI18n(
      <QuickFilters input={{ engine: ["gasoil"], gearbox: ["automatic"] }} onApply={onApply} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Manual" }));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith({ gearbox: ["manual"] });
  });

  it("MAPUI-63: clicking the pressed Diesel on engine=gasoil, gearbox=automatic clears the fuel", async () => {
    const onApply = vi.fn();
    renderWithI18n(
      <QuickFilters input={{ engine: ["gasoil"], gearbox: ["automatic"] }} onApply={onApply} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Diesel" }));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0]).toStrictEqual({ engine: undefined });
  });

  it("MAPUI-63: clicking the km toggle on maxKm=150000 sets the maximum mileage to 100000", async () => {
    const onApply = vi.fn();
    renderWithI18n(<QuickFilters input={{ maxKm: 150000 }} onApply={onApply} />);

    await userEvent.click(screen.getByRole("button", { name: "Up to 100,000 km" }));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith({ maxKm: 100000 });
  });
});

describe("QuickFilters accessibility", () => {
  it("has no accessibility violations", async () => {
    const { container } = renderWithI18n(
      <QuickFilters input={{ engine: ["gasoil"], gearbox: ["automatic"] }} onApply={vi.fn()} />,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
