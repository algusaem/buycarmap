import { test, expect, type Locator, type Page } from "@playwright/test";
import { e2eEmail, favoriteCount, type SeedFavorite, seedFavorites, seedUser } from "./fixtures/db";
import { dragDown, sheetOffset } from "./fixtures/drag";
import { hitArea } from "./fixtures/measure";
import { mockListingSources } from "./fixtures/network";
import {
  makeSortExampleCar,
  SORT_EXAMPLE_LETTERS,
  type SortExampleLetter,
} from "../test/fixtures/favorite-listings";

// docs/specs/redesign-saved.md (SAVED-3, SAVED-4, SAVED-7, SAVED-23 to
// SAVED-29, SAVED-37, SAVED-38): what only a browser can show — the layout by
// width, the one scrolling column, the URL's history, the touch targets, where
// the toast sits, the virtualised list with 200 saved cars, and dragging the
// car sheet down.
//
// /favorites needs a signed-in account with saved cars, which this suite only
// has against a real database, so nearly every case runs in
// `pnpm test:e2e:db` (E2E_DB) and is skipped elsewhere, like
// e2e/favorites.spec.ts. The saved cars are written straight into Postgres
// (seedFavorites), with the instant each was saved, since the order depends
// on it. The one case with no account, the toast on /palette, runs always.
const dbTest = process.env.E2E_DB ? test : test.skip;

// The specs quote the Spanish copy, the default locale. Playwright negotiates
// en-US unless told otherwise, and i18n/request.ts follows Accept-Language.
test.use({ locale: "es-ES" });

// Clears all three password layers (length, strength, breach corpus) —
// duplicated from auth.spec.ts/favorites.spec.ts, per their convention.
const PASSWORD = "harbour-lentil-quilt-97";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/email|correo/i).fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /sign in|entrar/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
}

/**
 * Waits until `useSession()` has resolved, so the hearts are operable: a press
 * while the session loads is ignored on purpose (FAV-18). The signed-in link to
 * /favorites (the header's on desktop, the tab bar's on a phone) is the
 * hydration signal, as in e2e/favorites.spec.ts.
 */
async function waitForSession(page: Page) {
  await expect(page.locator('a[href="/favorites"]').filter({ visible: true }).first()).toBeVisible({
    timeout: 15_000,
  });
}

/** A fresh account with `cars` saved, signed in, on /favorites at `viewport`. */
async function openSaved(
  page: Page,
  tag: string,
  cars: SeedFavorite[],
  viewport: { width: number; height: number },
  path = "/favorites",
): Promise<string> {
  const email = e2eEmail(tag);
  await seedUser(email, PASSWORD);
  await seedFavorites(email, cars);
  await page.setViewportSize(viewport);
  await signIn(page, email);
  await page.goto(path);
  await waitForSession(page);
  return email;
}

// --- The cars ---

// docs/specs/redesign-saved.md › Worked examples › Sort: Ada's seven cars,
// each in its own city, from the unit tests' table (test/fixtures/favorite-listings.ts)
// with the instant each was saved, which only a direct insert can set.
const SAVED_AT: Record<SortExampleLetter, string> = {
  A: "2026-10-01T10:00:00Z",
  B: "2026-10-03T09:00:00Z",
  C: "2026-10-05T18:00:00Z",
  D: "2026-10-02T12:00:00Z",
  E: "2026-10-04T08:00:00Z",
  F: "2026-09-28T20:00:00Z",
  G: "2026-09-30T16:00:00Z",
};

function sortCar(letter: SortExampleLetter): SeedFavorite {
  const { id, title, price, mileage, location, lat, lng } = makeSortExampleCar(letter);
  return {
    listingId: id,
    title,
    price,
    mileage,
    location,
    lat,
    lng,
    savedAt: new Date(SAVED_AT[letter]),
  };
}

const SORT_CARS = Object.fromEntries(
  SORT_EXAMPLE_LETTERS.map((letter) => [letter, sortCar(letter)]),
) as Record<SortExampleLetter, SeedFavorite>;
const SORT_EXAMPLE = Object.values(SORT_CARS);

/**
 * `count` numbered cars, «Coche 001» newest saved and «Coche 200» oldest, so
 * «Recientes» lists them 001, 002, … Each has its own point (no two share a
 * pin) and its own price, 10.000 € plus ten per number: «Coche 150» is
 * 11.500 €.
 */
function numberedCars(count: number): SeedFavorite[] {
  const newest = Date.parse("2026-10-10T12:00:00Z");
  return Array.from({ length: count }, (_, index) => {
    const n = index + 1;
    return {
      listingId: `wallapop-coche-${n}`,
      title: carTitle(n),
      price: 10000 + n * 10,
      mileage: 50000 + n * 100,
      location: "Madrid",
      lat: 36.5 + (n % 20) * 0.3,
      lng: -8 + Math.floor(n / 20) * 0.5,
      savedAt: new Date(newest - n * 60_000),
    };
  });
}

function carTitle(n: number): string {
  return `Coche ${String(n).padStart(3, "0")}`;
}

// --- The page's parts ---

function listColumn(page: Page): Locator {
  return page.getByTestId("saved-list");
}

function mapRegion(page: Page): Locator {
  return page.getByRole("region", { name: "Mapa de tus guardados" });
}

// A car is one of the virtualised list's rows (`data-index`). A removed car
// fading out is drawn outside them, `aria-hidden` (components/favorites/
// SavedList.tsx), and is not counted.
function cards(page: Page): Locator {
  return listColumn(page).locator("[data-index] article:not([aria-label])");
}

function rows(page: Page): Locator {
  return page.locator('[data-index] button[aria-haspopup="dialog"]').filter({ hasText: /\S/ });
}

function header(page: Page): Locator {
  return page.locator("header").first();
}

function toastBox(page: Page): Locator {
  // The front toast: Sonner keeps older ones stacked behind it.
  return page.locator('[data-sonner-toast][data-front="true"]');
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function box(locator: Locator): Promise<Box> {
  const measured = await locator.boundingBox();
  expect(measured, "the element has a box").not.toBeNull();
  return measured as Box;
}

/** The box once it stops moving: a toast slides in, a card list settles. */
async function settledBox(locator: Locator): Promise<Box> {
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

function expectWithin(actual: number, expected: number, label: string) {
  expect(
    Math.abs(actual - expected),
    `${label}: ${actual}, expected ${expected} ±1`,
  ).toBeLessThanOrEqual(1);
}

/** The cars' names in reading order (top to bottom, then left to right), as they are drawn. */
async function drawnTitles(items: Locator): Promise<string[]> {
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

/** Which of the "Sort" example's cars each drawn card is, in reading order. */
async function sortLetters(page: Page): Promise<string[]> {
  const texts = await drawnTitles(cards(page));
  return texts.map(
    (text) =>
      Object.entries(SORT_CARS).find(([, seeded]) => text.includes(seeded.title))?.[0] ?? "?",
  );
}

/** The «Coche NNN» names of the items drawn, in reading order. */
async function numberedTitles(items: Locator): Promise<string[]> {
  return (await drawnTitles(items)).map((text) => /Coche \d{3}/.exec(text)?.[0] ?? "?");
}

/** The nearest scrolling ancestor of `item` (the list column on desktop, the page on a phone). */
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

async function scrollTo(item: Locator, where: "middle" | "end") {
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

/** Scrolls the list until the item named `title` is mounted, then brings it to the top of the view. */
async function scrollUntilMounted(page: Page, items: Locator, title: string): Promise<Locator> {
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
async function firstWhollyVisible(items: Locator, view: Box): Promise<string> {
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

function wholly(inner: Box, outer: Box): boolean {
  return (
    inner.y >= outer.y - 1 &&
    inner.y + inner.height <= outer.y + outer.height + 1 &&
    inner.x >= outer.x - 1 &&
    inner.x + inner.width <= outer.x + outer.width + 1
  );
}

const DESKTOP_1440 = { width: 1440, height: 900 };
const DESKTOP_1280 = { width: 1280, height: 900 };
const DESKTOP_1279 = { width: 1279, height: 900 };
const DESKTOP_1024 = { width: 1024, height: 900 };
const PHONE_1023 = { width: 1023, height: 900 };
const PHONE_390 = { width: 390, height: 844 };
const TABLET_768 = { width: 768, height: 1024 };

test.beforeEach(async ({ page, isMobile }) => {
  test.skip(!!isMobile, "the saved-cars flows set their own viewports in the chromium project");
  await mockListingSources(page);
});

// --- SAVED-3: the layout by width (viewport table) ---

const DESKTOP_LAYOUTS = [
  { viewport: DESKTOP_1440, list: 830, columns: 3, card: 242, map: 610, chipsOnHeadingRow: true },
  { viewport: DESKTOP_1280, list: 830, columns: 3, card: 242, map: 450, chipsOnHeadingRow: true },
  { viewport: DESKTOP_1279, list: 546, columns: 2, card: 231, map: 733, chipsOnHeadingRow: false },
  { viewport: DESKTOP_1024, list: 546, columns: 2, card: 231, map: 478, chipsOnHeadingRow: false },
];

test.describe("SAVED-3: the layout by width", () => {
  for (const layout of DESKTOP_LAYOUTS) {
    const { width, height } = layout.viewport;

    dbTest(
      `SAVED-3: at ${width}×${height} the list column is ${layout.list}px with 32px padding, ${layout.columns} card columns ${layout.card}px wide 20px apart, and the map ${layout.map}px beside it`,
      async ({ page }) => {
        await openSaved(page, `saved3-${width}`, SORT_EXAMPLE, layout.viewport);
        await expect(cards(page).first()).toBeVisible({ timeout: 15_000 });

        const list = await box(listColumn(page));
        expectWithin(list.width, layout.list, "list column width");
        const padding = await listColumn(page).evaluate((el) => {
          const style = getComputedStyle(el);
          return { left: style.paddingLeft, right: style.paddingRight };
        });
        expect(padding).toEqual({ left: "32px", right: "32px" });

        const cardBoxes = await cards(page).evaluateAll((elements) =>
          elements.map((element) => {
            const rect = element.getBoundingClientRect();
            return { x: rect.x, y: rect.y, width: rect.width };
          }),
        );
        const firstRow = cardBoxes
          .filter((cardBox) => Math.abs(cardBox.y - cardBoxes[0].y) <= 1)
          .sort((a, b) => a.x - b.x);
        expect(firstRow).toHaveLength(layout.columns);
        for (const cardBox of firstRow) expectWithin(cardBox.width, layout.card, "card width");
        expectWithin(firstRow[1].x - (firstRow[0].x + firstRow[0].width), 20, "gap between cards");

        const heading = await box(page.getByRole("heading", { level: 1, name: "Guardados" }));
        const chip = await box(page.getByRole("button", { name: "Recientes" }));
        if (layout.chipsOnHeadingRow) {
          expect(chip.y < heading.y + heading.height && chip.y + chip.height > heading.y).toBe(
            true,
          );
        } else {
          expect(chip.y).toBeGreaterThanOrEqual(heading.y + heading.height);
        }

        const map = await box(mapRegion(page));
        expectWithin(map.width, layout.map, "map width");
        expectWithin(map.x, list.x + list.width, "map's left edge against the list's right edge");
        expectWithin(map.x + map.width, width, "map's right edge against the viewport's");
      },
    );
  }

  for (const viewport of [PHONE_1023, PHONE_390]) {
    dbTest(
      `SAVED-3: at ${viewport.width}×${viewport.height} the page is the phone composition — rows, no map, no chips`,
      async ({ page }) => {
        await openSaved(page, `saved3-${viewport.width}`, SORT_EXAMPLE, viewport);

        await expect(rows(page).first()).toBeVisible({ timeout: 15_000 });
        await expect(rows(page)).toHaveCount(7);
        await expect(mapRegion(page)).toBeHidden();
        for (const name of ["Recientes", "Precio", "Km"]) {
          await expect(page.getByRole("button", { name })).toBeHidden();
        }
      },
    );
  }
});

// --- SAVED-4: only the list column scrolls ---

dbTest(
  "SAVED-4: at 1440×900 scrolling the list moves the list column only — header and map stay, the document does not scroll, heading and chips go up",
  async ({ page }) => {
    await openSaved(page, "saved4", numberedCars(24), DESKTOP_1440);
    await expect(cards(page).first()).toBeVisible({ timeout: 15_000 });
    const headerBefore = await box(header(page));
    const mapBefore = await box(mapRegion(page));
    const list = await box(listColumn(page));

    await page.mouse.move(list.x + list.width / 2, list.y + list.height / 2);
    await page.mouse.wheel(0, 1500);
    await expect
      .poll(async () => (await box(page.getByRole("heading", { level: 1 }))).y)
      .toBeLessThan(list.y);

    expect(await box(header(page))).toEqual(headerBefore);
    expect(await box(mapRegion(page))).toEqual(mapBefore);
    const documentScroll = await page.evaluate(() => {
      const scroller = document.scrollingElement ?? document.documentElement;
      return { scrollHeight: scroller.scrollHeight, clientHeight: scroller.clientHeight };
    });
    expect(documentScroll.scrollHeight).toBe(documentScroll.clientHeight);
    const heading = await box(page.getByRole("heading", { level: 1 }));
    const chip = await box(page.getByRole("button", { name: "Km" }));
    expect(heading.y + heading.height).toBeLessThanOrEqual(list.y);
    expect(chip.y + chip.height).toBeLessThanOrEqual(list.y);
  },
);

// --- SAVED-7: the sort in the URL ---

dbTest(
  "SAVED-7: /favorites?sort=km opens with «Km» pressed and the cars in its order — G, B, F, C, E, A, D",
  async ({ page }) => {
    await openSaved(page, "saved7-open", SORT_EXAMPLE, DESKTOP_1440, "/favorites?sort=km");

    await expect(page.getByRole("button", { name: "Km" })).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => sortLetters(page)).toEqual(["G", "B", "F", "C", "E", "A", "D"]);
  },
);

dbTest(
  "SAVED-7: /favorites?sort=year and /favorites?sort= open as «Recientes» — C, E, B, D, A, G, F",
  async ({ page }) => {
    await openSaved(page, "saved7-unknown", SORT_EXAMPLE, DESKTOP_1440, "/favorites?sort=year");
    await expect(page.getByRole("button", { name: "Recientes" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect.poll(() => sortLetters(page)).toEqual(["C", "E", "B", "D", "A", "G", "F"]);

    await page.goto("/favorites?sort=");
    await expect(page.getByRole("button", { name: "Recientes" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect.poll(() => sortLetters(page)).toEqual(["C", "E", "B", "D", "A", "G", "F"]);
  },
);

dbTest(
  "SAVED-7: each chip adds a history entry and Back restores the previous sort; «Recientes» writes no parameter",
  async ({ page }) => {
    await openSaved(page, "saved7-history", SORT_EXAMPLE, DESKTOP_1440);

    await page.getByRole("button", { name: "Precio" }).click();
    await expect(page).toHaveURL(/\/favorites\?sort=price$/);
    await expect.poll(() => sortLetters(page)).toEqual(["D", "E", "A", "B", "F", "C", "G"]);

    await page.getByRole("button", { name: "Km" }).click();
    await expect(page).toHaveURL(/\/favorites\?sort=km$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/favorites\?sort=price$/);
    await expect(page.getByRole("button", { name: "Precio" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect.poll(() => sortLetters(page)).toEqual(["D", "E", "A", "B", "F", "C", "G"]);

    await page.getByRole("button", { name: "Recientes" }).click();
    await expect(page).toHaveURL(/\/favorites$/);
    await expect.poll(() => sortLetters(page)).toEqual(["C", "E", "B", "D", "A", "G", "F"]);
  },
);

// --- SAVED-9, SAVED-19, SAVED-20: the photos' sizes ---

dbTest(
  "SAVED-19, SAVED-20: at 390×844 a row's thumbnail is 110×86 and the car sheet's photo 200px tall",
  async ({ page }) => {
    await openSaved(page, "saved19-sizes", [SORT_CARS.A], PHONE_390);
    const row = rows(page).first();
    await expect(row).toBeVisible({ timeout: 15_000 });

    // CarPhoto's box is the row's first child.
    const thumbnail = await box(row.locator(":scope > div").first());
    expectWithin(thumbnail.width, 110, "thumbnail width");
    expectWithin(thumbnail.height, 86, "thumbnail height");

    await row.click();
    const sheet = page.getByRole("dialog", { name: "Audi A3 2.0 TDI" });
    await expect(sheet).toBeVisible();
    // The photo follows the handle's row.
    const photo = await settledBox(sheet.locator(":scope > div").nth(1));
    expectWithin(photo.height, 200, "sheet photo height");
  },
);

dbTest(
  "SAVED-9: at 1440×900 a card's photo is 242px wide and 20:17, 205.7px tall",
  async ({ page }) => {
    await openSaved(page, "saved9-sizes", SORT_EXAMPLE, DESKTOP_1440);
    const card = cards(page).first();
    await expect(card).toBeVisible({ timeout: 15_000 });

    // CarPhoto's box is the link's first child.
    const photo = await box(card.locator("a > div").first());
    expectWithin(photo.width, 242, "card photo width");
    expectWithin(photo.height, (242 * 17) / 20, "card photo height");
  },
);

// --- SAVED-23: the phone's touch targets ---

dbTest(
  "SAVED-23: at 390×844 the row, and the car sheet's «Cerrar» once it has keyboard focus, «Quitar de guardados» and «Ver anuncio», are each at least 44×44px",
  async ({ page }) => {
    await openSaved(page, "saved23", [SORT_CARS.A], PHONE_390);
    const row = rows(page).first();
    await expect(row).toBeVisible({ timeout: 15_000 });

    const targets: [string, Locator][] = [["the row", row]];
    await row.click();
    const sheet = page.getByRole("dialog", { name: "Audi A3 2.0 TDI" });
    await expect(sheet).toBeVisible();
    // «Cerrar» is visually hidden (SAVED-41) and shows only with keyboard
    // focus: it is the sheet's first control, so Tab then Shift+Tab lands on
    // it from the keyboard, and it is then drawn at 40px.
    const close = sheet.getByRole("button", { name: "Cerrar" });
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(close).toBeFocused();
    const drawn = await box(close);
    expectWithin(drawn.width, 40, "focused «Cerrar» width");
    expectWithin(drawn.height, 40, "focused «Cerrar» height");
    targets.push(
      ["«Cerrar»", close],
      ["«Quitar de guardados»", sheet.getByRole("button", { name: "Quitar de guardados" })],
      ["«Ver anuncio»", sheet.getByRole("link", { name: /Ver anuncio/ })],
    );

    for (const [label, target] of targets) {
      const size = await hitArea(target);
      expect(
        size.width >= 44 && size.height >= 44,
        `${label} is ${size.width}x${size.height}, under the 44px floor`,
      ).toBe(true);
    }
  },
);

// --- SAVED-37, SAVED-38: dragging the car sheet down ---

/** Opens the Audi's car sheet from its row and waits for it to finish sliding in. */
async function openAudiSheet(page: Page, tag: string): Promise<{ row: Locator; sheet: Locator }> {
  await openSaved(page, tag, [SORT_CARS.A], PHONE_390);
  const row = rows(page).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.click();
  const sheet = page.getByRole("dialog", { name: "Audi A3 2.0 TDI" });
  await expect(sheet).toBeVisible();
  await expect.poll(() => sheetOffset(sheet)).toBeLessThan(0.5);
  return { row, sheet };
}

test.describe("SAVED-37, SAVED-38: the car sheet closes when dragged down", () => {
  dbTest(
    "SAVED-37: at 390×844 the car sheet shows no «×», and dragging its handle down 150px closes it with focus back on its row",
    async ({ page }) => {
      const { row, sheet } = await openAudiSheet(page, "saved37");
      // The only close button is «Cerrar», visually hidden: a 1px box inside its
      // 1px border, clipped away.
      const close = await box(sheet.getByRole("button", { name: "Cerrar" }));
      expect(close.width).toBeLessThanOrEqual(2);
      expect(close.height).toBeLessThanOrEqual(2);

      await dragDown(page, sheet.locator("[data-sheet-handle]"), 150);

      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(row).toBeFocused();
    },
  );

  dbTest(
    "SAVED-38: at 390×844 a 40px drag of the handle springs the car sheet back, and a drag from its content moves nothing",
    async ({ page }) => {
      const { sheet } = await openAudiSheet(page, "saved38");

      await dragDown(page, sheet.locator("[data-sheet-handle]"), 40, { hold: true });
      expectWithin(await sheetOffset(sheet), 40, "the sheet mid-drag");
      await page.mouse.up();
      await expect.poll(() => sheetOffset(sheet)).toBeLessThan(0.5);
      await expect(sheet).toBeVisible();

      await dragDown(page, sheet.getByText("Audi A3 2.0 TDI").first(), 150, { hold: true });
      expect(await sheetOffset(sheet)).toBe(0);
      await page.mouse.up();
      await expect(sheet).toBeVisible();
    },
  );
});

// --- SAVED-24: where the toast sits ---

test.describe("SAVED-24: the toast's place", () => {
  dbTest(
    "SAVED-24: at 390×844 «Quitado de guardados» sits 16px from each side and 12px below the header",
    async ({ page }) => {
      await openSaved(page, "saved24-phone", [SORT_CARS.A, SORT_CARS.B], PHONE_390);
      await rows(page).first().click();
      await page.getByRole("dialog").getByRole("button", { name: "Quitar de guardados" }).click();

      await expect(toastBox(page)).toContainText("Quitado de guardados");
      const toast = await settledBox(toastBox(page));
      const head = await box(header(page));
      expectWithin(toast.x, 16, "toast's left edge");
      expectWithin(PHONE_390.width - (toast.x + toast.width), 16, "toast's right margin");
      expectWithin(toast.y, head.y + head.height + 12, "toast's top");
      expect(toast.width).toBeLessThanOrEqual(380);
    },
  );

  dbTest(
    "SAVED-24: at 768×1024 «Quitado de guardados» is 380px wide, centred at x = 384px, 12px below the header",
    async ({ page }) => {
      // The phone band from 600px to 1023px: centred at its 380px (Decisions ›
      // The toast's phone band); 768 / 2 = 384.
      await openSaved(page, "saved24-768", [SORT_CARS.A, SORT_CARS.B], TABLET_768);
      await rows(page).filter({ hasText: "Audi A3 2.0 TDI" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Quitar de guardados" }).click();

      await expect(toastBox(page)).toContainText("Quitado de guardados");
      const toast = await settledBox(toastBox(page));
      const head = await box(header(page));
      expectWithin(toast.width, 380, "toast's width");
      expectWithin(toast.x + toast.width / 2, 384, "toast's centre");
      expectWithin(toast.y, head.y + head.height + 12, "toast's top");
    },
  );

  for (const { viewport, centre } of [
    { viewport: DESKTOP_1440, centre: 415 },
    { viewport: DESKTOP_1280, centre: 415 },
    { viewport: DESKTOP_1024, centre: 273 },
  ]) {
    dbTest(
      `SAVED-24: on /favorites at ${viewport.width}×${viewport.height} «Quitado de guardados» sits 12px below the header, centred at x = ${centre}px over the list column`,
      async ({ page }) => {
        await openSaved(page, `saved24-${viewport.width}`, SORT_EXAMPLE, viewport);
        await cards(page)
          .filter({ hasText: "Audi A3 2.0 TDI" })
          .getByRole("button", { name: "Quitar de guardados" })
          .click();

        await expect(toastBox(page)).toContainText("Quitado de guardados");
        const toast = await settledBox(toastBox(page));
        const head = await box(header(page));
        const list = await box(listColumn(page));
        expectWithin(toast.y, head.y + head.height + 12, "toast's top");
        expectWithin(toast.x + toast.width / 2, centre, "toast's centre");
        expectWithin(
          toast.x + toast.width / 2,
          list.x + list.width / 2,
          "toast's centre over the list's",
        );
        expect(toast.width).toBeLessThanOrEqual(380);
      },
    );
  }

  for (const { viewport, centre } of [
    { viewport: DESKTOP_1440, centre: 415 },
    { viewport: DESKTOP_1024, centre: 256 },
  ]) {
    dbTest(
      `SAVED-24: on /map at ${viewport.width}×${viewport.height} «Alerta creada» sits 12px below the filter row, centred at x = ${centre}px over the results list`,
      async ({ page }) => {
        const email = e2eEmail(`saved24-map-${viewport.width}`);
        await seedUser(email, PASSWORD);
        await page.setViewportSize(viewport);
        await signIn(page, email);
        await page.goto("/map?make=Toyota&maxPrice=20000");
        await page
          .getByRole("button", { name: /crear alerta|create alert/i })
          .first()
          .click();
        await page
          .getByRole("dialog")
          .getByRole("button", { name: /crear alerta|create alert/i })
          .click();

        await expect(toastBox(page)).toContainText(/Alerta creada|Alert created/);
        const toast = await settledBox(toastBox(page));
        const filterRow = await box(page.getByTestId("filter-row"));
        const results = await box(page.getByTestId("results-sheet"));
        expectWithin(toast.y, filterRow.y + filterRow.height + 12, "toast's top");
        expectWithin(toast.x + toast.width / 2, centre, "toast's centre");
        expectWithin(
          toast.x + toast.width / 2,
          results.x + results.width / 2,
          "toast's centre over the list's",
        );
        expect(toast.width).toBeLessThanOrEqual(380);
      },
    );
  }

  test("SAVED-24: on a page with no list column, at 1440×900, a toast sits 12px below the header, centred on the viewport", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP_1440);
    await page.goto("/palette");
    await page.getByTestId("toast-demo").click();

    await expect(toastBox(page)).toContainText("Guardado en tus coches.");
    const toast = await settledBox(toastBox(page));
    const head = await box(header(page));
    expectWithin(toast.y, head.y + head.height + 12, "toast's top");
    expectWithin(toast.x + toast.width / 2, 720, "toast's centre");
    expect(toast.width).toBeLessThanOrEqual(380);
  });
});

// --- SAVED-25 to SAVED-29: the virtualised list, 200 saved cars ---

test.describe("SAVED-25 to SAVED-29: 200 saved cars", () => {
  test.describe.configure({ timeout: 240_000 });

  dbTest(
    "SAVED-25: at 1440×900 at most 30 cards are mounted at the list's top, middle and end",
    async ({ page }) => {
      await openSaved(page, "saved25-desktop", numberedCars(200), DESKTOP_1440);
      await expect(cards(page).first()).toBeVisible({ timeout: 15_000 });

      const mountedTop = await cards(page).count();
      expect(mountedTop).toBeGreaterThan(0);
      expect(mountedTop).toBeLessThanOrEqual(30);

      await scrollTo(cards(page).first(), "middle");
      // Halfway down, the first card is far outside any bounded margin.
      await expect(cards(page).filter({ hasText: "Coche 001" })).toHaveCount(0);
      expect(await cards(page).count()).toBeLessThanOrEqual(30);

      await scrollTo(cards(page).first(), "end");
      await expect(cards(page).filter({ hasText: "Coche 200" })).toBeVisible();
      expect(await cards(page).count()).toBeLessThanOrEqual(30);
    },
  );

  dbTest(
    "SAVED-25: at 390×844 at most 25 rows are mounted at the list's top, middle and end",
    async ({ page }) => {
      await openSaved(page, "saved25-phone", numberedCars(200), PHONE_390);
      await expect(rows(page).first()).toBeVisible({ timeout: 15_000 });

      const mountedTop = await rows(page).count();
      expect(mountedTop).toBeGreaterThan(0);
      expect(mountedTop).toBeLessThanOrEqual(25);

      await scrollTo(rows(page).first(), "middle");
      // Halfway down, the first row is far outside any bounded margin.
      await expect(rows(page).filter({ hasText: "Coche 001" })).toHaveCount(0);
      expect(await rows(page).count()).toBeLessThanOrEqual(25);

      await scrollTo(rows(page).first(), "end");
      await expect(rows(page).filter({ hasText: "Coche 200" })).toBeVisible();
      expect(await rows(page).count()).toBeLessThanOrEqual(25);
    },
  );

  // The rows kept mounted around the focus (SAVED-28) count against the bound
  // too: once the scroll takes the focused row far from the view, they go.
  dbTest(
    "SAVED-25: at 1440×900 with a card in the first row focused, wheeling to the middle keeps at most 30 cards mounted",
    async ({ page }) => {
      await openSaved(page, "saved25-desktop-focus", numberedCars(200), DESKTOP_1440);
      const first = cards(page).filter({ hasText: "Coche 001" });
      await expect(first).toBeVisible({ timeout: 15_000 });
      await first.getByRole("link").focus();
      await expect(first.getByRole("link")).toBeFocused();

      const column = await box(listColumn(page));
      await page.mouse.move(column.x + column.width / 2, column.y + column.height / 2);
      const half = await listColumn(page).evaluate((element: HTMLElement) => {
        let node: HTMLElement | null = element;
        while (node) {
          const style = getComputedStyle(node);
          if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) break;
          node = node.parentElement;
        }
        return (node ?? document.documentElement).scrollHeight / 2;
      });
      await page.mouse.wheel(0, half);

      await expect(cards(page).filter({ hasText: "Coche 001" })).toHaveCount(0);
      await expect.poll(() => cards(page).count()).toBeLessThanOrEqual(30);
      expect(await cards(page).count()).toBeGreaterThan(0);
    },
  );

  dbTest(
    "SAVED-25: at 390×844 with the focus back on a row from its car sheet, scrolling to the middle keeps at most 25 rows mounted",
    async ({ page }) => {
      await openSaved(page, "saved25-phone-focus", numberedCars(200), PHONE_390);
      const first = rows(page).filter({ hasText: "Coche 001" });
      await expect(first).toBeVisible({ timeout: 15_000 });

      await first.click();
      const sheet = page.getByRole("dialog", { name: "Coche 001" });
      await expect(sheet).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(sheet).toBeHidden();
      await expect(first).toBeFocused();

      await scrollTo(first, "middle");

      await expect(rows(page).filter({ hasText: "Coche 001" })).toHaveCount(0);
      await expect.poll(() => rows(page).count()).toBeLessThanOrEqual(25);
      expect(await rows(page).count()).toBeGreaterThan(0);
    },
  );

  dbTest(
    "SAVED-26: at 1440×900, from the list's top, the 150th card's pin mounts that card, scrolls it wholly into view, outlines it and opens its preview",
    async ({ page }) => {
      await openSaved(page, "saved26", numberedCars(200), DESKTOP_1440);
      await expect(cards(page).first()).toBeVisible({ timeout: 15_000 });
      await expect(cards(page).filter({ hasText: "Coche 150" })).toHaveCount(0);

      const pin = page.getByRole("button", { name: /^Coche 150, / });
      await pin.focus();
      await page.keyboard.press("Enter");

      const target = cards(page).filter({ hasText: "Coche 150" });
      await expect(target).toHaveCount(1);
      await expect(target).toHaveAttribute("data-active", "true");
      await expect
        .poll(async () => wholly(await box(target), await box(listColumn(page))))
        .toBe(true);
      const preview = page.getByRole("article", { name: "Vista previa del coche" });
      await expect(preview).toBeVisible();
      await expect(preview).toContainText("Coche 150");
    },
  );

  dbTest(
    "SAVED-27: at 1440×900 Back from /map restores the list's scroll — the same card is first wholly in view",
    async ({ page }) => {
      await openSaved(page, "saved27-desktop", numberedCars(200), DESKTOP_1440);
      await expect(cards(page).first()).toBeVisible({ timeout: 15_000 });
      await scrollUntilMounted(page, cards(page), "Coche 120");
      const view = await box(listColumn(page));
      const before = await firstWhollyVisible(cards(page), view);
      expect(before).not.toBe("Coche 001");

      await page
        .getByTestId("header-desktop")
        .getByRole("link", { name: /^(mapa|map)$/i })
        .click();
      await expect(page).toHaveURL(/\/map/);
      await page.goBack();
      await expect(page).toHaveURL(/\/favorites/);

      await expect
        .poll(async () => firstWhollyVisible(cards(page), await box(listColumn(page))))
        .toBe(before);
    },
  );

  dbTest(
    "SAVED-27: at 390×844 Back from /map, followed from the tab bar's «Mapa», restores the rows' scroll — the same row is first wholly in view",
    async ({ page }) => {
      await openSaved(page, "saved27-phone", numberedCars(200), PHONE_390);
      await expect(rows(page).first()).toBeVisible({ timeout: 15_000 });
      await scrollUntilMounted(page, rows(page), "Coche 120");

      // Scrolling down hid the tab bar; a little scroll up brings it back (MAPUI-53).
      const tabBarMap = page
        .getByRole("navigation", { name: "Principal" })
        .getByRole("link", { name: "Mapa" });
      await page.mouse.move(PHONE_390.width / 2, PHONE_390.height / 2);
      await page.mouse.wheel(0, -60);
      await expect(tabBarMap).toBeInViewport();

      const view = { x: 0, y: 64, width: PHONE_390.width, height: PHONE_390.height - 64 };
      const before = await firstWhollyVisible(rows(page), view);
      expect(before).not.toBe("Coche 001");
      expect(before).not.toBe("none");

      // Followed from the keyboard: in `next dev` the dev-tools button sits over the bar's first tab.
      await tabBarMap.focus();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/map/);
      await page.goBack();
      await expect(page).toHaveURL(/\/favorites/);

      await expect.poll(() => firstWhollyVisible(rows(page), view)).toBe(before);
    },
  );

  dbTest(
    "SAVED-28: at 1440×900 Tab from «Km» goes through each card's link and heart in order, to the 200th card's heart, each wholly in view",
    async ({ page }) => {
      await openSaved(page, "saved28-desktop", numberedCars(200), DESKTOP_1440);
      await expect(cards(page).first()).toBeVisible({ timeout: 15_000 });
      await page.getByRole("button", { name: "Km" }).focus();

      for (let n = 1; n <= 200; n++) {
        for (const kind of ["link", "heart"] as const) {
          await page.keyboard.press("Tab");
          const focused = await page.evaluate(() => {
            const active = document.activeElement as HTMLElement | null;
            const article = active?.closest("article");
            const list = document.querySelector<HTMLElement>('[data-testid="saved-list"]');
            const cardRect = article?.getBoundingClientRect();
            const listRect = list?.getBoundingClientRect();
            return {
              tag: active?.tagName ?? "",
              label: active?.getAttribute("aria-label") ?? "",
              title: /Coche \d{3}/.exec(article?.textContent ?? "")?.[0] ?? "none",
              inView:
                !!cardRect &&
                !!listRect &&
                cardRect.top >= listRect.top - 1 &&
                cardRect.bottom <= listRect.bottom + 1,
            };
          });
          const where = `Tab ${kind} of ${carTitle(n)}`;
          expect(focused.title, where).toBe(carTitle(n));
          if (kind === "link") expect(focused.tag, where).toBe("A");
          else expect(focused.label, where).toBe("Quitar de guardados");
          expect(focused.inView, `${where}: the card is wholly in the list's view`).toBe(true);
        }
      }
    },
  );

  dbTest("SAVED-28: at 390×844 Tab goes through the 200 rows in order", async ({ page }) => {
    await openSaved(page, "saved28-phone", numberedCars(200), PHONE_390);
    await expect(rows(page).first()).toBeVisible({ timeout: 15_000 });
    await rows(page).filter({ hasText: "Coche 001" }).focus();

    for (let n = 2; n <= 200; n++) {
      await page.keyboard.press("Tab");
      const title = await page.evaluate(
        () =>
          /Coche \d{3}/.exec(
            document.activeElement?.getAttribute("aria-haspopup") === "dialog"
              ? (document.activeElement.textContent ?? "")
              : "",
          )?.[0] ?? "none",
      );
      expect(title, `Tab ${n - 1}`).toBe(carTitle(n));
    }
  });

  dbTest(
    "SAVED-29: at 1440×900 removing the 150th card leaves 149 then 151 and 199 cars; «Deshacer» puts it back between them, 200 again; no car twice",
    async ({ page }) => {
      const email = await openSaved(page, "saved29", numberedCars(200), DESKTOP_1440);
      await expect(cards(page).first()).toBeVisible({ timeout: 15_000 });
      const target = await scrollUntilMounted(page, cards(page), "Coche 150");
      const pins = page.locator(".leaflet-marker-icon");
      await expect(pins).toHaveCount(200);

      await target.getByRole("button", { name: "Quitar de guardados" }).click();

      await expect(cards(page).filter({ hasText: "Coche 150" })).toHaveCount(0);
      await expect(pins).toHaveCount(199);
      await expect.poll(() => favoriteCount(email), { timeout: 15_000 }).toBe(199);
      await expectNeighbours(page, ["Coche 149", "Coche 151"]);
      await expectEachCarOnce(page);

      await toastBox(page).getByRole("button", { name: "Deshacer" }).click();

      await expect(cards(page).filter({ hasText: "Coche 150" })).toHaveCount(1);
      await expect(pins).toHaveCount(200);
      await expect.poll(() => favoriteCount(email), { timeout: 15_000 }).toBe(200);
      await expectNeighbours(page, ["Coche 149", "Coche 150", "Coche 151"]);
      await expectEachCarOnce(page);

      // A second removal right after: the heart pressed is its own car's.
      await cards(page)
        .filter({ hasText: "Coche 151" })
        .getByRole("button", { name: "Quitar de guardados" })
        .click();

      await expect(cards(page).filter({ hasText: "Coche 151" })).toHaveCount(0);
      await expectNeighbours(page, ["Coche 150", "Coche 152"]);
      await expect(cards(page).filter({ hasText: "Coche 150" })).toHaveCount(1);
      await expect.poll(() => favoriteCount(email), { timeout: 15_000 }).toBe(199);
      await expectEachCarOnce(page);
    },
  );
});

/** `run` appears, in that order and next to each other, among the cards drawn. */
async function expectNeighbours(page: Page, run: string[]) {
  await expect
    .poll(async () => {
      const titles = await numberedTitles(cards(page));
      const start = titles.indexOf(run[0]);
      return start === -1 ? [] : titles.slice(start, start + run.length);
    })
    .toEqual(run);
}

/** No car is drawn twice, and each card holds exactly one heart, its own. */
async function expectEachCarOnce(page: Page) {
  const titles = await numberedTitles(cards(page));
  expect(new Set(titles).size, `cards drawn: ${titles.join(", ")}`).toBe(titles.length);
  const heartsPerCard = await cards(page).evaluateAll((elements) =>
    elements.map(
      (element) => element.querySelectorAll('button[aria-label="Quitar de guardados"]').length,
    ),
  );
  expect(heartsPerCard.every((count) => count === 1)).toBe(true);
}
