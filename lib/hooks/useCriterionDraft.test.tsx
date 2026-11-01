import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCriterionDraft } from "./useCriterionDraft";

// docs/specs/redesign-map.md (MAPUI-14): «Año»'s «Desde» applies on commit — the
// hook now serves only that box, since «Kilómetros»'s «Mínimo» and «Máximo»
// share useMileageDraft instead. There is no amount left to refuse here:
// NumberBox never forwards unreadable text to `setDraft` in the first place,
// and the schema accepts every whole number of 0 or more.

function renderDraft(value: number | undefined, onCommit = vi.fn()) {
  const view = renderHook(
    ({ current }: { current: number | undefined }) => useCriterionDraft(current, onCommit),
    { initialProps: { current: value } },
  );
  return { ...view, onCommit };
}

describe("useCriterionDraft", () => {
  it("MAPUI-14: a typed amount applies only on commit", () => {
    const { result, onCommit } = renderDraft(undefined);

    act(() => result.current.setDraft(2015));
    expect(onCommit).not.toHaveBeenCalled();

    act(() => result.current.commit());
    expect(onCommit).toHaveBeenCalledWith(2015);
  });

  it("MAPUI-14: an emptied box clears the criterion", () => {
    const { result, onCommit } = renderDraft(2010);

    act(() => result.current.setDraft(undefined));
    act(() => result.current.commit());

    expect(onCommit).toHaveBeenCalledWith(undefined);
  });

  it("MAPUI-14: committing the criterion in force applies nothing", () => {
    const { result, onCommit } = renderDraft(2010);

    act(() => result.current.commit());

    expect(onCommit).not.toHaveBeenCalled();
  });

  it("MAPUI-14: the draft follows the criterion when it changes outside", () => {
    const { result, rerender } = renderDraft(2010);
    act(() => result.current.setDraft(2018));

    rerender({ current: undefined });

    expect(result.current.draft).toBeUndefined();
  });
});
