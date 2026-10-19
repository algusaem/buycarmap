import { beforeEach, describe, expect, it, vi } from "vitest";
import { lastInputWasKeyboard } from "./input-modality";

// docs/specs/motion.md (MOTION-10 to MOTION-15, Decisions › Keyboard opens and
// closes at once): the app knows which input came last from one place, the
// last key or pointer press on the page. A modifier key on its own is not an
// input.

describe("MOTION-10: lastInputWasKeyboard — the last key or pointer press on the page", () => {
  it("MOTION-10: before any input, the last input is not a key", async () => {
    // A fresh module instance, independent of whatever an earlier test in
    // this file (or a shuffled run order) already dispatched on `window`.
    vi.resetModules();
    const { lastInputWasKeyboard: freshLastInputWasKeyboard } = await import("./input-modality");

    expect(freshLastInputWasKeyboard()).toBe(false);
  });

  describe("after an input", () => {
    beforeEach(() => {
      window.dispatchEvent(new PointerEvent("pointerdown"));
    });

    it("MOTION-10: a key press makes the last input a key", () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));

      expect(lastInputWasKeyboard()).toBe(true);
    });

    it("MOTION-10: a pointer press after a key makes the last input a pointer", () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));

      window.dispatchEvent(new PointerEvent("pointerdown"));

      expect(lastInputWasKeyboard()).toBe(false);
    });

    it("MOTION-10: Shift after a pointer press leaves the last input a pointer", () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift" }));

      expect(lastInputWasKeyboard()).toBe(false);
    });
  });
});
