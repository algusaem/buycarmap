import { describe, expect, it } from "vitest";
import { err, ok, type Result } from "./result";

// Worked examples, docs/specs/core-platform.md § Worked examples (PLAT-10):
//   ok(3) -> { ok: true, value: 3 }
//   err({ code: "criteriaTooBroad", messageKey: "alertErrors.criteriaTooBroad" })
//     -> { ok: false, error: { code: "criteriaTooBroad", messageKey: "alertErrors.criteriaTooBroad" } }

describe("ok", () => {
  it("PLAT-10: wraps a value as a successful Result", () => {
    expect(ok(3)).toEqual({ ok: true, value: 3 });
  });
});

describe("err", () => {
  it("PLAT-10: wraps a { code, messageKey } error as a failed Result", () => {
    const error = { code: "criteriaTooBroad", messageKey: "alertErrors.criteriaTooBroad" };

    expect(err(error)).toEqual({ ok: false, error });
  });
});

describe("Result narrowing", () => {
  it("PLAT-10: a caller must check `ok` before reading `value` or `error`", () => {
    // This is a compile-time claim, not a runtime one: `result.error` and
    // `result.value` are only reachable after narrowing on `ok`. If PLAT-10
    // ever drops the discriminated union, this line stops compiling.
    const result: Result<number, { code: string; messageKey: string }> = ok(3);

    if (result.ok) {
      expect(result.value).toBe(3);
    } else {
      throw new Error(`expected ok, got error ${result.error.code}`);
    }
  });
});
