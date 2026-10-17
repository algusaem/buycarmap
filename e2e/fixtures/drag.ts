import type { Locator, Page } from "@playwright/test";

/** The shortest fast drag: anything less is too short to read as a flick. */
const FLICK_MIN_DISTANCE = 60;

/**
 * Presses `from`'s centre with the mouse and drags it `dy` px down, or up
 * when `dy` is negative (docs/specs/redesign-saved.md, SAVED-37 and SAVED-38;
 * docs/specs/redesign-map.md, MAPUI-59 and MAPUI-60). It moves in 10px steps
 * 30ms apart, about 300px/s, well under the 800px/s flick that closes a phone
 * bottom sheet whatever the distance, so only the distance decides. With
 * `fast` it makes the whole move at once and lets go straight away: a flick,
 * at least 60px long. It lets go at the end unless `hold` is set, which
 * leaves the button pressed so the caller can look at the sheet mid-drag and
 * call `page.mouse.up()` itself.
 */
export async function dragDown(
  page: Page,
  from: Locator,
  dy: number,
  { hold = false, fast = false }: { hold?: boolean; fast?: boolean } = {},
): Promise<void> {
  if (fast && Math.abs(dy) < FLICK_MIN_DISTANCE) {
    throw new Error(`a fast drag needs at least ${FLICK_MIN_DISTANCE}px, got ${dy}`);
  }
  const box = await from.boundingBox();
  if (!box) throw new Error("the drag's start has no box");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const steps = Math.max(1, Math.round(Math.abs(dy) / 10));

  await page.mouse.move(x, y);
  await page.mouse.down();
  if (fast) {
    await page.mouse.move(x, y + dy);
    if (!hold) await page.mouse.up();
    return;
  }
  for (let step = 1; step <= steps; step++) {
    await page.mouse.move(x, y + (dy * step) / steps);
    await page.waitForTimeout(30);
  }
  if (!hold) await page.mouse.up();
}

/** How far down `sheet` is translated, in px: 0 when it sits in its place. */
export async function sheetOffset(sheet: Locator): Promise<number> {
  return sheet.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).m42);
}
