import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { createExternalStore, useExternalStore } from "./createExternalStore";

// The store under lib/hooks/useResultsSheetFull.ts (MAPUI-53) and
// lib/hooks/useMapHeaderSlot.ts (MAPUI-1).
describe("createExternalStore", () => {
  it("starts at its initial value", () => {
    const store = createExternalStore(false);
    const { result } = renderHook(() => useExternalStore(store));

    expect(result.current).toBe(false);
    expect(store.get()).toBe(false);
  });

  it("re-renders every reader when the value changes", () => {
    const store = createExternalStore(false);
    const first = renderHook(() => useExternalStore(store));
    const second = renderHook(() => useExternalStore(store));

    act(() => store.set(true));

    expect(first.result.current).toBe(true);
    expect(second.result.current).toBe(true);
  });

  it("does not re-render when the value set is the one it already holds", () => {
    const store = createExternalStore("a");
    let renders = 0;
    renderHook(() => {
      renders += 1;
      return useExternalStore(store);
    });
    const before = renders;

    act(() => store.set("a"));

    expect(renders).toBe(before);
  });

  it("notifies a subscribed listener on a change, and stops once it unsubscribes", () => {
    const store = createExternalStore(0);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.set(1);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.set(2);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.get()).toBe(2);
  });
});
