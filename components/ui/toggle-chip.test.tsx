import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { ToggleChip } from "./toggle-chip";

describe("ToggleChip", () => {
  it("reflects the active state via aria-pressed", () => {
    const { rerender } = render(
      <ToggleChip
        label="Diésel"
        active={false}
        onClick={() => {
          /* not under test here: only the rendered aria-pressed state is asserted */
        }}
      />,
    );
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");

    rerender(
      <ToggleChip
        label="Diésel"
        active
        onClick={() => {
          /* not under test here: only the rendered aria-pressed state is asserted */
        }}
      />,
    );
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("calls onClick when pressed", async () => {
    const onClick = vi.fn();
    render(<ToggleChip label="Manual" active={false} onClick={onClick} />);

    await userEvent.click(screen.getByRole("button", { name: "Manual" }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <ToggleChip
        label="Gasolina"
        active
        onClick={() => {
          /* not under test here: only the rendered markup is checked for violations */
        }}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
