import { describe, expect, it } from "vitest";
import { nextPositionUp, type SheetTops, settleSheetPosition } from "./sheet-position";

// docs/specs/redesign-map.md (MAPUI-58 to MAPUI-62, #133), worked example
// "Phone results sheet (MAPUI-58 to MAPUI-62, #133)". The tops below are the
// worked example's P (peeked), M (middle) and F (full), with P below M below
// F — picked so each case's nearest-top and flick-direction answer is
// unambiguous by hand.
const TOPS: SheetTops = { peeked: 760, middle: 420, full: 0 };

describe("MAPUI-58: nextPositionUp — one step up from the handle", () => {
  it("MAPUI-58: peeked goes to middle", () => {
    expect(nextPositionUp("peeked")).toBe("middle");
  });

  it("MAPUI-58: middle goes to full", () => {
    expect(nextPositionUp("middle")).toBe("full");
  });

  it("MAPUI-58: full goes back to peeked", () => {
    expect(nextPositionUp("full")).toBe("peeked");
  });
});

describe("MAPUI-59: settleSheetPosition — the nearest position by top edge", () => {
  it("MAPUI-59: middle, released at 150 (nearest full, 150px away) with a slow upward release settles at full", () => {
    expect(
      settleSheetPosition({ start: "middle", releaseTop: 150, velocityY: -100, tops: TOPS }),
    ).toBe("full");
  });

  it("MAPUI-59: middle, released at 500 (nearest middle, 80px away) with a slow downward release settles at middle", () => {
    expect(
      settleSheetPosition({ start: "middle", releaseTop: 500, velocityY: 200, tops: TOPS }),
    ).toBe("middle");
  });

  it("MAPUI-59: full, released at 640 (nearest peeked, 120px away) with a slow downward release settles at peeked", () => {
    expect(
      settleSheetPosition({ start: "full", releaseTop: 640, velocityY: 300, tops: TOPS }),
    ).toBe("peeked");
  });

  it("MAPUI-59: middle, released at 400 exactly at the flick threshold (800px/s, not a flick) still settles at the nearest position (middle, 20px away)", () => {
    expect(
      settleSheetPosition({ start: "middle", releaseTop: 400, velocityY: -800, tops: TOPS }),
    ).toBe("middle");
  });
});

describe("MAPUI-60: settleSheetPosition — a flick moves exactly one position in its direction", () => {
  it("MAPUI-60: middle, flicked upward at 801px/s (just over the exclusive threshold) moves to full, regardless of the nearest top", () => {
    expect(
      settleSheetPosition({ start: "middle", releaseTop: 400, velocityY: -801, tops: TOPS }),
    ).toBe("full");
  });

  it("MAPUI-60: middle, flicked downward at 900px/s moves to peeked, regardless of the nearest top", () => {
    expect(
      settleSheetPosition({ start: "middle", releaseTop: 440, velocityY: 900, tops: TOPS }),
    ).toBe("peeked");
  });

  it("MAPUI-60: full, flicked downward at 1200px/s moves to middle", () => {
    expect(
      settleSheetPosition({ start: "full", releaseTop: 40, velocityY: 1200, tops: TOPS }),
    ).toBe("middle");
  });

  it("MAPUI-60: peeked, flicked downward at 1500px/s stays at peeked (already the lowest position)", () => {
    expect(
      settleSheetPosition({ start: "peeked", releaseTop: 780, velocityY: 1500, tops: TOPS }),
    ).toBe("peeked");
  });

  it("MAPUI-60: full, flicked upward at 900px/s stays at full (already the topmost position)", () => {
    expect(settleSheetPosition({ start: "full", releaseTop: 0, velocityY: -900, tops: TOPS })).toBe(
      "full",
    );
  });
});
