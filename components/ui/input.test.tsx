import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Input } from "./input";

// docs/specs/motion.md (Key MOTION, Approved), MOTION-5: the input turns its
// border to text-muted on hover while not focused, and moves to the lime
// focus border in the 120ms state transition (amends LOOK-13).

describe("MOTION-5: Input — hover and the focus-border transition", () => {
  it("MOTION-5: carries hover:border-text-muted", () => {
    render(<Input aria-label="Ciudad o código postal" />);

    expect(screen.getByRole("textbox").className).toContain("hover:border-text-muted");
  });

  it("MOTION-5: carries a transition for its border colour", () => {
    render(<Input aria-label="Ciudad o código postal" />);

    const className = screen.getByRole("textbox").className;
    expect(className).toMatch(/transition-\[[^\]]*border-color[^\]]*\]|transition-colors/);
  });
});
