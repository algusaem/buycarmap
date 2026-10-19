import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useChangedByKey } from "./useChangedByKey";

// docs/specs/motion.md (MOTION-23): whether the last change of a boolean
// value happened right after a key press, read from lib/input-modality.ts in
// the render where the value changes. The tab bar (TabBar) uses this to tell
// a key-caused hide or return from a pointer's.
describe("useChangedByKey", () => {
  it("MOTION-23: a key before the flip reports true", () => {
    const { result, rerender } = renderHook(({ value }) => useChangedByKey(value), {
      initialProps: { value: false },
    });
    expect(result.current).toBe(false);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    rerender({ value: true });

    expect(result.current).toBe(true);
  });

  it("MOTION-23: a pointer press before the flip reports false", () => {
    const { result, rerender } = renderHook(({ value }) => useChangedByKey(value), {
      initialProps: { value: false },
    });

    window.dispatchEvent(new PointerEvent("pointerdown"));
    rerender({ value: true });

    expect(result.current).toBe(false);
  });

  it("MOTION-23: with no flip of the value, the last answer stays", () => {
    const { result, rerender } = renderHook(({ value }) => useChangedByKey(value), {
      initialProps: { value: false },
    });

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    rerender({ value: true });
    expect(result.current).toBe(true);

    // A pointer press with no flip of `value` does not change the answer.
    window.dispatchEvent(new PointerEvent("pointerdown"));
    rerender({ value: true });
    expect(result.current).toBe(true);
  });
});
