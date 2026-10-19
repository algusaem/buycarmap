import { beforeEach, describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { withAnimations } from "@/test/utils/animations";
import { FieldMessage } from "./FieldMessage";

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

// docs/specs/motion.md (MOTION-23): a validation message appears and leaves
// with no fade when a key caused the change (Enter submitting the form), and
// keeps its fade when a pointer did.
describe("MOTION-23: FieldMessage — a key-caused change is instant, a pointer one fades", () => {
  it("MOTION-23: after a key, the message appears with no inline opacity below 1", async () => {
    await withAnimations(async () => {
      const { rerender } = render(<FieldMessage show={false}>Enter your email.</FieldMessage>);

      fireEvent.keyDown(window, { key: "Enter" });
      rerender(<FieldMessage show>Enter your email.</FieldMessage>);

      expectOpaque(screen.getByText("Enter your email."));
    });
  });

  it("MOTION-23: after a key, the message is gone in the same tick when it is hidden", async () => {
    await withAnimations(async () => {
      const { rerender } = render(<FieldMessage show>Enter your email.</FieldMessage>);

      fireEvent.keyDown(window, { key: "a" });
      await act(async () => {
        rerender(<FieldMessage show={false}>Enter your email.</FieldMessage>);
      });

      expect(screen.queryByText("Enter your email.")).toBeNull();
    });
  });

  it("MOTION-23: after a pointer press, the message still fades in, with an inline opacity below 1 right after", async () => {
    await withAnimations(async () => {
      const { rerender } = render(<FieldMessage show={false}>Enter your email.</FieldMessage>);

      window.dispatchEvent(new PointerEvent("pointerdown"));
      rerender(<FieldMessage show>Enter your email.</FieldMessage>);

      expect(Number(screen.getByText("Enter your email.").style.opacity)).toBeLessThan(1);
    });
  });

  it("MOTION-23: after a pointer press, the message is still mounted right after it is hidden", async () => {
    await withAnimations(async () => {
      const { rerender } = render(<FieldMessage show>Enter your email.</FieldMessage>);

      window.dispatchEvent(new PointerEvent("pointerdown"));
      await act(async () => {
        rerender(<FieldMessage show={false}>Enter your email.</FieldMessage>);
      });

      expect(screen.getByText("Enter your email.")).toBeInTheDocument();
    });
  });
});
