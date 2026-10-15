import type { Locator } from "@playwright/test";

/**
 * A control's touch target. Its own drawn box can be smaller: the pins, the
 * phone «Filtros» chip (FilterRow.tsx), the price knobs (PriceRange.tsx), the
 * «Cambio» options (RadioChips.tsx) and the saved cars' controls keep the 44px
 * floor with an invisible `::before` hit-area extension instead of growing
 * their visible size (RULES.md §19). The real hit area is the larger of the
 * drawn box and that pseudo-element's computed size.
 */
export async function hitArea(target: Locator): Promise<{ width: number; height: number }> {
  return target.evaluate((el) => {
    const own = el.getBoundingClientRect();
    const before = getComputedStyle(el, "::before");
    const hasHitArea = before.content !== "none" && before.position === "absolute";
    return {
      width: Math.max(own.width, hasHitArea ? Number.parseFloat(before.width) || 0 : 0),
      height: Math.max(own.height, hasHitArea ? Number.parseFloat(before.height) || 0 : 0),
    };
  });
}
