import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnimatePresence } from "motion/react";
import { withAnimations } from "@/test/utils/animations";
import { PopoverCard } from "./PopoverCard";

// docs/specs/redesign-map.md (MAPUI-2). The global jsdom setup makes every
// exit instant, which would skip straight past the state under test here: a
// card that AnimatePresence keeps mounted while it animates out. This file
// turns real animations back on and gives the exit a long duration so the
// exiting card can be observed.

function Harness({ open }: { open: boolean }) {
  return (
    <AnimatePresence>
      {open && (
        <PopoverCard
          key="card"
          role="dialog"
          aria-label="Dónde"
          exit={{ opacity: 0 }}
          transition={{ duration: 60 }}
        >
          <input role="combobox" aria-label="Ciudad o código postal" aria-expanded={false} />
        </PopoverCard>
      )}
    </AnimatePresence>
  );
}

describe("MAPUI-2: PopoverCard — a closing popover leaves the accessibility tree", () => {
  it("MAPUI-2: while open, the card and its combobox are exposed and interactive", async () => {
    await withAnimations(async () => {
      render(<Harness open />);

      const card = screen.getByRole("dialog", { name: "Dónde" });
      expect(card).not.toHaveAttribute("aria-hidden");
      expect(card).not.toHaveAttribute("inert");
      expect(screen.getByRole("combobox", { name: "Ciudad o código postal" })).toBeInTheDocument();
    });
  });

  it("MAPUI-2: while it animates out, the card is still mounted but aria-hidden and inert, so no combobox is exposed", async () => {
    await withAnimations(async () => {
      const { rerender } = render(<Harness open />);

      rerender(<Harness open={false} />);

      // Still in the DOM: the 60s exit has not finished.
      // aria-hidden also drops its accessible name, so it is found by role alone.
      const exiting = screen.getByRole("dialog", { hidden: true });
      expect(exiting).toHaveAttribute("aria-label", "Dónde");
      expect(exiting).toHaveAttribute("aria-hidden", "true");
      expect(exiting).toHaveAttribute("inert");
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.queryByRole("combobox")).toBeNull();
    });
  });
});
