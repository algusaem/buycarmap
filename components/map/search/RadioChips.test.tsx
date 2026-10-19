import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RadioChips } from "./RadioChips";

// docs/specs/motion.md (Key MOTION, Approved), MOTION-5: an unchecked radio
// chip turns its border to text-muted on hover, and every chip scales to 0.97
// while pressed.

const OPTIONS = [
  { value: "manual", label: "Manual" },
  { value: "automatic", label: "Automático" },
];

describe("MOTION-5: RadioChips — hover and press", () => {
  it("MOTION-5: an unchecked chip label carries hover:border-text-muted", () => {
    render(
      <RadioChips
        label="Cambio"
        options={OPTIONS}
        value={undefined}
        onChange={vi.fn()}
        variant="chips"
      />,
    );

    const label = screen.getByText("Manual").closest("label");
    expect(label?.className).toContain("hover:border-text-muted");
  });

  it("MOTION-5: a checked chip label carries no hover:border-text-muted", () => {
    render(
      <RadioChips
        label="Cambio"
        options={OPTIONS}
        value="manual"
        onChange={vi.fn()}
        variant="chips"
      />,
    );

    const label = screen.getByText("Manual").closest("label");
    expect(label, "the Manual chip label").not.toBeNull();
    expect(label?.className).not.toContain("hover:border-text-muted");
  });

  it("MOTION-5: every chip label carries active:scale-97, off under reduced motion", () => {
    render(
      <RadioChips
        label="Cambio"
        options={OPTIONS}
        value="manual"
        onChange={vi.fn()}
        variant="chips"
      />,
    );

    for (const name of ["Manual", "Automático"]) {
      const label = screen.getByText(name).closest("label");
      expect(label?.className).toContain("active:scale-97");
      expect(label?.className).toContain("motion-reduce:active:scale-none");
    }
  });
});
