import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { ToggleChip } from "./toggle-chip";

const noop = () => {
  /* not under test here: only the rendered markup is asserted, never a click. */
};

describe("ToggleChip", () => {
  it("reflects the active state via aria-pressed", () => {
    const { rerender } = render(<ToggleChip label="Diésel" active={false} onClick={noop} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");

    rerender(<ToggleChip label="Diésel" active onClick={noop} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("calls onClick when pressed", async () => {
    const onClick = vi.fn();
    render(<ToggleChip label="Manual" active={false} onClick={onClick} />);

    await userEvent.click(screen.getByRole("button", { name: "Manual" }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<ToggleChip label="Gasolina" active onClick={noop} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

// docs/specs/motion.md (Key MOTION, Approved), MOTION-5: an unpressed chip
// turns its border to text-muted on hover, and every chip scales to 0.97
// while pressed, moving in the 120ms state transition (MOTION-1).
describe("MOTION-5: ToggleChip — hover and press", () => {
  it("MOTION-5: an unpressed chip carries hover:border-text-muted", () => {
    render(<ToggleChip label="Diésel" active={false} onClick={noop} />);

    expect(screen.getByRole("button").className).toContain("hover:border-text-muted");
  });

  it("MOTION-5: a pressed chip carries no hover:border-text-muted", () => {
    render(<ToggleChip label="Diésel" active onClick={noop} />);

    expect(screen.getByRole("button").className).not.toContain("hover:border-text-muted");
  });

  it("MOTION-5: a chip carries active:scale-97, pressed or not, off under reduced motion", () => {
    const { rerender } = render(<ToggleChip label="Diésel" active={false} onClick={noop} />);
    expect(screen.getByRole("button").className).toContain("active:scale-97");
    expect(screen.getByRole("button").className).toContain("motion-reduce:active:scale-none");

    rerender(<ToggleChip label="Diésel" active onClick={noop} />);
    expect(screen.getByRole("button").className).toContain("active:scale-97");
    expect(screen.getByRole("button").className).toContain("motion-reduce:active:scale-none");
  });
});
