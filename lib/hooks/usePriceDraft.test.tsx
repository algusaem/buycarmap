import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePriceDraft } from "./usePriceDraft";

// docs/specs/redesign-map.md (MAPUI-11): the price range's draft — the knobs
// over a 0 to 30.000 € scale in steps of 500, the «Mínimo» and «Máximo» boxes,
// and what each hands to `onApply`.

interface Props {
  minPrice?: number;
  maxPrice?: number;
}

function renderDraft(initial: Props, onApply = vi.fn()) {
  const view = renderHook(
    ({ minPrice, maxPrice }: Props) => usePriceDraft(minPrice, maxPrice, onApply),
    { initialProps: initial },
  );
  return { ...view, onApply };
}

describe("usePriceDraft — the knobs", () => {
  it("MAPUI-11: starts from the criterion in force, the knobs clamped to the end of the scale", () => {
    const { result } = renderDraft({ minPrice: 3000, maxPrice: 45000 });

    expect(result.current.draft).toEqual({ min: 3000, max: 45000 });
    expect(result.current.knobs).toEqual([3000, 30000]);
  });

  it("MAPUI-11: no criterion puts the knobs at both ends", () => {
    const { result } = renderDraft({});

    expect(result.current.knobs).toEqual([0, 30000]);
  });

  it("MAPUI-11: the right knob released at the end is no maximum, the left at 0 no minimum", () => {
    const { result, onApply } = renderDraft({ minPrice: 3000, maxPrice: 10000 });

    act(() => result.current.release([0, 30000]));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith(undefined, undefined);
  });

  it("MAPUI-11: the right knob stops at 500, never a maximum of 0", () => {
    const { result, onApply } = renderDraft({ maxPrice: 1000 });

    act(() => result.current.release([0, 0]));

    expect(onApply).toHaveBeenCalledWith(undefined, 500);
  });

  it("MAPUI-11: a knob that did not move keeps its exact amount above the scale", () => {
    const { result, onApply } = renderDraft({ maxPrice: 45000 });

    act(() => result.current.release([5000, 30000]));

    expect(onApply).toHaveBeenCalledWith(5000, 45000);
  });

  it("MAPUI-11: sliding moves the draft without applying it", () => {
    const { result, onApply } = renderDraft({ maxPrice: 10000 });

    act(() => result.current.slide([0, 12000]));

    expect(result.current.draft).toEqual({ min: undefined, max: 12000 });
    expect(onApply).not.toHaveBeenCalled();
  });
});

describe("usePriceDraft — the boxes", () => {
  it("MAPUI-11: a typed maximum applies as it is typed", () => {
    const { result, onApply } = renderDraft({});

    act(() => result.current.setMax(45000));

    expect(result.current.draft).toEqual({ min: undefined, max: 45000 });
    expect(onApply).toHaveBeenCalledWith(undefined, 45000);
  });

  it("MAPUI-11: a maximum of 0 is never applied and the draft keeps the criterion in force (negative path)", () => {
    const { result, onApply } = renderDraft({ maxPrice: 10000 });

    act(() => result.current.setMax(0));

    expect(onApply).not.toHaveBeenCalled();
    expect(result.current.draft).toEqual({ min: undefined, max: 10000 });
  });

  it("MAPUI-11: an emptied Máximo is no maximum", () => {
    const { result, onApply } = renderDraft({ maxPrice: 10000 });

    act(() => result.current.setMax(undefined));

    expect(onApply).toHaveBeenCalledWith(undefined, undefined);
  });

  it("MAPUI-11: a minimum above the maximum is swapped when the boxes apply", () => {
    const { result, onApply } = renderDraft({ maxPrice: 10000 });

    act(() => result.current.setMin(15000));
    act(() => result.current.applyBoxes());

    expect(result.current.draft).toEqual({ min: 10000, max: 15000 });
    expect(onApply).toHaveBeenLastCalledWith(10000, 15000);
  });

  it("MAPUI-11: the swap sees an edit made in the same event, before a re-render", () => {
    const { result, onApply } = renderDraft({ maxPrice: 10000 });

    act(() => {
      result.current.setMin(15000);
      result.current.applyBoxes();
    });

    expect(result.current.draft).toEqual({ min: 10000, max: 15000 });
    expect(onApply).toHaveBeenLastCalledWith(10000, 15000);
  });

  it("MAPUI-11: a minimum at or below the maximum is not swapped", () => {
    const { result, onApply } = renderDraft({ minPrice: 3000, maxPrice: 10000 });

    act(() => result.current.applyBoxes());

    expect(onApply).not.toHaveBeenCalled();
    expect(result.current.draft).toEqual({ min: 3000, max: 10000 });
  });
});

describe("usePriceDraft — the criterion changing outside", () => {
  it("MAPUI-11: a new criterion replaces the draft, and the next knob release starts from it", () => {
    const { result, rerender, onApply } = renderDraft({});
    act(() => result.current.setMax(45000));
    rerender({ maxPrice: 45000 });

    // Then the criterion is cleared elsewhere (a removed chip, «Borrar»).
    rerender({ maxPrice: undefined });
    expect(result.current.draft).toEqual({ min: undefined, max: undefined });

    act(() => result.current.release([5000, 30000]));

    // Not 45000: the right knob at the end now reads the new criterion, no maximum.
    expect(onApply).toHaveBeenLastCalledWith(5000, undefined);
  });
});
