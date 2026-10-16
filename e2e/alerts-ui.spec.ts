import { test, expect, type Locator, type Page } from "@playwright/test";
import {
  e2eEmail,
  favoriteCount,
  type SeedAlert,
  type SeedAlertMatch,
  seedAlertMatches,
  seedAlerts,
  seedUser,
} from "./fixtures/db";
import { dragDown, sheetOffset } from "./fixtures/drag";
import {
  type Box,
  box,
  carTitle,
  expectEachCarOnce,
  expectNeighbours,
  expectWithin,
  firstWhollyVisible,
  hitArea,
  scrollTo,
  scrollUntilMounted,
  settledBox,
  wholly,
} from "./fixtures/measure";
import { mockListingSources } from "./fixtures/network";
import { signIn, waitForSession } from "./fixtures/session";
import {
  ADA_ALERT_ORDER,
  type AdaAlert,
  ALERT_CREATED_AT,
  ALERT_CRITERIA,
  ALERT_LABEL,
  ALERT_PLACE_NAME,
  corollaMatches,
  serie3Matches,
} from "../test/fixtures/alert-listings";

// docs/specs/redesign-alerts.md (ALERTUI-3, ALERTUI-4, ALERTUI-12,
// ALERTUI-21, ALERTUI-27, ALERTUI-29 to ALERTUI-32, ALERTUI-35, ALERTUI-37,
// ALERTUI-51 to ALERTUI-56): what only a browser can show — the layout by
// width, the one scrolling column, the URL's history, Back after a delete,
// the touch targets, where the toast sits, the virtualised match list with 200
// matches at both widths, the restored scroll of /alerts, long text cut to
// one line, and dragging the phone sheets down.
//
// Both routes need a signed-in account with alerts, which this suite only has
// against a real database, so every case runs in `pnpm test:e2e:db` (E2E_DB)
// and is skipped elsewhere, like e2e/saved.spec.ts. The alerts and their
// matches are written straight into Postgres (seedAlerts, seedAlertMatches),
// with the instant each was created or found, since the order depends on it.
const dbTest = process.env.E2E_DB ? test : test.skip;

// The spec quotes the Spanish copy, the default locale.
test.use({ locale: "es-ES" });

// Duplicated from e2e/saved.spec.ts, per the suite's convention.
const PASSWORD = "harbour-lentil-quilt-97";

const DESKTOP_1440 = { width: 1440, height: 900 };
const DESKTOP_1280 = { width: 1280, height: 900 };
const DESKTOP_1279 = { width: 1279, height: 900 };
const DESKTOP_1024 = { width: 1024, height: 900 };
const PHONE_1023 = { width: 1023, height: 900 };
const PHONE_390 = { width: 390, height: 844 };

test.beforeEach(async ({ page, isMobile }) => {
  test.skip(!!isMobile, "the alerts flows set their own viewports in the chromium project");
  await mockListingSources(page);
});

// --- The alerts ---

/** Ada's four alerts of worked example "Open alert", as rows. */
function adaSeed(which: AdaAlert): SeedAlert {
  return {
    label: ALERT_LABEL[which],
    criteria: ALERT_CRITERIA[which],
    placeName: ALERT_PLACE_NAME[which],
    createdAt: new Date(ALERT_CREATED_AT[which]),
  };
}

/** A fixture listing as a match found `minutesAgo` minutes before 2026-10-14 10:00. */
function asMatch(
  listing: ReturnType<typeof corollaMatches>[number],
  minutesAgo: number,
): SeedAlertMatch {
  return {
    listingId: listing.id,
    title: listing.title,
    price: listing.price,
    mileage: listing.mileage,
    year: listing.year,
    location: listing.location,
    lat: listing.lat,
    lng: listing.lng,
    source: listing.source,
    createdAt: new Date(Date.parse("2026-10-14T10:00:00Z") - minutesAgo * 60_000),
  };
}

type AdaIds = Record<AdaAlert, string>;

/** Seeds Ada's four alerts, the Corolla's four matches and Serie 3's twelve; returns the ids. */
async function seedAda(email: string): Promise<AdaIds> {
  const ids = await seedAlerts(
    email,
    ADA_ALERT_ORDER.map((which) => adaSeed(which)),
  );
  const byName = Object.fromEntries(
    ADA_ALERT_ORDER.map((which, index) => [which, ids[index]]),
  ) as AdaIds;
  await seedAlertMatches(byName.corolla, corollaMatches().map(asMatch));
  await seedAlertMatches(byName.serie3, serie3Matches().map(asMatch));
  return byName;
}

/** «Coche 001» newest to «Coche NNN» oldest, each at its own point, 10.000 € plus ten per number. */
function numberedMatches(count: number): SeedAlertMatch[] {
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
      createdAt: new Date(newest - n * 60_000),
    };
  });
}

/** A fresh account with Ada's alerts, signed in, at `viewport`, on `path(ids)`. */
async function openAda(
  page: Page,
  tag: string,
  viewport: { width: number; height: number },
  path: (ids: AdaIds) => string = () => "/alerts",
): Promise<{ email: string; ids: AdaIds }> {
  const email = e2eEmail(tag);
  await seedUser(email, PASSWORD);
  const ids = await seedAda(email);
  await page.setViewportSize(viewport);
  await signIn(page, email, PASSWORD);
  await page.goto(path(ids));
  await waitForSession(page);
  return { email, ids };
}

/** A fresh account with one alert of `count` numbered matches, signed in, on its page. */
async function openLongAlert(
  page: Page,
  tag: string,
  count: number,
  viewport: { width: number; height: number },
): Promise<{ email: string; alertId: string }> {
  const email = e2eEmail(tag);
  await seedUser(email, PASSWORD);
  const [alertId] = await seedAlerts(email, [
    {
      label: "Muchos coches",
      criteria: { brand: "Toyota", maxPrice: 30000 },
      createdAt: new Date("2026-10-01T10:00:00Z"),
    },
  ]);
  await seedAlertMatches(alertId, numberedMatches(count));
  await page.setViewportSize(viewport);
  await signIn(page, email, PASSWORD);
  await page.goto(`/alerts/${alertId}`);
  await waitForSession(page);
  return { email, alertId };
}

// --- The page's parts ---

function header(page: Page): Locator {
  return page.locator("header").first();
}

function mapRegion(page: Page): Locator {
  return page.getByRole("region", { name: "Mapa de la alerta" });
}

/** The list column: the nearest scrolling ancestor of the page's h1, marked once found. */
async function listColumn(page: Page): Promise<Locator> {
  await page
    .getByRole("heading", { level: 1 })
    .first()
    .evaluate((heading) => {
      let node: HTMLElement | null = heading.parentElement;
      while (node) {
        if (/(auto|scroll)/.test(getComputedStyle(node).overflowY)) break;
        node = node.parentElement;
      }
      node?.setAttribute("data-e2e-list-column", "");
    });
  return page.locator("[data-e2e-list-column]");
}

function openCard(page: Page, name: string): Locator {
  return page.getByRole("article", { name });
}

/** /alerts' AlertCards at desktop width: the open one (an article) and the folded ones (buttons). */
function desktopCards(page: Page): Locator {
  return page
    .locator("main")
    .locator('article[aria-labelledby], button[aria-expanded="false"][aria-labelledby]');
}

/** The alert match cards of the open AlertCard: its links to listings. */
function matchCards(card: Locator): Locator {
  return card.locator('a[target="_blank"]');
}

/** /alerts/[id]'s Guardados cards, the virtualised list's rows (`data-index`). */
function cards(page: Page): Locator {
  return page.locator("[data-index] article:not([aria-label])");
}

/** /alerts/[id]'s compact rows on the phone. */
function rows(page: Page): Locator {
  return page.locator('[data-index] button[aria-haspopup="dialog"]').filter({ hasText: /\S/ });
}

/** /alerts' phone AlertCards: links to an alert's page. */
function phoneCards(page: Page): Locator {
  return page.locator("main a[href^='/alerts/']");
}

function toastBox(page: Page): Locator {
  return page.locator('[data-sonner-toast][data-front="true"]');
}

/** The boxes of `items` on the first drawn row, left to right. */
async function firstRow(items: Locator): Promise<Box[]> {
  const boxes = await items.evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }),
  );
  return boxes.filter((item) => Math.abs(item.y - boxes[0].y) <= 1).sort((a, b) => a.x - b.x);
}

// --- ALERTUI-3: the layout of /alerts by width (viewport table) ---

const DESKTOP_LAYOUTS = [
  { viewport: DESKTOP_1440, list: 830, columns: 4, card: 170.5, map: 610 },
  { viewport: DESKTOP_1280, list: 830, columns: 4, card: 170.5, map: 450 },
  { viewport: DESKTOP_1279, list: 546, columns: 2, card: 213, map: 733 },
  { viewport: DESKTOP_1024, list: 546, columns: 2, card: 213, map: 478 },
];

test.describe("ALERTUI-3: the layout of /alerts by width", () => {
  for (const layout of DESKTOP_LAYOUTS) {
    const { width, height } = layout.viewport;

    dbTest(
      `ALERTUI-3: at ${width}×${height} the list column is ${layout.list}px with 32px padding, the open card's matches ${layout.columns} columns ${layout.card}px wide 14px apart, and the map ${layout.map}px beside it`,
      async ({ page }) => {
        await openAda(page, `alertui3-${width}`, layout.viewport);
        const open = openCard(page, "Corolla híbrido");
        await expect(matchCards(open).first()).toBeVisible({ timeout: 15_000 });

        const column = await listColumn(page);
        const list = await box(column);
        expectWithin(list.width, layout.list, "list column width");
        const padding = await column.evaluate((element) => {
          const style = getComputedStyle(element);
          return { left: style.paddingLeft, right: style.paddingRight };
        });
        expect(padding).toEqual({ left: "32px", right: "32px" });

        const row = await firstRow(matchCards(open));
        expect(row).toHaveLength(layout.columns);
        for (const item of row) expectWithin(item.width, layout.card, "match card width");
        expectWithin(row[1].x - (row[0].x + row[0].width), 14, "gap between match cards");

        const map = await box(mapRegion(page));
        expectWithin(map.width, layout.map, "map width");
        expectWithin(map.x, list.x + list.width, "map's left edge against the list's right edge");
        expectWithin(map.x + map.width, width, "map's right edge against the viewport's");
      },
    );
  }

  for (const viewport of [PHONE_1023, PHONE_390]) {
    dbTest(
      `ALERTUI-3: at ${viewport.width}×${viewport.height} /alerts is the phone composition — phone cards and no map`,
      async ({ page }) => {
        await openAda(page, `alertui3-${viewport.width}`, viewport);

        await expect(phoneCards(page).first()).toBeVisible({ timeout: 15_000 });
        await expect(phoneCards(page)).toHaveCount(4);
        await expect(mapRegion(page)).toHaveCount(0);
      },
    );
  }
});

// --- ALERTUI-4: only the list column scrolls ---

test.describe("ALERTUI-4: only the list column scrolls", () => {
  for (const viewport of [DESKTOP_1440, DESKTOP_1024]) {
    dbTest(
      `ALERTUI-4: at ${viewport.width}×${viewport.height}, with twelve alerts, scrolling /alerts moves the list column only`,
      async ({ page }) => {
        const email = e2eEmail(`alertui4-${viewport.width}`);
        await seedUser(email, PASSWORD);
        await seedAlerts(
          email,
          Array.from({ length: 12 }, (_, index) => ({
            label: `Alerta ${index + 1}`,
            criteria: { brand: "Toyota", maxPrice: 10000 + index * 1000 },
            createdAt: new Date(Date.parse("2026-10-10T10:00:00Z") - index * 3_600_000),
          })),
        );
        await page.setViewportSize(viewport);
        await signIn(page, email, PASSWORD);
        await page.goto("/alerts");
        await waitForSession(page);
        await expectOnlyTheListScrolls(page);
      },
    );

    dbTest(
      `ALERTUI-4: at ${viewport.width}×${viewport.height}, with 24 matches, scrolling /alerts/[id] moves the list column only`,
      async ({ page }) => {
        await openLongAlert(page, `alertui4-id-${viewport.width}`, 24, viewport);
        await expect(cards(page).first()).toBeVisible({ timeout: 15_000 });
        await expectOnlyTheListScrolls(page);
      },
    );
  }
});

async function expectOnlyTheListScrolls(page: Page) {
  const headerBefore = await box(header(page));
  const mapBefore = await box(mapRegion(page));
  const list = await box(await listColumn(page));

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
}

// --- ALERTUI-12: the open alert in the URL (worked example "Open alert") ---

test.describe("ALERTUI-12: the open alert in the URL", () => {
  dbTest(
    "ALERTUI-12: at 1440×900 /alerts opens Corolla híbrido; pressing Golf TDI writes ?alert=<Golf's id> as a new entry; Back restores Corolla híbrido and /alerts",
    async ({ page }) => {
      const { ids } = await openAda(page, "alertui12-history", DESKTOP_1440);
      await expect(openCard(page, "Corolla híbrido")).toBeVisible({ timeout: 15_000 });
      await expect(page).toHaveURL(/\/alerts$/);

      await page.getByRole("button", { name: "Golf TDI" }).click();
      await expect(page).toHaveURL(new RegExp(`/alerts\\?alert=${ids.golf}$`));
      await expect(openCard(page, "Golf TDI")).toBeVisible();

      await page.goBack();
      await expect(page).toHaveURL(/\/alerts$/);
      await expect(openCard(page, "Corolla híbrido")).toBeVisible();
    },
  );

  dbTest(
    "ALERTUI-12: /alerts?alert=<Clio's id> opens Clio barato; pressing Corolla híbrido writes /alerts",
    async ({ page }) => {
      await openAda(page, "alertui12-clio", DESKTOP_1440, (ids) => `/alerts?alert=${ids.clio}`);
      await expect(openCard(page, "Clio barato")).toBeVisible({ timeout: 15_000 });

      await page.getByRole("button", { name: "Corolla híbrido" }).click();
      await expect(page).toHaveURL(/\/alerts$/);
      await expect(openCard(page, "Corolla híbrido")).toBeVisible();
    },
  );

  dbTest(
    "ALERTUI-12: another user's id, a malformed one, an empty one and a deleted one each open Corolla híbrido and leave the URL as it is",
    async ({ page }) => {
      const grace = e2eEmail("alertui12-grace");
      await seedUser(grace, PASSWORD);
      const [graceAlert] = await seedAlerts(grace, [
        {
          label: "Grace's search",
          criteria: { brand: "Audi" },
          createdAt: new Date("2026-10-10T10:00:00Z"),
        },
      ]);
      const { email } = await openAda(page, "alertui12-fallback", DESKTOP_1440);
      const [deleted] = await seedAlerts(email, [
        {
          label: "Borrada",
          criteria: { brand: "Kia" },
          createdAt: new Date("2026-10-12T10:00:00Z"),
          deletedAt: new Date("2026-10-13T10:00:00Z"),
        },
      ]);

      for (const query of [
        `?alert=${graceAlert}`,
        "?alert=not-a-uuid",
        "?alert=",
        `?alert=${deleted}`,
      ]) {
        await page.goto(`/alerts${query}`);
        await expect(openCard(page, "Corolla híbrido"), query).toBeVisible({ timeout: 15_000 });
        await expect(page.getByText("Grace's search")).toHaveCount(0);
        await expect(page.getByText("Borrada")).toHaveCount(0);
        expect(new URL(page.url()).search).toBe(query);
      }
    },
  );

  dbTest(
    "ALERTUI-12: at 390×844 /alerts?alert=<Golf's id> lists the four phone cards, none open, and leaves the URL as it is",
    async ({ page }) => {
      const { ids } = await openAda(
        page,
        "alertui12-phone",
        PHONE_390,
        (ids) => `/alerts?alert=${ids.golf}`,
      );

      await expect(phoneCards(page)).toHaveCount(4, { timeout: 15_000 });
      await expect(page.getByRole("article", { name: "Golf TDI" })).toHaveCount(0);
      expect(new URL(page.url()).search).toBe(`?alert=${ids.golf}`);
    },
  );
});

// --- ALERTUI-21: /alerts/[id]'s grid ---

test.describe("ALERTUI-21: the alert page's grid at desktop width", () => {
  for (const { viewport, columns, card } of [
    { viewport: DESKTOP_1440, columns: 3, card: 242 },
    { viewport: DESKTOP_1024, columns: 2, card: 231 },
  ]) {
    dbTest(
      `ALERTUI-21: at ${viewport.width}×${viewport.height} the matches sit in ${columns} columns ${card}px wide, 20px apart`,
      async ({ page }) => {
        await openAda(
          page,
          `alertui21-${viewport.width}`,
          viewport,
          (ids) => `/alerts/${ids.serie3}`,
        );
        await expect(cards(page).first()).toBeVisible({ timeout: 15_000 });

        const row = await firstRow(cards(page));
        expect(row).toHaveLength(columns);
        for (const item of row) expectWithin(item.width, card, "card width");
        expectWithin(row[1].x - (row[0].x + row[0].width), 20, "gap between cards");
      },
    );
  }
});

// --- Sizes the component tests cannot measure ---

test.describe("the measured sizes", () => {
  dbTest("ALERTUI-8: at 1440×900 an alert match card's photo is 110px tall", async ({ page }) => {
    await openAda(page, "alertui8-photo", DESKTOP_1440);
    const card = matchCards(openCard(page, "Corolla híbrido")).first();
    await expect(card).toBeVisible({ timeout: 15_000 });

    // CarPhoto's box is the link's first child.
    expectWithin((await box(card.locator(":scope > div").first())).height, 110, "photo height");
  });

  dbTest(
    "ALERTUI-22: at 390×844 the zone is 350×180, «Volver» 40px round, and a row's thumbnail 110×86",
    async ({ page }) => {
      await openAda(page, "alertui22-sizes", PHONE_390, (ids) => `/alerts/${ids.corolla}`);
      const zone = page.getByRole("region", { name: "Zona de la alerta" });
      await expect(zone).toBeVisible({ timeout: 15_000 });

      const zoneBox = await box(zone);
      expectWithin(zoneBox.width, 350, "zone width");
      expectWithin(zoneBox.height, 180, "zone height");
      const back = await box(header(page).getByRole("link", { name: "Volver" }));
      expectWithin(back.width, 40, "«Volver» width");
      expectWithin(back.height, 40, "«Volver» height");
      const thumbnail = await box(rows(page).first().locator(":scope > div").first());
      expectWithin(thumbnail.width, 110, "thumbnail width");
      expectWithin(thumbnail.height, 86, "thumbnail height");
    },
  );
});

// --- ALERTUI-27: the phone's touch targets ---

dbTest(
  "ALERTUI-27: at 390×844 every phone AlertCard, «Volver», each row, the car sheet's focused «Cerrar», «Guardar», «Ver anuncio», «Eliminar alerta» and the confirmation's «Eliminar» and «Cancelar» are each at least 44×44px",
  async ({ page }) => {
    const { ids } = await openAda(page, "alertui27", PHONE_390);
    await expect(phoneCards(page).first()).toBeVisible({ timeout: 15_000 });
    const targets: [string, Locator][] = [];
    for (let index = 0; index < 4; index++)
      targets.push([`phone card ${index + 1}`, phoneCards(page).nth(index)]);
    await expectHitAreas(targets);

    await page.goto(`/alerts/${ids.corolla}`);
    await expect(rows(page).first()).toBeVisible({ timeout: 15_000 });
    const pageTargets: [string, Locator][] = [
      ["«Volver»", header(page).getByRole("link", { name: "Volver" })],
    ];
    for (let index = 0; index < 4; index++)
      pageTargets.push([`row ${index + 1}`, rows(page).nth(index)]);
    pageTargets.push(["«Eliminar alerta»", page.getByRole("button", { name: "Eliminar alerta" })]);
    await expectHitAreas(pageTargets);

    await rows(page).first().click();
    const sheet = page.getByRole("dialog", { name: "Toyota Corolla 125H" });
    await expect(sheet).toBeVisible();
    const close = sheet.getByRole("button", { name: "Cerrar" });
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(close).toBeFocused();
    await expectHitAreas([
      ["«Cerrar»", close],
      ["«Guardar»", sheet.getByRole("button", { name: /^(Guardar|Quitar de guardados)$/ })],
      ["«Ver anuncio»", sheet.getByRole("link", { name: /Ver anuncio/ })],
    ]);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();

    await page.getByRole("button", { name: "Eliminar alerta" }).click();
    const confirmation = page.getByRole("alertdialog", { name: "¿Eliminar «Corolla híbrido»?" });
    await expect(confirmation).toBeVisible();
    await expectHitAreas([
      ["the confirmation's «Eliminar»", confirmation.getByRole("button", { name: "Eliminar" })],
      ["«Cancelar»", confirmation.getByRole("button", { name: "Cancelar" })],
    ]);
  },
);

async function expectHitAreas(targets: [string, Locator][]) {
  for (const [label, target] of targets) {
    const size = await hitArea(target);
    expect(
      size.width >= 44 && size.height >= 44,
      `${label} is ${size.width}x${size.height}, under the 44px floor`,
    ).toBe(true);
  }
}

// --- ALERTUI-32: dragging the phone sheets down ---

test.describe("ALERTUI-32: the car sheet and the confirmation sheet close when dragged down", () => {
  dbTest(
    "ALERTUI-32: at 390×844 a 150px drag of the car sheet's handle closes it with focus back on its row; a slow 40px drag springs it back",
    async ({ page }) => {
      await openAda(page, "alertui32-car", PHONE_390, (ids) => `/alerts/${ids.corolla}`);
      const row = rows(page).first();
      await expect(row).toBeVisible({ timeout: 15_000 });
      await row.click();
      const sheet = page.getByRole("dialog", { name: "Toyota Corolla 125H" });
      await expect(sheet).toBeVisible();
      await expect.poll(() => sheetOffset(sheet)).toBeLessThan(0.5);

      await dragDown(page, sheet.locator("[data-sheet-handle]"), 40, { hold: true });
      expectWithin(await sheetOffset(sheet), 40, "the sheet mid-drag");
      await page.mouse.up();
      await expect.poll(() => sheetOffset(sheet)).toBeLessThan(0.5);
      await expect(sheet).toBeVisible();

      await dragDown(page, sheet.locator("[data-sheet-handle]"), 150);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(row).toBeFocused();
    },
  );

  dbTest(
    "ALERTUI-32: at 390×844 a 150px drag of the confirmation sheet's handle closes it with nothing sent and focus back on «Eliminar alerta»; a slow 40px drag springs it back",
    async ({ page }) => {
      const { ids } = await openAda(
        page,
        "alertui32-confirm",
        PHONE_390,
        (ids) => `/alerts/${ids.serie3}`,
      );
      const remove = page.getByRole("button", { name: "Eliminar alerta" });
      await expect(remove).toBeVisible({ timeout: 15_000 });
      await remove.click();
      const sheet = page.getByRole("alertdialog", { name: "¿Eliminar «Serie 3 diésel»?" });
      await expect(sheet).toBeVisible();
      await expect.poll(() => sheetOffset(sheet)).toBeLessThan(0.5);

      await dragDown(page, sheet.locator("[data-sheet-handle]"), 40, { hold: true });
      expectWithin(await sheetOffset(sheet), 40, "the sheet mid-drag");
      await page.mouse.up();
      await expect.poll(() => sheetOffset(sheet)).toBeLessThan(0.5);

      await dragDown(page, sheet.locator("[data-sheet-handle]"), 150);
      await expect(page.getByRole("alertdialog")).toHaveCount(0);
      await expect(remove).toBeFocused();
      await expect(page).toHaveURL(new RegExp(`/alerts/${ids.serie3}$`));
    },
  );
});

// --- ALERTUI-35: deleting the alert whose page is open (worked example "Delete") ---

dbTest(
  "ALERTUI-35: at 1440×900 deleting Corolla híbrido from its page lands on /alerts with three cards, Golf TDI open, focus on «Alertas», and Back does not return to the deleted alert",
  async ({ page }) => {
    const { ids } = await openAda(
      page,
      "alertui35",
      DESKTOP_1440,
      (ids) => `/alerts/${ids.corolla}`,
    );
    await page.getByRole("button", { name: "Eliminar alerta" }).click();
    const dialog = page.getByRole("alertdialog", { name: "¿Eliminar «Corolla híbrido»?" });
    await expect(dialog.getByRole("button", { name: "Cancelar" })).toBeFocused();

    await dialog.getByRole("button", { name: "Eliminar" }).click();

    await expect(page).toHaveURL(/\/alerts$/);
    await expect(openCard(page, "Golf TDI")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Corolla híbrido")).toHaveCount(0);
    await expect(desktopCards(page)).toHaveCount(3);
    for (const name of ["Clio barato", "Serie 3 diésel"])
      await expect(page.getByRole("button", { name })).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("heading", { level: 1, name: "Alertas" })).toBeFocused();
    await expect(toastBox(page)).toHaveCount(0);
    await page.goBack();
    await expect(page).not.toHaveURL(new RegExp(`/alerts/${ids.corolla}$`));
  },
);

dbTest(
  "ALERTUI-35: at 390×844 deleting Serie 3 diésel from its page lands on /alerts with three phone cards and no toast",
  async ({ page }) => {
    await openAda(page, "alertui35-phone", PHONE_390, (ids) => `/alerts/${ids.serie3}`);
    const remove = page.getByRole("button", { name: "Eliminar alerta" });
    await expect(remove).toBeVisible({ timeout: 15_000 });
    await remove.click();
    const sheet = page.getByRole("alertdialog", { name: "¿Eliminar «Serie 3 diésel»?" });
    await expect(sheet).toBeVisible();

    await sheet.getByRole("button", { name: "Eliminar" }).click();

    await expect(page).toHaveURL(/\/alerts$/);
    await expect(phoneCards(page)).toHaveCount(3, { timeout: 15_000 });
    await expect(page.getByText("Serie 3 diésel")).toHaveCount(0);
    await expect(toastBox(page)).toHaveCount(0);
  },
);

// --- ALERTUI-35: Back after a delete (Edge cases › Deleting the alert whose page is open) ---

test.describe("ALERTUI-35: Back after a delete", () => {
  dbTest(
    "ALERTUI-35: at 1440×900, /alerts, press Golf TDI (?alert=), delete it, then Back: Golf TDI is not listed",
    async ({ page }) => {
      const { ids } = await openAda(page, "alertui35-back-list", DESKTOP_1440);
      await expect(openCard(page, "Corolla híbrido")).toBeVisible({ timeout: 15_000 });
      await page.getByRole("button", { name: "Golf TDI" }).click();
      await expect(page).toHaveURL(new RegExp(`/alerts\\?alert=${ids.golf}$`));
      const golf = openCard(page, "Golf TDI");
      await expect(golf).toBeVisible();

      await golf.getByRole("button", { name: "Eliminar" }).click();
      await page
        .getByRole("alertdialog", { name: "¿Eliminar «Golf TDI»?" })
        .getByRole("button", { name: "Eliminar" })
        .click();
      await expect(page).toHaveURL(/\/alerts$/);
      await expect(desktopCards(page)).toHaveCount(3, { timeout: 15_000 });

      await page.goBack();

      await expect(page).toHaveURL(/\/alerts$/);
      await expect(openCard(page, "Corolla híbrido")).toBeVisible({ timeout: 15_000 });
      await expect(desktopCards(page)).toHaveCount(3);
      await expect(page.getByText("Golf TDI")).toHaveCount(0);
    },
  );

  dbTest(
    "ALERTUI-35: at 390×844, /alerts, then Corolla híbrido's page, «Eliminar alerta», «Eliminar», then Back: no 404, and Corolla híbrido is not listed",
    async ({ page }) => {
      await openAda(page, "alertui35-back-page", PHONE_390);
      await expect(phoneCards(page)).toHaveCount(4, { timeout: 15_000 });
      await phoneCards(page).filter({ hasText: "Corolla híbrido" }).click();
      await expect(page).toHaveURL(/\/alerts\/[0-9a-f-]+$/);
      const remove = page.getByRole("button", { name: "Eliminar alerta" });
      await expect(remove).toBeVisible({ timeout: 15_000 });

      await remove.click();
      await page
        .getByRole("alertdialog", { name: "¿Eliminar «Corolla híbrido»?" })
        .getByRole("button", { name: "Eliminar" })
        .click();
      await expect(page).toHaveURL(/\/alerts$/);
      await expect(phoneCards(page)).toHaveCount(3, { timeout: 15_000 });

      await page.goBack();

      await expect(page).toHaveURL(/\/alerts$/);
      await expect(page.getByRole("heading", { level: 1, name: "Alertas" })).toBeVisible({
        timeout: 15_000,
      });
      await expect(phoneCards(page)).toHaveCount(3);
      await expect(page.getByText("Corolla híbrido")).toHaveCount(0);
    },
  );
});

// --- ALERTUI-56: Back to /alerts restores the list column's scroll ---

/** Waits until `column`'s offset holds still between two reads, so its record is written, and returns it. */
async function settledScrollTop(column: Locator): Promise<number> {
  let before = await column.evaluate((element) => element.scrollTop);
  await expect
    .poll(async () => {
      const now = await column.evaluate((element) => element.scrollTop);
      const still = now === before;
      before = now;
      return still;
    })
    .toBe(true);
  return before;
}

dbTest(
  "ALERTUI-56: at 1440×900, with twelve alerts, Back from /map, followed from the header's «Mapa», restores /alerts' list column to the offset it was left at — also after a folded card was pressed",
  async ({ page }) => {
    const email = e2eEmail("alertui56");
    await seedUser(email, PASSWORD);
    await seedAlerts(
      email,
      Array.from({ length: 12 }, (_, index) => ({
        label: `Alerta ${index + 1}`,
        criteria: { brand: "Toyota", maxPrice: 10000 + index * 1000 },
        createdAt: new Date(Date.parse("2026-10-10T10:00:00Z") - index * 3_600_000),
      })),
    );
    await page.setViewportSize(DESKTOP_1440);
    await signIn(page, email, PASSWORD);
    await page.goto("/alerts");
    await waitForSession(page);
    await expect(openCard(page, "Alerta 1")).toBeVisible({ timeout: 15_000 });
    const column = await listColumn(page);
    const list = await box(column);

    await page.mouse.move(list.x + list.width / 2, list.y + list.height / 2);
    await page.mouse.wheel(0, 600);
    await expect.poll(() => column.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    // Let the scroll settle and its record be written.
    let before = await column.evaluate((element) => element.scrollTop);
    await expect
      .poll(async () => {
        const now = await column.evaluate((element) => element.scrollTop);
        const still = now === before;
        before = now;
        return still;
      })
      .toBe(true);
    expect(before).toBeGreaterThan(0);

    await page
      .getByTestId("header-desktop")
      .getByRole("link", { name: /^(mapa|map)$/i })
      .click();
    await expect(page).toHaveURL(/\/map/);
    await page.goBack();
    await expect(page).toHaveURL(/\/alerts$/);
    await expect(openCard(page, "Alerta 1")).toBeVisible({ timeout: 15_000 });

    await expect
      .poll(async () => {
        const top = await (await listColumn(page)).evaluate((element) => element.scrollTop);
        return Math.abs(top - before) <= 1;
      })
      .toBe(true);

    // Scrolled, then a folded card pressed: its new history entry carries the
    // column's offset, so «Mapa» and Back return to it at that offset.
    const restored = await listColumn(page);
    await page.mouse.move(list.x + list.width / 2, list.y + list.height / 2);
    await page.mouse.wheel(0, 200);
    await settledScrollTop(restored);
    await page.getByRole("button", { name: "Alerta 8", exact: true }).click();
    await expect(page).toHaveURL(/\/alerts\?alert=/);
    await expect(openCard(page, "Alerta 8")).toBeVisible({ timeout: 15_000 });
    const pressedUrl = page.url();
    const left = await settledScrollTop(restored);
    expect(left).toBeGreaterThan(0);

    await page
      .getByTestId("header-desktop")
      .getByRole("link", { name: /^(mapa|map)$/i })
      .click();
    await expect(page).toHaveURL(/\/map/);
    await page.goBack();
    await expect(page).toHaveURL(pressedUrl);
    await expect(openCard(page, "Alerta 8")).toBeVisible({ timeout: 15_000 });

    await expect
      .poll(async () => {
        const top = await (await listColumn(page)).evaluate((element) => element.scrollTop);
        return Math.abs(top - left) <= 1;
      })
      .toBe(true);
  },
);

// --- Long text cut to one line (Edge cases › Long text in a chip or a pill) ---

/** An alert whose place name is far longer than a chip or a pill can hold. */
const LONG_PLACE: SeedAlert = {
  label: "Polo norte",
  criteria: {
    brand: "Volkswagen",
    model: "Polo",
    maxPrice: 12000,
    latitude: 40.5474,
    longitude: -3.6261,
    distanceInKm: 50,
  },
  placeName: "San Sebastián de los Reyes, Comunidad de Madrid",
  createdAt: new Date("2026-10-09T10:00:00Z"),
};
const LONG_ZONE = "San Sebastián de los Reyes, Comunidad de Madrid · 50 km";
/** A place name at its 200-character bound (ALERTUI-47): the long one, repeated and cut there. */
const PLACE_200 = (LONG_PLACE.placeName ?? "").repeat(5).slice(0, 200);
const ZONE_200 = `${PLACE_200} · 50 km`;

/** `element` is cut to one line with «…»: its text overflows its box, which ellipsis ends, and the whole text is still in the DOM. */
async function expectCutWithEllipsis(element: Locator, text: string) {
  const measured = await element.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      overflow: style.textOverflow,
      nowrap: style.whiteSpace,
      cut: node.scrollWidth > node.clientWidth,
      text: (node.textContent ?? "").replace(/\s+/g, " "),
    };
  });
  expect(measured.overflow).toBe("ellipsis");
  expect(measured.nowrap).toBe("nowrap");
  expect(measured.cut, "the text is longer than its box").toBe(true);
  expect(measured.text).toContain(text.replace(/\s+/g, " "));
}

test.describe("Long text in a chip or a pill is cut to one line", () => {
  dbTest(
    "ALERTUI-22: at 390×844 a long place name's chip and the zone's pill are cut with «…» inside the content and the zone, never past their right edge",
    async ({ page }) => {
      const email = e2eEmail("alertui-long-phone");
      await seedUser(email, PASSWORD);
      const [alertId] = await seedAlerts(email, [LONG_PLACE]);
      await page.setViewportSize(PHONE_390);
      await signIn(page, email, PASSWORD);
      await page.goto(`/alerts/${alertId}`);
      await waitForSession(page);
      const zone = page.getByRole("region", { name: "Zona de la alerta" });
      await expect(zone).toBeVisible({ timeout: 15_000 });

      const chip = page.locator("main ul li").filter({ hasText: "San Sebastián de los Reyes" });
      await expectCutWithEllipsis(chip, LONG_ZONE);
      const chipBox = await box(chip);
      expect(chipBox.x + chipBox.width).toBeLessThanOrEqual(PHONE_390.width - 20 + 1);

      const pill = zone.getByText(/San Sebastián de los Reyes/);
      await expectCutWithEllipsis(pill, LONG_ZONE);
      const zoneBox = await box(zone);
      const pillBox = await box(pill);
      expectWithin(pillBox.x - zoneBox.x, 18 + 1, "the pill's left inset, border included");
      expect(zoneBox.x + zoneBox.width - (pillBox.x + pillBox.width)).toBeGreaterThanOrEqual(18);
      const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(documentWidth).toBe(PHONE_390.width);
    },
  );

  dbTest(
    "ALERTUI-7 and ALERTUI-15: at 1440×900 a 200-character place name's chip on the open card is cut with «…» inside the card, and the map's pill inside the map",
    async ({ page }) => {
      expect(PLACE_200).toHaveLength(200);
      const email = e2eEmail("alertui-long-desktop");
      await seedUser(email, PASSWORD);
      await seedAlerts(email, [
        {
          ...LONG_PLACE,
          label: "Polo norte con un nombre larguísimo que no cabe en la píldora",
          placeName: PLACE_200,
        },
      ]);
      await page.setViewportSize(DESKTOP_1440);
      await signIn(page, email, PASSWORD);
      await page.goto("/alerts");
      await waitForSession(page);
      const card = openCard(page, "Polo norte con un nombre larguísimo que no cabe en la píldora");
      await expect(card).toBeVisible({ timeout: 15_000 });

      const chip = card.locator("ul li").filter({ hasText: "San Sebastián de los Reyes" });
      await expectCutWithEllipsis(chip, ZONE_200);
      const chipBox = await box(chip);
      const cardBox = await box(card);
      expect(chipBox.x + chipBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width);

      const map = mapRegion(page);
      const pill = map.getByText(/Polo norte con un nombre larguísimo/);
      await expectCutWithEllipsis(
        pill,
        `Polo norte con un nombre larguísimo que no cabe en la píldora · ${ZONE_200}`,
      );
      const mapBox = await box(map);
      const pillBox = await box(pill);
      expect(mapBox.x + mapBox.width - (pillBox.x + pillBox.width)).toBeGreaterThanOrEqual(18 - 1);
    },
  );
});

// --- ALERTUI-37: where the toast sits ---

/**
 * Makes the next delete's Server Action request fail, so `useAlertDelete`'s
 * confirm() throws and shows the "unexpected" toast (ALERTUI-36). Matches the
 * POST the delete sends to the current page's URL, identified by its
 * `next-action` header, and aborts only that one; anything else on the same
 * URL (a prefetch, say) is left alone. Call `unroute` once the toast has
 * appeared.
 */
async function failNextDelete(page: Page): Promise<() => Promise<void>> {
  const url = page.url();
  await page.route(url, async (route) => {
    const request = route.request();
    if (request.method() === "POST" && request.headers()["next-action"]) {
      await route.abort();
    } else {
      await route.continue();
    }
  });
  return () => page.unroute(url);
}

test.describe("ALERTUI-37: the toast's place", () => {
  for (const { viewport, centre } of [
    { viewport: DESKTOP_1440, centre: 415 },
    { viewport: DESKTOP_1024, centre: 273 },
  ]) {
    for (const route of ["/alerts", "/alerts/[id]"] as const) {
      dbTest(
        `ALERTUI-37: on ${route} at ${viewport.width}×${viewport.height} the refused delete's toast sits 12px below the header, centred at x = ${centre}px over the list column`,
        async ({ page }) => {
          await openAda(
            page,
            `alertui37-${route === "/alerts" ? "list" : "page"}-${viewport.width}`,
            viewport,
            (ids) => (route === "/alerts" ? "/alerts" : `/alerts/${ids.corolla}`),
          );
          const opener =
            route === "/alerts"
              ? openCard(page, "Corolla híbrido").getByRole("button", { name: "Eliminar" })
              : page.getByRole("button", { name: "Eliminar alerta" });
          await expect(opener).toBeVisible({ timeout: 15_000 });
          // Only the delete's own request fails: useAlertDelete's confirm() throws and shows the "unexpected" toast.
          const unroute = await failNextDelete(page);
          await opener.click();
          await page
            .getByRole("alertdialog", { name: "¿Eliminar «Corolla híbrido»?" })
            .getByRole("button", { name: "Eliminar" })
            .click();

          await expect(toastBox(page)).toContainText("Algo ha salido mal. Inténtalo de nuevo.");
          await unroute();
          const toast = await settledBox(toastBox(page));
          const head = await box(header(page));
          const list = await box(await listColumn(page));
          expectWithin(toast.y, head.y + head.height + 12, "toast's top");
          expectWithin(toast.x + toast.width / 2, centre, "toast's centre");
          expectWithin(
            toast.x + toast.width / 2,
            list.x + list.width / 2,
            "toast's centre over the list's",
          );
        },
      );
    }
  }

  dbTest(
    "ALERTUI-37: at 390×844 the refused delete's toast sits 12px below the header and 16px from each side",
    async ({ page }) => {
      await openAda(page, "alertui37-phone", PHONE_390, (ids) => `/alerts/${ids.serie3}`);
      const opener = page.getByRole("button", { name: "Eliminar alerta" });
      await expect(opener).toBeVisible({ timeout: 15_000 });
      // Only the delete's own request fails: useAlertDelete's confirm() throws and shows the "unexpected" toast.
      const unroute = await failNextDelete(page);
      await opener.click();
      await page
        .getByRole("alertdialog", { name: "¿Eliminar «Serie 3 diésel»?" })
        .getByRole("button", { name: "Eliminar" })
        .click();

      await expect(toastBox(page)).toContainText("Algo ha salido mal. Inténtalo de nuevo.");
      await unroute();
      const toast = await settledBox(toastBox(page));
      const head = await box(header(page));
      expectWithin(toast.x, 16, "toast's left edge");
      expectWithin(PHONE_390.width - (toast.x + toast.width), 16, "toast's right margin");
      expectWithin(toast.y, head.y + head.height + 12, "toast's top");
    },
  );
});

// --- ALERTUI-29 to ALERTUI-31: the phone match list, 200 matches ---

test.describe("ALERTUI-29 to ALERTUI-31: 200 matches on the phone", () => {
  test.describe.configure({ timeout: 240_000 });

  dbTest(
    "ALERTUI-29: at 390×844 at most 25 rows are mounted at the list's top, middle and end",
    async ({ page }) => {
      await openLongAlert(page, "alertui29", 200, PHONE_390);
      await expect(rows(page).first()).toBeVisible({ timeout: 15_000 });

      const mountedTop = await rows(page).count();
      expect(mountedTop).toBeGreaterThan(0);
      expect(mountedTop).toBeLessThanOrEqual(25);

      await scrollTo(rows(page).first(), "middle");
      await expect(rows(page).filter({ hasText: "Coche 001" })).toHaveCount(0);
      expect(await rows(page).count()).toBeLessThanOrEqual(25);

      await scrollTo(rows(page).first(), "end");
      await expect(rows(page).filter({ hasText: "Coche 200" })).toBeVisible();
      expect(await rows(page).count()).toBeLessThanOrEqual(25);
    },
  );

  dbTest(
    "ALERTUI-30: at 390×844 Back from /map, followed from the tab bar's «Mapa», restores the rows' scroll — the same row is first wholly in view",
    async ({ page }) => {
      await openLongAlert(page, "alertui30", 200, PHONE_390);
      await expect(rows(page).first()).toBeVisible({ timeout: 15_000 });
      await scrollUntilMounted(page, rows(page), "Coche 120");

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

      await tabBarMap.focus();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/map/);
      await page.goBack();
      await expect(page).toHaveURL(/\/alerts\//);

      await expect.poll(() => firstWhollyVisible(rows(page), view)).toBe(before);
    },
  );

  dbTest(
    "ALERTUI-31: at 390×844 Tab goes through the 200 rows in order, then reaches «Eliminar alerta», which scrolls fully clear of the tab bar and opens the confirmation",
    async ({ page }) => {
      await openLongAlert(page, "alertui31", 200, PHONE_390);
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
      await page.keyboard.press("Tab");
      const remove = page.getByRole("button", { name: "Eliminar alerta" });
      await expect(remove).toBeFocused();

      await remove.evaluate((element) => element.scrollIntoView({ block: "end" }));
      await scrollTo(remove, "end");
      // The tab bar hides on scroll-down; a little scroll up at the end brings
      // it back, and «Eliminar alerta» must still sit clear of it. By test id:
      // while hidden it leaves the accessibility tree, and the phone header's
      // nav would answer «Principal» instead.
      await page.mouse.move(PHONE_390.width / 2, PHONE_390.height / 2);
      await page.mouse.wheel(0, -60);
      const bottomNav = page.getByTestId("bottom-nav");
      await expect(bottomNav).toHaveAttribute("aria-hidden", "false");
      await expect(bottomNav).toBeInViewport();
      const tabBar = await settledBox(bottomNav);
      const removeBox = await box(remove);
      expect(removeBox.y + removeBox.height).toBeLessThanOrEqual(tabBar.y);
      await remove.click();
      await expect(
        page.getByRole("alertdialog", { name: "¿Eliminar «Muchos coches»?" }),
      ).toBeVisible();
    },
  );
});

// --- ALERTUI-51 to ALERTUI-55: the desktop match grid, 200 matches ---

test.describe("ALERTUI-51 to ALERTUI-55: 200 matches on desktop", () => {
  test.describe.configure({ timeout: 240_000 });

  dbTest(
    "ALERTUI-51: at 1440×900 at most 30 cards are mounted at the list's top, middle and end",
    async ({ page }) => {
      await openLongAlert(page, "alertui51", 200, DESKTOP_1440);
      await expect(cards(page).first()).toBeVisible({ timeout: 15_000 });

      const mountedTop = await cards(page).count();
      expect(mountedTop).toBeGreaterThan(0);
      expect(mountedTop).toBeLessThanOrEqual(30);

      await scrollTo(cards(page).first(), "middle");
      await expect(cards(page).filter({ hasText: "Coche 001" })).toHaveCount(0);
      expect(await cards(page).count()).toBeLessThanOrEqual(30);

      await scrollTo(cards(page).first(), "end");
      await expect(cards(page).filter({ hasText: "Coche 200" })).toBeVisible();
      expect(await cards(page).count()).toBeLessThanOrEqual(30);
    },
  );

  dbTest(
    "ALERTUI-52: at 1440×900, from the list's top, the 150th match's pin mounts its card, scrolls it wholly into view, outlines it and opens its preview",
    async ({ page }) => {
      await openLongAlert(page, "alertui52", 200, DESKTOP_1440);
      await expect(cards(page).first()).toBeVisible({ timeout: 15_000 });
      await expect(cards(page).filter({ hasText: "Coche 150" })).toHaveCount(0);

      const pin = page.getByRole("button", { name: /^Coche 150, / });
      await pin.focus();
      await page.keyboard.press("Enter");

      const target = cards(page).filter({ hasText: "Coche 150" });
      await expect(target).toHaveCount(1);
      await expect(target).toHaveAttribute("data-active", "true");
      const column = await listColumn(page);
      await expect.poll(async () => wholly(await box(target), await box(column))).toBe(true);
      const preview = page.getByRole("article", { name: "Vista previa del coche" });
      await expect(preview).toBeVisible();
      await expect(preview).toContainText("Coche 150");
    },
  );

  dbTest(
    "ALERTUI-53: at 1440×900 Back from /map, followed from the header's «Mapa», restores the list's scroll — the same card is first wholly in view",
    async ({ page }) => {
      await openLongAlert(page, "alertui53", 200, DESKTOP_1440);
      await expect(cards(page).first()).toBeVisible({ timeout: 15_000 });
      await scrollUntilMounted(page, cards(page), "Coche 120");
      const view = await box(await listColumn(page));
      const before = await firstWhollyVisible(cards(page), view);
      expect(before).not.toBe("Coche 001");

      await page
        .getByTestId("header-desktop")
        .getByRole("link", { name: /^(mapa|map)$/i })
        .click();
      await expect(page).toHaveURL(/\/map/);
      await page.goBack();
      await expect(page).toHaveURL(/\/alerts\//);

      await expect
        .poll(async () => firstWhollyVisible(cards(page), await box(await listColumn(page))))
        .toBe(before);
    },
  );

  dbTest(
    "ALERTUI-54: at 1440×900 Tab from «Volver» goes through each card's link and heart in order, to the 200th card's heart, each wholly in view, then «Eliminar alerta»",
    async ({ page }) => {
      await openLongAlert(page, "alertui54", 200, DESKTOP_1440);
      await expect(cards(page).first()).toBeVisible({ timeout: 15_000 });
      await (await listColumn(page)).getByRole("link", { name: "Volver" }).focus();

      for (let n = 1; n <= 200; n++) {
        for (const kind of ["link", "heart"] as const) {
          await page.keyboard.press("Tab");
          const focused = await page.evaluate(() => {
            const active = document.activeElement as HTMLElement | null;
            const article = active?.closest("article");
            const list = document.querySelector<HTMLElement>("[data-e2e-list-column]");
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
          else expect(focused.label, where).toBe("Guardar");
          expect(focused.inView, `${where}: the card is wholly in the list's view`).toBe(true);
        }
      }
      await page.keyboard.press("Tab");
      await expect(page.getByRole("button", { name: "Eliminar alerta" })).toBeFocused();
    },
  );

  dbTest(
    "ALERTUI-55: at 1440×900 the 150th card's heart saves it and saves no other, keeping 149, 150, 151 and 200 pins; pressing it again removes it; no car twice",
    async ({ page }) => {
      const { email } = await openLongAlert(page, "alertui55", 200, DESKTOP_1440);
      await expect(cards(page).first()).toBeVisible({ timeout: 15_000 });
      const target = await scrollUntilMounted(page, cards(page), "Coche 150");
      const pins = page.locator(".leaflet-marker-icon");
      await expect(pins).toHaveCount(200);

      await target.getByRole("button", { name: "Guardar" }).click();

      await expect(target.getByRole("button", { name: "Quitar de guardados" })).toBeVisible();
      await expect.poll(() => favoriteCount(email), { timeout: 15_000 }).toBe(1);
      await expect(pins).toHaveCount(200);
      await expectNeighbours(cards(page), ["Coche 149", "Coche 150", "Coche 151"]);
      await expectEachCarOnce(cards(page), ["Guardar", "Quitar de guardados"]);
      await expect(
        cards(page).filter({ hasText: "Coche 149" }).getByRole("button", { name: "Guardar" }),
      ).toBeVisible();
      await expect(
        cards(page).filter({ hasText: "Coche 151" }).getByRole("button", { name: "Guardar" }),
      ).toBeVisible();

      await target.getByRole("button", { name: "Quitar de guardados" }).click();

      await expect(target.getByRole("button", { name: "Guardar" })).toBeVisible();
      await expect.poll(() => favoriteCount(email), { timeout: 15_000 }).toBe(0);
      await expect(pins).toHaveCount(200);
      await expectNeighbours(cards(page), ["Coche 149", "Coche 150", "Coche 151"]);
      await expectEachCarOnce(cards(page), ["Guardar", "Quitar de guardados"]);
    },
  );
});
