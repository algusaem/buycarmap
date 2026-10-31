import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { PricePopover, type PricePopoverProps } from "./PricePopover";

// docs/specs/redesign-map.md (MAPUI-11). The two knobs are rendered as
// role="slider" named "Precio mínimo"/"Precio máximo" (the slider half); the
// typed boxes are `type="text"` (so they can show the thousands point while
// not focused), role="textbox", named "Mínimo"/"Máximo" (the box half) —
// names the spec does not give, since it draws both controls without naming
// them individually.

const BASE: PricePopoverProps = {
  minPrice: undefined,
  maxPrice: undefined,
  onApply: vi.fn(),
};

describe("MAPUI-11: PricePopover — the two-knob range", () => {
  it("MAPUI-11: the range runs from 0 to 30.000 € in steps of 500", () => {
    renderWithI18n(<PricePopover {...BASE} />, { locale: "es" });

    const maxKnob = screen.getByRole("slider", { name: "Precio máximo" });
    expect(maxKnob).toHaveAttribute("aria-valuemin", "0");
    expect(maxKnob).toHaveAttribute("aria-valuemax", "30000");
  });

  it("MAPUI-11: the right knob at the end means no maximum", async () => {
    const onApply = vi.fn();
    renderWithI18n(<PricePopover {...BASE} maxPrice={25000} onApply={onApply} />, { locale: "es" });

    const maxKnob = screen.getByRole("slider", { name: "Precio máximo" });
    maxKnob.focus();
    await userEvent.keyboard("{End}");

    expect(onApply).toHaveBeenCalledWith(undefined, undefined);
  });
});

describe("MAPUI-11: PricePopover — the Mínimo and Máximo boxes", () => {
  it("MAPUI-11: typing into Máximo accepts any amount", async () => {
    renderWithI18n(<PricePopover {...BASE} />, { locale: "es" });

    const maxBox = screen.getByRole("textbox", { name: "Máximo" });
    await userEvent.type(maxBox, "45000");

    // Still focused — the box shows exactly what was typed, ungrouped.
    expect(maxBox).toHaveValue("45000");
  });

  it("MAPUI-11 edge case: a Máximo of 0 is never applied, and the box shows the maximum in force (negative path)", () => {
    const onApply = vi.fn();
    renderWithI18n(<PricePopover {...BASE} maxPrice={10000} onApply={onApply} />, {
      locale: "es",
    });

    const maxBox = screen.getByRole("textbox", { name: "Máximo" });
    fireEvent.change(maxBox, { target: { value: "0" } });
    fireEvent.blur(maxBox);

    expect(onApply.mock.calls.map(([, max]) => max)).not.toContain(0);
    expect(onApply).not.toHaveBeenCalled();
    // Not focused — the box reads the maximum still in force, grouped.
    expect(maxBox).toHaveValue("10.000");
  });

  it("MAPUI-11 edge case: a 0 typed into an empty Máximo is not applied either (negative path)", async () => {
    const onApply = vi.fn();
    renderWithI18n(<PricePopover {...BASE} onApply={onApply} />, { locale: "es" });

    const maxBox = screen.getByRole("textbox", { name: "Máximo" });
    await userEvent.type(maxBox, "0");
    await userEvent.tab();

    expect(onApply).not.toHaveBeenCalled();
    expect(maxBox).toHaveValue("");
  });

  it("MAPUI-11 edge case: a minimum typed above the maximum is swapped when the box loses focus", async () => {
    renderWithI18n(<PricePopover {...BASE} maxPrice={10000} />, { locale: "es" });

    const minBox = screen.getByRole("textbox", { name: "Mínimo" });
    await userEvent.type(minBox, "15000");
    await userEvent.tab();

    expect(screen.getByRole("textbox", { name: "Mínimo" })).toHaveValue("10.000");
    expect(screen.getByRole("textbox", { name: "Máximo" })).toHaveValue("15.000");
  });

  it("MAPUI-11: maximum 20.000, typing 25000 into Mínimo and Enter swaps to Mínimo 20.000, Máximo 25.000", async () => {
    function ControlledPopover() {
      const [minPrice, setMinPrice] = useState<number | undefined>(undefined);
      const [maxPrice, setMaxPrice] = useState<number | undefined>(20000);
      return (
        <PricePopover
          minPrice={minPrice}
          maxPrice={maxPrice}
          onApply={(min, max) => {
            setMinPrice(min);
            setMaxPrice(max);
          }}
        />
      );
    }
    renderWithI18n(<ControlledPopover />, { locale: "es" });

    const minBox = screen.getByRole("textbox", { name: "Mínimo" });
    await userEvent.type(minBox, "25000{Enter}");

    expect(screen.getByRole("textbox", { name: "Mínimo" })).toHaveValue("20.000");
    expect(screen.getByRole("textbox", { name: "Máximo" })).toHaveValue("25.000");
  });

  it("MAPUI-11 edge case: an amount above 30.000 € puts the right knob at the end but keeps the exact amount in its box", async () => {
    renderWithI18n(<PricePopover {...BASE} />, { locale: "es" });

    const maxBox = screen.getByRole("textbox", { name: "Máximo" });
    await userEvent.type(maxBox, "45000");

    expect(screen.getByRole("slider", { name: "Precio máximo" })).toHaveAttribute(
      "aria-valuenow",
      "30000",
    );
    // Still focused — the box keeps showing exactly what was typed.
    expect(maxBox).toHaveValue("45000");
  });
});

describe("MAPUI-11: PricePopover — shortcuts", () => {
  it("MAPUI-11: Hasta 10.000 € sets the maximum and clears the minimum", async () => {
    const onApply = vi.fn();
    renderWithI18n(<PricePopover {...BASE} minPrice={3000} onApply={onApply} />, { locale: "es" });

    const shortcuts = screen.getByRole("radiogroup", { name: "Precio máximo" });
    await userEvent.click(within(shortcuts).getByRole("radio", { name: "Hasta 10.000\u00a0€" }));

    expect(onApply).toHaveBeenCalledWith(undefined, 10000);
  });

  it("MAPUI-11: offers exactly the four shortcuts 5.000, 10.000, 20.000 and 30.000", () => {
    renderWithI18n(<PricePopover {...BASE} />, { locale: "es" });

    const shortcuts = within(screen.getByRole("radiogroup", { name: "Precio máximo" }));
    expect(shortcuts.getAllByRole("radio")).toHaveLength(4);
    // No price chosen: no shortcut reads as checked (aria-checked or the native checked state).
    for (const amount of ["5.000", "10.000", "20.000", "30.000"]) {
      const label = `Hasta ${amount}\u00a0€`;
      expect(shortcuts.getByRole("radio", { name: label })).not.toBeChecked();
    }
  });
});

describe("MAPUI-11: PricePopover — Cualquier precio", () => {
  it("MAPUI-11: Cualquier precio clears both the minimum and the maximum", async () => {
    const onApply = vi.fn();
    renderWithI18n(<PricePopover {...BASE} minPrice={3000} maxPrice={20000} onApply={onApply} />, {
      locale: "es",
    });

    await userEvent.click(screen.getByRole("button", { name: "Cualquier precio" }));

    expect(onApply).toHaveBeenCalledWith(undefined, undefined);
  });
});

describe("MAPUI-11: PricePopover — knob steps and the boxes' hand-over", () => {
  it("MAPUI-11: ArrowRight on the right knob moves it one step of 500", async () => {
    const onApply = vi.fn();
    renderWithI18n(<PricePopover {...BASE} maxPrice={10000} onApply={onApply} />, {
      locale: "es",
    });

    const maxKnob = screen.getByRole("slider", { name: "Precio máximo" });
    maxKnob.focus();
    await userEvent.keyboard("{ArrowRight}");

    expect(maxKnob).toHaveAttribute("aria-valuenow", "10500");
    expect(onApply).toHaveBeenLastCalledWith(undefined, 10500);
  });

  it("MAPUI-11: the right knob stops at 500 and never asks for a maximum of 0", async () => {
    const onApply = vi.fn();
    renderWithI18n(<PricePopover {...BASE} maxPrice={1000} onApply={onApply} />, {
      locale: "es",
    });

    const maxKnob = screen.getByRole("slider", { name: "Precio máximo" });
    maxKnob.focus();
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}{ArrowLeft}");

    expect(maxKnob).toHaveAttribute("aria-valuenow", "500");
    expect(onApply).toHaveBeenLastCalledWith(undefined, 500);
    expect(onApply.mock.calls.map(([, max]) => max)).not.toContain(0);
  });

  it("MAPUI-11: a typed maximum reaches onApply as it is typed, before the box loses focus", async () => {
    const onApply = vi.fn();
    renderWithI18n(<PricePopover {...BASE} onApply={onApply} />, { locale: "es" });

    await userEvent.type(screen.getByRole("textbox", { name: "Máximo" }), "45000");

    expect(onApply).toHaveBeenLastCalledWith(undefined, 45000);
  });

  it("MAPUI-11: the swap on losing focus reaches onApply as the swapped amounts", async () => {
    const onApply = vi.fn();
    renderWithI18n(<PricePopover {...BASE} maxPrice={10000} onApply={onApply} />, {
      locale: "es",
    });

    await userEvent.type(screen.getByRole("textbox", { name: "Mínimo" }), "15000");
    await userEvent.tab();

    expect(onApply).toHaveBeenLastCalledWith(10000, 15000);
  });

  it("MAPUI-11: the boxes carry their names, no autofill and the euro sign from the messages", () => {
    renderWithI18n(<PricePopover {...BASE} />, { locale: "es" });

    const minBox = screen.getByRole("textbox", { name: "Mínimo" });
    const maxBox = screen.getByRole("textbox", { name: "Máximo" });
    expect(minBox).toHaveAttribute("name", "minPrice");
    expect(maxBox).toHaveAttribute("name", "maxPrice");
    expect(minBox).toHaveAttribute("autocomplete", "off");
    expect(maxBox).toHaveAttribute("autocomplete", "off");
    expect(screen.getAllByText("€")).toHaveLength(2);
  });
});

describe("PricePopover accessibility", () => {
  it("MAPUI-11: the open popover has no accessibility violations", async () => {
    const { container } = renderWithI18n(
      <PricePopover {...BASE} minPrice={3000} maxPrice={20000} />,
      { locale: "es" },
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
