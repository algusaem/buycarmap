import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useMileageDraft } from "./useMileageDraft";

// docs/specs/redesign-map.md (MAPUI-73, MAPUI-74): «Kilómetros»'s desktop
// draft, the peer of useCriterionDraft.ts over both boxes at once — a typed
// minimum above the maximum, or the reverse, swaps with it on commit
// (lib/search/panel.ts's `orderedKm`), even when nothing was typed (MAPUI-74
// amended 2026-10-31, an old link's or a saved alert's reversed ends).

function renderDraft(
  value: { minKm?: number; maxKm?: number },
  onChange = vi.fn<(patch: { minKm?: number; maxKm?: number }) => void>(),
) {
  const view = renderHook(
    ({ current }: { current: { minKm?: number; maxKm?: number } }) =>
      useMileageDraft(current, onChange),
    { initialProps: { current: value } },
  );
  return { ...view, onChange };
}

describe("useMileageDraft", () => {
  it("MAPUI-73: typing a minimum with no maximum applies it on commit", () => {
    const { result, onChange } = renderDraft({});

    act(() => result.current.setMinDraft(50000));
    expect(onChange).not.toHaveBeenCalled();

    act(() => result.current.commit());
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ minKm: 50000, maxKm: undefined });
  });

  it("MAPUI-74: typing a minimum above the existing maximum swaps them on commit", () => {
    const { result, onChange } = renderDraft({ maxKm: 100000 });

    act(() => result.current.setMinDraft(150000));
    act(() => result.current.commit());

    expect(onChange).toHaveBeenCalledWith({ minKm: 100000, maxKm: 150000 });
  });

  it("MAPUI-74: typing a maximum under the existing minimum swaps them on commit too", () => {
    const { result, onChange } = renderDraft({ minKm: 150000 });

    act(() => result.current.setMaxDraft(100000));
    act(() => result.current.commit());

    expect(onChange).toHaveBeenCalledWith({ minKm: 100000, maxKm: 150000 });
  });

  it("MAPUI-73: committing the criteria already in force applies nothing", () => {
    const { result, onChange } = renderDraft({ minKm: 50000, maxKm: 100000 });

    act(() => result.current.commit());

    expect(onChange).not.toHaveBeenCalled();
  });

  it("MAPUI-73: emptying the minimum clears it while leaving the maximum as it is", () => {
    const { result, onChange } = renderDraft({ minKm: 50000, maxKm: 100000 });

    act(() => result.current.setMinDraft(undefined));
    act(() => result.current.commit());

    expect(onChange.mock.calls[0][0]).toStrictEqual({ minKm: undefined, maxKm: 100000 });
  });

  it("MAPUI-73: the draft follows the criteria when they change outside", () => {
    const { result, rerender } = renderDraft({ minKm: 150000 });
    act(() => result.current.setMinDraft(200000));

    rerender({ current: { maxKm: 100000 } });

    expect(result.current.minDraft).toBeUndefined();
    expect(result.current.maxDraft).toBe(100000);

    rerender({ current: {} });

    expect(result.current.minDraft).toBeUndefined();
    expect(result.current.maxDraft).toBeUndefined();
  });

  it("MAPUI-74: an old link's or a saved alert's reversed ends are swapped on commit even with nothing typed (amended 2026-10-31)", () => {
    const { result, onChange } = renderDraft({ minKm: 150000, maxKm: 100000 });

    act(() => result.current.commit());

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ minKm: 100000, maxKm: 150000 });
  });

  it("MAPUI-74: reversed ends read as they came until commit — the draft does not swap them on its own", () => {
    const { result, onChange } = renderDraft({ minKm: 150000, maxKm: 100000 });

    expect(onChange).not.toHaveBeenCalled();
    expect(result.current.minDraft).toBe(150000);
    expect(result.current.maxDraft).toBe(100000);
  });
});
