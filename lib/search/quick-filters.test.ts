import { describe, expect, it } from "vitest";
import {
  isQuickFilterOn,
  QUICK_FILTERS,
  type QuickFilterKey,
  toggleQuickFilter,
} from "@/lib/search/quick-filters";
import type { SearchInput } from "@/lib/search/schema";

// docs/specs/redesign-map.md (MAPUI-63), worked example "Quick filters
// (MAPUI-63)". Each `it` is one row of that table: `toggleQuickFilter` must
// return exactly the patch that turns "Search before" into "Search after",
// and once that patch is applied, `isQuickFilterOn` must read the "Pressed
// after" column for all five keys.

/** Every key not named is read as not pressed on `input`. */
function expectPressed(input: SearchInput, pressed: QuickFilterKey[]) {
  for (const key of QUICK_FILTERS) {
    expect(isQuickFilterOn(input, key)).toBe(pressed.includes(key));
  }
}

describe("MAPUI-63: toggleQuickFilter and isQuickFilterOn (worked example)", () => {
  it("MAPUI-63: no criterion, pressing Diésel adds engine=gasoil", () => {
    const before: SearchInput = {};

    const patch = toggleQuickFilter(before, "gasoil");

    expect(patch).toEqual({ engine: ["gasoil"] });
    expectPressed({ ...before, ...patch }, ["gasoil"]);
  });

  it("MAPUI-63: engine=gasoil, pressing Gasolina adds it beside the existing fuel", () => {
    const before: SearchInput = { engine: ["gasoil"] };

    const patch = toggleQuickFilter(before, "gasoline");

    expect(patch).toEqual({ engine: ["gasoil", "gasoline"] });
    expectPressed({ ...before, ...patch }, ["gasoline", "gasoil"]);
  });

  it("MAPUI-63: engine=gasoil,electric-hybrid, pressing Diésel removes only gasoil", () => {
    const before: SearchInput = { engine: ["gasoil", "electric-hybrid"] };

    const patch = toggleQuickFilter(before, "gasoil");

    expect(patch).toEqual({ engine: ["electric-hybrid"] });
    expectPressed({ ...before, ...patch }, []);
  });

  it("MAPUI-63: no criterion, pressing Manual sets the gearbox to manual", () => {
    const before: SearchInput = {};

    const patch = toggleQuickFilter(before, "manual");

    expect(patch).toEqual({ gearbox: ["manual"] });
    expectPressed({ ...before, ...patch }, ["manual"]);
  });

  it("MAPUI-63: gearbox=manual, pressing Automático replaces the whole gearbox criterion", () => {
    const before: SearchInput = { gearbox: ["manual"] };

    const patch = toggleQuickFilter(before, "automatic");

    expect(patch).toEqual({ gearbox: ["automatic"] });
    expectPressed({ ...before, ...patch }, ["automatic"]);
  });

  it("MAPUI-63: gearbox=automatic, pressing the pressed Automático clears the gearbox", () => {
    const before: SearchInput = { gearbox: ["automatic"] };

    const patch = toggleQuickFilter(before, "automatic");

    // toStrictEqual, not toEqual: toEqual treats {} and { gearbox: undefined }
    // as equal (it ignores undefined-valued keys).
    expect(patch).toStrictEqual({ gearbox: undefined });
    expectPressed({ ...before, ...patch }, []);
  });

  it("MAPUI-63: gearbox=manual,automatic (old link) reads as no gearbox pressed", () => {
    const input: SearchInput = { gearbox: ["manual", "automatic"] };

    expectPressed(input, []);
  });

  it("MAPUI-63: gearbox=manual,semiautomatic (old link) reads Manual pressed, as the panel does, and pressing it clears the gearbox", () => {
    const before: SearchInput = { gearbox: ["manual", "semiautomatic"] };

    expect(isQuickFilterOn(before, "manual")).toBe(true);
    expect(isQuickFilterOn(before, "automatic")).toBe(false);

    const patch = toggleQuickFilter(before, "manual");

    expect(patch).toStrictEqual({ gearbox: undefined });
    expectPressed({ ...before, ...patch }, []);
  });

  it("MAPUI-63: maxKm=150000 reads as no quick filter pressed", () => {
    const input: SearchInput = { maxKm: 150000 };

    expectPressed(input, []);
  });

  it("MAPUI-63: no criterion, pressing Hasta 100.000 km sets the maximum mileage", () => {
    const before: SearchInput = {};

    const patch = toggleQuickFilter(before, "maxKm100k");

    expect(patch).toEqual({ maxKm: 100000 });
    expectPressed({ ...before, ...patch }, ["maxKm100k"]);
  });

  it("MAPUI-63: maxKm=150000, pressing Hasta 100.000 km overrides it to 100000", () => {
    const before: SearchInput = { maxKm: 150000 };

    const patch = toggleQuickFilter(before, "maxKm100k");

    expect(patch).toEqual({ maxKm: 100000 });
    expectPressed({ ...before, ...patch }, ["maxKm100k"]);
  });

  it("MAPUI-63: maxKm=100000, pressing the pressed Hasta 100.000 km clears the maximum mileage", () => {
    const before: SearchInput = { maxKm: 100000 };

    const patch = toggleQuickFilter(before, "maxKm100k");

    // toStrictEqual: see the gearbox-clearing case above for why toEqual
    // would not do here.
    expect(patch).toStrictEqual({ maxKm: undefined });
    expectPressed({ ...before, ...patch }, []);
  });
});

// docs/specs/redesign-map.md (MAPUI-76, worked example "Quick filters"
// rows on minKm): «Hasta 100.000 km» reads maxKm alone, and pressing it
// over a minimum above 100.000 clears that minimum — since no car could
// match both — while a minimum of 100.000 or less is left as it is.
describe("MAPUI-76: isQuickFilterOn and toggleQuickFilter — a minimum mileage in force", () => {
  it("MAPUI-76: minKm=50000&maxKm=100000 reads Hasta 100.000 km as pressed (maxKm alone)", () => {
    expect(isQuickFilterOn({ minKm: 50000, maxKm: 100000 }, "maxKm100k")).toBe(true);
  });

  it("MAPUI-76: minKm=50000, pressing Hasta 100.000 km sets the maximum and leaves the minimum", () => {
    const before: SearchInput = { minKm: 50000 };

    const patch = toggleQuickFilter(before, "maxKm100k");

    expect(patch).toEqual({ maxKm: 100000 });
    const after = { ...before, ...patch };
    expect(after).toEqual({ minKm: 50000, maxKm: 100000 });
    expectPressed(after, ["maxKm100k"]);
  });

  it("MAPUI-76: minKm=100000 (equal to the maximum), pressing Hasta 100.000 km keeps that minimum", () => {
    const before: SearchInput = { minKm: 100000 };

    const patch = toggleQuickFilter(before, "maxKm100k");

    const after = { ...before, ...patch };
    expect(after).toEqual({ minKm: 100000, maxKm: 100000 });
  });

  it("MAPUI-76: minKm=150000 (above the maximum), pressing Hasta 100.000 km clears that minimum", () => {
    const before: SearchInput = { minKm: 150000 };

    const patch = toggleQuickFilter(before, "maxKm100k");

    // toStrictEqual: the minimum must be cleared with the key present, not
    // merely left out — a patch merged with `{ ...before, ...patch }` only
    // clears a field whose key is in the patch at all.
    expect(patch).toStrictEqual({ maxKm: 100000, minKm: undefined });
    expectPressed({ ...before, ...patch }, ["maxKm100k"]);
  });

  it("MAPUI-76: minKm=50000&maxKm=100000, releasing Hasta 100.000 km clears only the maximum", () => {
    const before: SearchInput = { minKm: 50000, maxKm: 100000 };

    const patch = toggleQuickFilter(before, "maxKm100k");

    expect(patch).toStrictEqual({ maxKm: undefined });
    const after = { ...before, ...patch };
    expect(after).toEqual({ minKm: 50000, maxKm: undefined });
    expectPressed(after, []);
  });
});
