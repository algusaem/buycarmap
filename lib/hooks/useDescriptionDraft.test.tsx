import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDescriptionDraft } from "./useDescriptionDraft";

// docs/specs/map-description-search.md (Key DESC). DESC-4, DESC-15, DESC-33:
// the field's draft resets to `applied` the same render it changes from
// outside, and `resetKey` forces that same reset without `applied` itself
// changing.

function renderDraft(applied: string, resetKey?: number) {
  return renderHook(
    ({ applied: current, resetKey: key }: { applied: string; resetKey?: number }) =>
      useDescriptionDraft(current, key),
    { initialProps: { applied, resetKey } },
  );
}

describe("useDescriptionDraft", () => {
  it("DESC-4: starts with the applied text, already applied", () => {
    const { result } = renderDraft("e46");

    expect(result.current.value).toBe("e46");
    expect(result.current.trimmed).toBe("e46");
    expect(result.current.isApplied).toBe(true);
  });

  it("DESC-4: typing over the applied text loses isApplied", () => {
    const { result } = renderDraft("e46");

    act(() => result.current.setValue("e46x"));

    expect(result.current.isApplied).toBe(false);
  });

  it("DESC-4: with nothing applied, isApplied is always false", () => {
    const { result } = renderDraft("");

    act(() => result.current.setValue("   "));

    expect(result.current.trimmed).toBe("");
    expect(result.current.isApplied).toBe(false);
  });

  it("DESC-15: applied changing from outside replaces the draft", () => {
    const { result, rerender } = renderDraft("e46");
    act(() => result.current.setValue("e46x"));

    rerender({ applied: "gti", resetKey: undefined });

    expect(result.current.value).toBe("gti");
  });

  it("DESC-15/DESC-33: a new resetKey discards the typed draft with applied unchanged", () => {
    const { result, rerender } = renderDraft("e46", 0);
    act(() => result.current.setValue("e46x"));

    rerender({ applied: "e46", resetKey: 1 });

    expect(result.current.value).toBe("e46");
  });
});
