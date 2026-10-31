import type { Locator, Page } from "@playwright/test";

/** Frames the swipe is drawn over, at 60fps: about 200ms, a deliberate swipe, not a flick. */
const STEPS = 12;
const STEP_MS = 16;

/**
 * Swipes a real finger from `from`'s centre, `dy` px down, or up when negative
 * (docs/specs/redesign-map.md, MAPUI-71). Touch events go through the
 * browser's own input pipeline with `Input.dispatchTouchEvent`, so
 * `touch-action` and native scrolling apply, as they do not for the mouse. The
 * command is Chromium's: a WebKit project skips the test.
 */
export async function swipe(page: Page, from: Locator, dy: number): Promise<void> {
  const box = await from.boundingBox();
  if (!box) throw new Error("the swipe's start has no box");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (let step = 1; step <= STEPS; step++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: y + (dy * step) / STEPS }],
      });
      await page.waitForTimeout(STEP_MS);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } finally {
    await cdp.detach();
  }
}
