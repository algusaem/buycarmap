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
 * at least 60px long (see `flick`). It lets go at the end unless `hold` is set, which
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

  if (fast) {
    await flick(page, x, y, dy, hold);
    return;
  }
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let step = 1; step <= steps; step++) {
    await page.mouse.move(x, y + (dy * step) / steps);
    await page.waitForTimeout(30);
  }
  if (!hold) await page.mouse.up();
}

/** A frame at 60fps, in seconds: the flick's press, move and release are this far apart. */
const FRAME_S = 1 / 60;

/**
 * The `fast` drag: the press at (x, y), one move of `dy` a frame later and,
 * unless `hold`, the release a frame after that, stamped with those times
 * through the DevTools protocol (`Input.dispatchMouseEvent`'s `timestamp`,
 * which the page reads back as each pointer event's `timeStamp`). The release
 * speed the sheets measure from the events (MOTION-20) is then 60px in two
 * frames on any machine. Sent with `page.mouse`, each event was stamped when
 * it arrived, and on a loaded CI runner the release could arrive more than
 * the 100ms speed window after the move and read as a finger held still.
 */
async function flick(page: Page, x: number, y: number, dy: number, hold: boolean) {
  const cdp = await page.context().newCDPSession(page);
  const start = Date.now() / 1000;
  const send = (
    type: "mousePressed" | "mouseMoved" | "mouseReleased",
    atY: number,
    frames: number,
  ) =>
    cdp.send("Input.dispatchMouseEvent", {
      type,
      x,
      y: atY,
      button: "left",
      buttons: type === "mouseReleased" ? 0 : 1,
      clickCount: type === "mouseMoved" ? 0 : 1,
      timestamp: start + frames * FRAME_S,
    });
  try {
    await send("mousePressed", y, 0);
    await send("mouseMoved", y + dy, 1);
    if (!hold) await send("mouseReleased", y + dy, 2);
  } finally {
    await cdp.detach();
  }
}

/** How far down `sheet` is translated, in px: 0 when it sits in its place. */
export async function sheetOffset(sheet: Locator): Promise<number> {
  return sheet.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).m42);
}
