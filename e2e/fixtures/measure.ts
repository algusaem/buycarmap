import { expect, type Locator, type Page } from "@playwright/test";

/** An element's box, as Playwright measures it. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** `locator`'s box; it must have one. */
export async function box(locator: Locator): Promise<Box> {
  const measured = await locator.boundingBox();
  expect(measured, "the element has a box").not.toBeNull();
  return measured as Box;
}

/** `actual` is `expected` to within 1px, the rounding a browser's layout leaves. */
export function expectWithin(actual: number, expected: number, label: string) {
  expect(
    Math.abs(actual - expected),
    `${label}: ${actual}, expected ${expected} ±1`,
  ).toBeLessThanOrEqual(1);
}

/** Scrolls the nearest scrolling ancestor of `item` (the list column on desktop, the page on a phone) by `pixels`. */
async function scrollBy(item: Locator, pixels: number) {
  await item.evaluate((element, delta) => {
    let node: HTMLElement | null = element.parentElement;
    while (node) {
      const style = getComputedStyle(node);
      if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) break;
      node = node.parentElement;
    }
    (node ?? document.scrollingElement ?? document.documentElement).scrollBy(0, delta);
  }, pixels);
}

/** Scrolls the list until the item named `title` is mounted, then brings it to the top of the view. */
export async function scrollUntilMounted(
  page: Page,
  items: Locator,
  title: string,
): Promise<Locator> {
  const target = items.filter({ hasText: title });
  for (let step = 0; step < 200 && (await target.count()) === 0; step++) {
    await scrollBy(items.first(), 400);
    await page.waitForTimeout(30);
  }
  await expect(target).toHaveCount(1);
  await target.evaluate((element) => element.scrollIntoView({ block: "start" }));
  return target;
}

/** The first item wholly inside `view`'s box, by its «Coche NNN» name. */
export async function firstWhollyVisible(items: Locator, view: Box): Promise<string> {
  const drawn = await items.evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        text: element.textContent ?? "",
      };
    }),
  );
  const inView = drawn
    .filter((item) => item.top >= view.y - 1 && item.bottom <= view.y + view.height + 1)
    .sort((a, b) => a.top - b.top || a.left - b.left);
  return /Coche \d{3}/.exec(inView[0]?.text ?? "")?.[0] ?? "none";
}

/** Whether `inner` lies wholly inside `outer`, to within 1px. */
export function wholly(inner: Box, outer: Box): boolean {
  return (
    inner.y >= outer.y - 1 &&
    inner.y + inner.height <= outer.y + outer.height + 1 &&
    inner.x >= outer.x - 1 &&
    inner.x + inner.width <= outer.x + outer.width + 1
  );
}

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

/** «Coche 001» to «Coche NNN»: the numbered cars the long-list cases seed. */
export function carTitle(n: number): string {
  return `Coche ${String(n).padStart(3, "0")}`;
}

/** Scrolls the nearest scrolling ancestor of `item` to its middle or its end. */
export async function scrollTo(item: Locator, where: "middle" | "end") {
  await item.evaluate((element, position) => {
    let node: HTMLElement | null = element.parentElement;
    while (node) {
      const style = getComputedStyle(node);
      if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) break;
      node = node.parentElement;
    }
    const scroller = node ?? document.scrollingElement ?? document.documentElement;
    const top = position === "middle" ? scroller.scrollHeight / 2 : scroller.scrollHeight;
    scroller.scrollTo(0, top);
  }, where);
}

/** The box once it stops moving: a toast slides in, a card list settles. */
export async function settledBox(locator: Locator): Promise<Box> {
  // Sonner draws a toast one height above its place, holds it there for a
  // moment, then slides it in: two equal reads can both be the start. Its
  // place is where the slide ends, with no transform left.
  if ((await locator.getAttribute("data-sonner-toast")) !== null) {
    await expect(locator).toHaveAttribute("data-mounted", "true");
    await expect
      .poll(() => locator.evaluate((element) => getComputedStyle(element).transform))
      .toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
  }
  let previous = await box(locator);
  await expect
    .poll(async () => {
      const current = await box(locator);
      const still = current.x === previous.x && current.y === previous.y;
      previous = current;
      return still;
    })
    .toBe(true);
  return previous;
}

/** The items' texts in reading order (top to bottom, then left to right), as they are drawn. */
export async function drawnTitles(items: Locator): Promise<string[]> {
  const drawn = await items.evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        text: element.textContent ?? "",
      };
    }),
  );
  return drawn.sort((a, b) => a.top - b.top || a.left - b.left).map((item) => item.text);
}

/** The «Coche NNN» names of the items drawn, in reading order. */
async function numberedTitles(items: Locator): Promise<string[]> {
  return (await drawnTitles(items)).map((text) => /Coche \d{3}/.exec(text)?.[0] ?? "?");
}

/** `run` appears, in that order and next to each other, among the `cards` drawn. */
export async function expectNeighbours(cards: Locator, run: string[]) {
  await expect
    .poll(async () => {
      const titles = await numberedTitles(cards);
      const start = titles.indexOf(run[0]);
      return start === -1 ? [] : titles.slice(start, start + run.length);
    })
    .toEqual(run);
}

/**
 * No car is drawn twice among the `cards`, and each card holds exactly one
 * heart, named by one of `heartLabels` (/favorites' only removes; an alert's
 * page toggles).
 */
export async function expectEachCarOnce(cards: Locator, heartLabels: readonly string[]) {
  const titles = await numberedTitles(cards);
  expect(new Set(titles).size, `cards drawn: ${titles.join(", ")}`).toBe(titles.length);
  const selector = heartLabels.map((label) => `button[aria-label="${label}"]`).join(", ");
  const heartsPerCard = await cards.evaluateAll(
    (elements, hearts) => elements.map((element) => element.querySelectorAll(hearts).length),
    selector,
  );
  expect(heartsPerCard.every((count) => count === 1)).toBe(true);
}
