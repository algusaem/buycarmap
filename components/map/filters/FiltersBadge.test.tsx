import { beforeEach, describe, expect, it } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { renderWithI18n } from "@/test/utils/render";
import { withAnimations } from "@/test/utils/animations";
import { FiltersBadge } from "./FiltersBadge";

// The last input is page-wide (lib/input-modality.ts), so every test starts
// from a pointer press, whatever key the test before it pressed last.
beforeEach(() => {
  window.dispatchEvent(new PointerEvent("pointerdown"));
});

/** No inline opacity below 1: drawn whole, with no fade in flight. */
function expectOpaque(element: HTMLElement) {
  const opacity = element.style.opacity;
  expect(opacity === "" || Number(opacity) >= 1).toBe(true);
}

// docs/specs/motion.md (MOTION-23): the «Filtros» count badge appears and
// leaves with no fade when a key caused the change, and keeps its fade when a
// pointer did.
describe("MOTION-23: FiltersBadge — a key-caused change is instant, a pointer one fades", () => {
  it("MOTION-23: after a key, the badge appears with no inline opacity below 1", async () => {
    await withAnimations(async () => {
      const { rerender } = renderWithI18n(<FiltersBadge count={0} descriptionId="filters" />);

      fireEvent.keyDown(window, { key: " " });
      rerender(<FiltersBadge count={1} descriptionId="filters" />);

      expectOpaque(screen.getByText("1"));
    });
  });

  it("MOTION-23: after a key, the badge is gone in the same tick when the count drops to none", async () => {
    await withAnimations(async () => {
      const { rerender } = renderWithI18n(<FiltersBadge count={1} descriptionId="filters" />);

      fireEvent.keyDown(window, { key: "Enter" });
      await act(async () => {
        rerender(<FiltersBadge count={0} descriptionId="filters" />);
      });

      expect(screen.queryByText("1")).toBeNull();
    });
  });

  it("MOTION-23: after a pointer press, the badge still fades in, with an inline opacity below 1 right after", async () => {
    await withAnimations(async () => {
      const { rerender } = renderWithI18n(<FiltersBadge count={0} descriptionId="filters" />);

      window.dispatchEvent(new PointerEvent("pointerdown"));
      rerender(<FiltersBadge count={1} descriptionId="filters" />);

      expect(Number(screen.getByText("1").style.opacity)).toBeLessThan(1);
    });
  });

  it("MOTION-23: after a pointer press, the badge is still mounted right after the count drops to none", async () => {
    await withAnimations(async (clock) => {
      const { rerender } = renderWithI18n(<FiltersBadge count={1} descriptionId="filters" />);
      await clock.finish();

      window.dispatchEvent(new PointerEvent("pointerdown"));
      await act(async () => {
        rerender(<FiltersBadge count={0} descriptionId="filters" />);
      });

      expect(screen.getByText("1")).toBeInTheDocument();
    });
  });
});
