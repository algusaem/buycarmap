import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useVisibleScreen } from "./useVisibleScreen";

// docs/specs/redesign-map.md (MAPUI-72), worked example "A field in the
// «BUSCAR» sheet on an iPhone": 874px of screen, 538px left visible.

const originalInnerHeight = window.innerHeight;

function stubViewport(values: { height: number; offsetTop?: number; scale?: number }) {
  const viewport = Object.assign(new EventTarget(), { offsetTop: 0, scale: 1, ...values });
  Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
  return viewport;
}

afterEach(() => {
  Object.defineProperty(window, "visualViewport", { configurable: true, value: undefined });
  window.innerHeight = originalInnerHeight;
});

describe("MAPUI-72: useVisibleScreen", () => {
  it("MAPUI-72: reads where the visible part ends and how tall it is", () => {
    window.innerHeight = 874;
    stubViewport({ height: 538 });
    const { result } = renderHook(() => useVisibleScreen());
    expect(result.current).toEqual({ bottom: 538, height: 538 });
  });

  it("MAPUI-72: reads the same when window.innerHeight shrinks with the keyboard", () => {
    window.innerHeight = 538;
    stubViewport({ height: 538 });
    const { result } = renderHook(() => useVisibleScreen());
    expect(result.current).toEqual({ bottom: 538, height: 538 });
  });

  it("MAPUI-72: follows the keyboard as it arrives and as it leaves", () => {
    window.innerHeight = 874;
    const viewport = stubViewport({ height: 874 });
    const { result } = renderHook(() => useVisibleScreen());
    expect(result.current).toEqual({ bottom: 874, height: 874 });

    act(() => {
      viewport.height = 538;
      viewport.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toEqual({ bottom: 538, height: 538 });

    act(() => {
      viewport.height = 874;
      viewport.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toEqual({ bottom: 874, height: 874 });
  });

  it("MAPUI-72: counts the page Safari panned to keep the field in view", () => {
    const viewport = stubViewport({ height: 538 });
    const { result } = renderHook(() => useVisibleScreen());

    act(() => {
      viewport.offsetTop = 100;
      viewport.dispatchEvent(new Event("scroll"));
    });
    expect(result.current).toEqual({ bottom: 638, height: 538 });
  });

  it("MAPUI-72: a pinch zoom reads nothing", () => {
    stubViewport({ height: 437, scale: 2 });
    const { result } = renderHook(() => useVisibleScreen());
    expect(result.current).toBeNull();
  });

  it("MAPUI-72: a browser with no visual viewport reads nothing", () => {
    const { result } = renderHook(() => useVisibleScreen());
    expect(result.current).toBeNull();
  });
});
