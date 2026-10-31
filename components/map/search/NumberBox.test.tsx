import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithI18n } from "@/test/utils/render";
import { NumberBox } from "./NumberBox";

// docs/specs/motion.md (Key MOTION, Approved), MOTION-5: the number box turns
// its border to text-muted on hover while not focused. The 120ms focus-border
// transition is already there (transition-[border-color]), unchanged by this
// spec.

describe("MOTION-5: NumberBox — hover", () => {
  it("MOTION-5: the box's wrapper carries hover:border-text-muted", () => {
    renderWithI18n(
      <NumberBox
        name="maxKm"
        label="Kilómetros, hasta"
        value={undefined}
        onValueChange={vi.fn()}
        onCommit={vi.fn()}
      />,
    );

    const box = screen.getByRole("textbox").closest("div");
    expect(box?.className).toContain("hover:border-text-muted");
  });
});

// docs/specs/redesign-map.md (MAPUI-86, amended 2026-10-31): after Enter
// applies a swap, the focused box shows the applied amount, as after leaving
// it — Enter has to clear the typed text the same way handleBlur does, or a
// later prop update (the parent applying the swap) renders behind what is
// still typed.
describe("MAPUI-86: NumberBox — Enter clears the typed text", () => {
  it("MAPUI-86: typing 150000 then Enter, followed by a rerender with the unchanged value 100000, shows it grouped — not what was typed", () => {
    const onCommit = vi.fn();
    const { rerender } = renderWithI18n(
      <NumberBox
        name="maxKm"
        label="Máximo"
        value={100000}
        onValueChange={vi.fn()}
        onCommit={onCommit}
        grouped
      />,
      { locale: "es" },
    );
    const box = screen.getByRole("textbox");

    fireEvent.change(box, { target: { value: "150000" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onCommit).toHaveBeenCalledTimes(1);

    rerender(
      <NumberBox
        name="maxKm"
        label="Máximo"
        value={100000}
        onValueChange={vi.fn()}
        onCommit={onCommit}
        grouped
      />,
    );

    expect(box).toHaveValue("100.000");
  });
});
