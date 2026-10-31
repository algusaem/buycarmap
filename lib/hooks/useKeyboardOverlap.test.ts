import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useKeyboardOverlap } from "./useKeyboardOverlap";

// docs/specs/redesign-map.md (MAPUI-72), worked example "A field in the
// «BUSCAR» sheet on an iPhone": 874px of screen, 538px left visible.

const originalInnerHeight = window.innerHeight;

function stubViewport(values: { height: number; offsetTop?: number; scale?: number }) {
  const viewport = Object.assign(new EventTarget(), { offsetTop: 0, scale: 1, ...values });
  Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
  window.innerHeight = 874;
  return viewport;
}

afterEach(() => {
  Object.defineProperty(window, "visualViewport", { configurable: true, value: undefined });
  window.innerHeight = originalInnerHeight;
});

describe("MAPUI-72: useKeyboardOverlap", () => {
  it("MAPUI-72: reads nothing while the whole screen is visible", () => {
    stubViewport({ height: 874 });
    const { result } = renderHook(() => useKeyboardOverlap());
    expect(result.current).toBeNull();
  });

  it("MAPUI-72: reads the keyboard's top edge and the height left visible", () => {
    stubViewport({ height: 538 });
    const { result } = renderHook(() => useKeyboardOverlap());
    expect(result.current).toEqual({ bottom: 336, height: 538 });
  });

  it("MAPUI-72: follows the keyboard as it arrives and as it leaves", () => {
    const viewport = stubViewport({ height: 874 });
    const { result } = renderHook(() => useKeyboardOverlap());

    act(() => {
      viewport.height = 538;
      viewport.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toEqual({ bottom: 336, height: 538 });

    act(() => {
      viewport.height = 874;
      viewport.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toBeNull();
  });

  it("MAPUI-72: counts the page Safari panned to keep the field in view", () => {
    const viewport = stubViewport({ height: 538 });
    const { result } = renderHook(() => useKeyboardOverlap());

    act(() => {
      viewport.offsetTop = 100;
      viewport.dispatchEvent(new Event("scroll"));
    });
    expect(result.current).toEqual({ bottom: 236, height: 538 });
  });

  it("MAPUI-72: a toolbar folding away is not a keyboard", () => {
    stubViewport({ height: 800 });
    const { result } = renderHook(() => useKeyboardOverlap());
    expect(result.current).toBeNull();
  });

  it("MAPUI-72: a pinch zoom is not a keyboard", () => {
    stubViewport({ height: 437, scale: 2 });
    const { result } = renderHook(() => useKeyboardOverlap());
    expect(result.current).toBeNull();
  });

  it("MAPUI-72: a browser with no visual viewport reads nothing", () => {
    const { result } = renderHook(() => useKeyboardOverlap());
    expect(result.current).toBeNull();
  });
});
