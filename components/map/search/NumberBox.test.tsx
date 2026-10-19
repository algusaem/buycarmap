import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
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
