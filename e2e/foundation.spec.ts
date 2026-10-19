import { test, expect, type Locator, type Page } from "@playwright/test";
import { mockListingSources } from "./fixtures/network";
import { e2eEmail, seedUser } from "./fixtures/db";
import { stubMapTiles } from "./fixtures/map-tiles";

// docs/specs/map-maplibre.md: no run reaches OpenFreeMap — a page that opens
// a map draws it from stubbed tiles (e2e/fixtures/map-tiles.ts).
test.beforeEach(async ({ page }) => {
  await stubMapTiles(page);
});

// docs/specs/redesign-foundation.md (Key LOOK, Approved). jsdom computes no
// styles from app/globals.css, so the primitives' real look can only be
// proven in a browser (Decisions and rationale: "A style guide as the e2e
// harness") — /palette renders every primitive and token for LOOK-9..14 to
// measure. LOOK-1/2/6/8/15/19/20/21 (no browser needed) are
// scripts/redesign-foundation.node.test.ts; LOOK-16 is components/
// Footer.test.tsx. LOOK-5 and LOOK-18 belong to a concurrently edited file
// and are not here.
//
// The /palette test-id contract this file assumes (none of it exists yet —
// every test below is red against the current page):
//   Buttons (data-testid → expected computed height in px):
//     btn-display 56, btn-primary-54 54, btn-primary-52 52, btn-primary-48 48,
//     btn-primary-42 42, btn-secondary-48 48, btn-secondary-44 44, btn-ghost
//     (any), btn-undo ("Quitar filtros") 48, btn-danger 44, btn-icon (42x42),
//     btn-icon-40 (40x40).
//   Chips: chip-pressed ("Todos"), chip-unpressed ("Diésel").
//   Fields: field-input (an <input>), field-checkbox-select-trigger (the
//     checkbox select's trigger).
//   Toast: a button toast-demo that shows a toast "Guardado en tus coches."
//     with action "Deshacer" and a close button named "Cerrar aviso" ("Close notice" in English, SAVED-36 — the
//     Playwright context negotiates en-US by default).

const dbTest = process.env.E2E_DB ? test : test.skip;
// Clears all three password layers (length, strength, breach corpus) — the
// same value e2e/favorites.spec.ts uses, deliberately duplicated rather than
// imported (see this file's own header note on not coupling spec files).
const PASSWORD = "harbour-lentil-quilt-97";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/email|correo/i).fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /sign in|entrar/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
}

/** LOOK-3's four checks, reused by LOOK-3 and LOOK-4. */
async function expectDarkTheme(page: Page) {
  await expect(page.locator("html")).toHaveClass(/dark/);

  const colorScheme = await page.locator("html").evaluate((el) => getComputedStyle(el).colorScheme);
  expect(colorScheme).toBe("dark");

  const backgroundColor = await page
    .locator("body")
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(backgroundColor).toBe("rgb(15, 15, 16)");

  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#0F0F10");
}

/** Presses Tab from wherever focus currently is until `testId` is focused. */
async function tabUntilFocused(page: Page, testId: string, maxPresses = 50) {
  for (let presses = 0; presses < maxPresses; presses++) {
    const isFocused = await page.evaluate(
      (id) => document.activeElement?.getAttribute("data-testid") === id,
      testId,
    );
    if (isFocused) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`Could not reach [data-testid="${testId}"] by pressing Tab`);
}

/**
 * Paints a computed CSS colour onto a 1x1 canvas and reads it back as
 * [r, g, b, a] (0-255), so a colour Chromium serialises as oklab() or color()
 * compares numerically against the design's sRGB value.
 */
async function colorToRgba(page: Page, value: string): Promise<number[]> {
  return page.evaluate((colour) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No 2d canvas context");
    ctx.fillStyle = colour;
    ctx.fillRect(0, 0, 1, 1);
    return [...ctx.getImageData(0, 0, 1, 1).data];
  }, value);
}

async function computed(locator: Locator, props: string[]): Promise<Record<string, string>> {
  return locator.evaluate((el, keys) => {
    const style = getComputedStyle(el);
    const out: Record<string, string> = {};
    for (const key of keys) out[key] = style.getPropertyValue(key);
    return out;
  }, props);
}

test.describe("LOOK-3: every page renders in the dark theme", () => {
  test("LOOK-3: / renders dark", async ({ page }) => {
    await page.goto("/");
    await expectDarkTheme(page);
  });

  test("LOOK-3: /login renders dark", async ({ page }) => {
    await page.goto("/login");
    await expectDarkTheme(page);
  });

  test("LOOK-3: /map renders dark", async ({ page }) => {
    await mockListingSources(page);
    await page.goto("/map");
    await expectDarkTheme(page);
  });
});

test("LOOK-4: a stale theme=light in localStorage from an earlier version is ignored", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("theme", "light"));
  await page.goto("/");
  await expectDarkTheme(page);
});

test("LOOK-7: the fonts in use are Rethink Sans and Unbounded", async ({ page }) => {
  await page.goto("/");

  const firstFamily = await page
    .locator("body")
    .evaluate((el) =>
      (getComputedStyle(el).fontFamily.split(",")[0] ?? "").trim().replace(/["']/g, ""),
    );
  expect(firstFamily).toMatch(/rethink/i);

  const firstFamilyLoaded = await page.evaluate(async (first) => {
    await document.fonts.ready;
    return [...document.fonts].some(
      (face) => face.family.replace(/["']/g, "") === first && face.status === "loaded",
    );
  }, firstFamily);
  expect(firstFamilyLoaded).toBe(true);

  const displayFamily = await page.evaluate(() =>
    (
      getComputedStyle(document.documentElement).getPropertyValue("--font-display").split(",")[0] ??
      ""
    )
      .trim()
      .replace(/["']/g, ""),
  );
  expect(displayFamily).toMatch(/unbounded/i);

  // Load the registered Unbounded face by its exact family, whether or not / has fetched it yet,
  // and check it resolves. Only that face: next/font also registers an "unbounded Fallback" face
  // whose src is local(Arial), which rejects with a NetworkError where Arial is not installed.
  const unboundedLoaded = await page.evaluate(async (display) => {
    await document.fonts.ready;
    const faces = [...document.fonts].filter(
      (face) => face.family.replace(/["']/g, "") === display,
    );
    if (faces.length === 0) return false;
    const loaded = await Promise.all(faces.map((face) => face.load()));
    return loaded.every((face) => face.status === "loaded");
  }, displayFamily);
  expect(unboundedLoaded).toBe(true);
});

test.describe("LOOK-9: /palette button variants match the design", () => {
  test("LOOK-9: primary, secondary, ghost and danger compute to the design's colours", async ({
    page,
  }) => {
    await page.goto("/palette");

    const primaryButtons = [
      "btn-display",
      "btn-primary-54",
      "btn-primary-52",
      "btn-primary-48",
      "btn-primary-42",
    ];
    for (const testId of primaryButtons) {
      const style = await computed(page.getByTestId(testId), ["background-color", "color"]);
      expect(style["background-color"], testId).toBe("rgb(198, 255, 61)");
      expect(style.color, testId).toBe("rgb(15, 15, 16)");
    }

    for (const testId of ["btn-secondary-48", "btn-secondary-44"]) {
      const style = await computed(page.getByTestId(testId), [
        "border-style",
        "border-width",
        "border-color",
      ]);
      expect(style["border-style"], testId).toBe("solid");
      expect(style["border-width"], testId).toBe("1px");
      expect(style["border-color"], testId).toBe("rgb(42, 42, 46)");
    }

    const ghostStyle = await computed(page.getByTestId("btn-ghost"), [
      "border-width",
      "background-color",
    ]);
    expect(["0px", "transparent"]).toContain(ghostStyle["border-width"]);
    expect(ghostStyle["background-color"]).toBe("rgba(0, 0, 0, 0)");

    const dangerStyle = await computed(page.getByTestId("btn-danger"), ["color", "border-color"]);
    expect(dangerStyle.color).toBe("rgb(255, 92, 92)");
    const [red, green, blue, alpha] = await colorToRgba(page, dangerStyle["border-color"] ?? "");
    expect(Math.abs((red ?? 0) - 255)).toBeLessThanOrEqual(1);
    expect(Math.abs((green ?? 0) - 92)).toBeLessThanOrEqual(1);
    expect(Math.abs((blue ?? 0) - 92)).toBeLessThanOrEqual(1);
    expect(Math.abs((alpha ?? 0) - 153)).toBeLessThanOrEqual(2);
  });

  test("LOOK-9: every btn-* is pill-shaped at the design's height, and no label wraps", async ({
    page,
  }) => {
    await page.goto("/palette");

    const heights: Record<string, number> = {
      "btn-display": 56,
      "btn-primary-54": 54,
      "btn-primary-52": 52,
      "btn-primary-48": 48,
      "btn-primary-42": 42,
      "btn-secondary-48": 48,
      "btn-secondary-44": 44,
      "btn-undo": 48,
      "btn-danger": 44,
    };

    for (const [testId, expectedHeight] of Object.entries(heights)) {
      const button = page.getByTestId(testId);
      const box = await button.boundingBox();
      expect(box, testId).not.toBeNull();
      expect(box?.height ?? 0, testId).toBeGreaterThanOrEqual(expectedHeight - 0.5);
      expect(box?.height ?? 0, testId).toBeLessThanOrEqual(expectedHeight + 0.5);

      const metrics = await button.evaluate((el) => ({
        borderRadius: Number.parseFloat(getComputedStyle(el).borderRadius),
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
      }));
      expect(metrics.borderRadius, testId).toBeGreaterThanOrEqual((box?.height ?? 0) / 2);
      // A wrapped label grows scrollHeight past clientHeight's single line.
      expect(metrics.scrollHeight, testId).toBeLessThanOrEqual(metrics.clientHeight);
    }

    for (const [testId, size] of Object.entries({ "btn-icon": 42, "btn-icon-40": 40 })) {
      const box = await page.getByTestId(testId).boundingBox();
      expect(box?.width, testId).toBeCloseTo(size, 0);
      expect(box?.height, testId).toBeCloseTo(size, 0);
    }
  });

  test("LOOK-9: the 42px and 40px buttons keep a 44x44 hit area at phone width without changing their drawn size", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/palette");

    const drawnSize: Record<string, number> = {
      "btn-primary-42": 42,
      "btn-icon": 42,
      "btn-icon-40": 40,
    };
    for (const [testId, size] of Object.entries(drawnSize)) {
      const box = await page.getByTestId(testId).boundingBox();
      expect(box, testId).not.toBeNull();
      if (!box) continue;

      // Only the icon buttons are square; btn-primary-42's width is its label's.
      if (testId !== "btn-primary-42") expect(box.width, testId).toBeCloseTo(size, 0);
      expect(box.height, testId).toBeCloseTo(size, 0);

      const centreX = box.x + box.width / 2;
      const centreY = box.y + box.height / 2;
      for (const dx of [-21.5, 21.5]) {
        for (const dy of [-21.5, 21.5]) {
          const hitsButton = await page.evaluate(
            ({ x, y, id }) =>
              document.elementFromPoint(x, y)?.closest(`[data-testid="${id}"]`) != null,
            { x: centreX + dx, y: centreY + dy, id: testId },
          );
          expect(hitsButton, `${testId} at offset ${dx},${dy}`).toBe(true);
        }
      }
    }
  });
});

test("LOOK-10: the undo ghost button turns danger on hover and on keyboard focus, and back to text otherwise", async ({
  page,
}) => {
  await page.goto("/palette");
  const undo = page.getByTestId("btn-undo");

  expect(await undo.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(244, 242, 240)");

  await undo.hover();
  expect(await undo.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(255, 92, 92)");

  await page.mouse.move(0, 0);
  expect(await undo.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(244, 242, 240)");

  await tabUntilFocused(page, "btn-undo");
  expect(await undo.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(255, 92, 92)");
});

test("LOOK-11/MAPUI-48: keyboard focus shows a 2px lime outline offset by 3px on every primitive, including the checkbox select that replaces the Radix select", async ({
  page,
}) => {
  await page.goto("/palette");

  for (const testId of [
    "btn-primary-54",
    "chip-unpressed",
    "field-input",
    "field-checkbox-select-trigger",
  ]) {
    await tabUntilFocused(page, testId);
    const outline = await page.getByTestId(testId).evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        outlineColor: style.outlineColor,
        outlineOffset: style.outlineOffset,
      };
    });
    expect(outline.outlineStyle, testId).toBe("solid");
    expect(outline.outlineWidth, testId).toBe("2px");
    expect(outline.outlineColor, testId).toBe("rgb(198, 255, 61)");
    expect(outline.outlineOffset, testId).toBe("3px");
  }
});

test("LOOK-12: a pressed toggle chip differs from an unpressed one in fill and weight, not colour alone", async ({
  page,
}) => {
  await page.goto("/palette");

  const pressed = page.getByTestId("chip-pressed");
  await expect(pressed).toHaveAttribute("aria-pressed", "true");
  const pressedStyle = await pressed.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      backgroundColor: style.backgroundColor,
      color: style.color,
      fontWeight: style.fontWeight,
    };
  });
  expect(pressedStyle.backgroundColor).toBe("rgb(124, 77, 255)");
  expect(pressedStyle.color).toBe("rgb(250, 249, 248)");
  expect(pressedStyle.fontWeight).toBe("800");

  const unpressed = page.getByTestId("chip-unpressed");
  await expect(unpressed).toHaveAttribute("aria-pressed", "false");
  const unpressedStyle = await unpressed.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      borderWidth: style.borderWidth,
      borderColor: style.borderColor,
      fontWeight: style.fontWeight,
    };
  });
  expect(unpressedStyle.borderWidth).toBe("1px");
  expect(unpressedStyle.borderColor).toBe("rgb(42, 42, 46)");
  expect(unpressedStyle.fontWeight).toBe("600");
});

test("LOOK-13/MAPUI-48: inputs and the checkbox select trigger are at least 52px tall with a 16px font, a line border at rest and a lime border focused", async ({
  page,
}) => {
  await page.goto("/palette");

  for (const testId of ["field-input", "field-checkbox-select-trigger"]) {
    const field = page.getByTestId(testId);
    const box = await field.boundingBox();
    expect(box?.height ?? 0, testId).toBeGreaterThanOrEqual(52);

    const restStyle = await field.evaluate((el) => {
      const style = getComputedStyle(el);
      return { fontSize: style.fontSize, borderColor: style.borderColor };
    });
    expect(restStyle.fontSize, testId).toBe("16px");
    expect(restStyle.borderColor, testId).toBe("rgb(42, 42, 46)");

    // The border turns lime within the 120ms state transition (LOOK-13, MOTION-3).
    await field.focus();
    await expect
      .poll(async () => field.evaluate((el) => getComputedStyle(el).borderColor), {
        message: testId,
        timeout: 300,
        intervals: [20],
      })
      .toBe("rgb(198, 255, 61)");
  }
});

test("LOOK-14: a toast renders on surface with a line border, radius-card, shadow-float, text colour, a lime action and a named close button", async ({
  page,
}) => {
  await page.goto("/palette");
  await page.getByTestId("toast-demo").click();

  const toast = page.locator("[data-sonner-toast]").first();
  await expect(toast).toBeVisible();
  await expect(toast).toContainText("Guardado en tus coches.");

  const style = await toast.evaluate((el) => {
    const computedStyle = getComputedStyle(el);
    return {
      backgroundColor: computedStyle.backgroundColor,
      borderColor: computedStyle.borderColor,
      color: computedStyle.color,
      borderRadius: computedStyle.borderRadius,
      boxShadow: computedStyle.boxShadow,
    };
  });
  expect(style.backgroundColor).toBe("rgb(24, 24, 27)");
  expect(style.borderColor).toBe("rgb(42, 42, 46)");
  expect(style.color).toBe("rgb(244, 242, 240)");
  expect(style.borderRadius).toBe("22px");
  expect(style.boxShadow).toContain("rgba(0, 0, 0, 0.55)");
  expect(style.boxShadow).toContain("24px 50px");

  const undoAction = toast.getByRole("button", { name: "Deshacer" });
  await expect(undoAction).toBeVisible();
  expect(await undoAction.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(198, 255, 61)");

  await expect(toast.getByRole("button", { name: /^(cerrar aviso|close notice)$/i })).toBeVisible();
});

test.describe("LOOK-17: the footer is present only on the pages the design names", () => {
  for (const path of ["/", "/login", "/register", "/privacy", "/terms"]) {
    test(`LOOK-17: the footer is visible on ${path} at desktop width`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(path);
      const footer = page.getByRole("contentinfo");
      await expect(footer).toBeVisible();
      await expect(footer.getByRole("link", { name: /privacidad|privacy/i })).toBeVisible();
    });
  }

  test("LOOK-17: there is no footer on / or /login at phone width", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    await page.goto("/");
    await expect(page.getByRole("contentinfo")).toHaveCount(0);

    await page.goto("/login");
    await expect(page.getByRole("contentinfo")).toHaveCount(0);
  });

  test("LOOK-17: the footer is absent on /map", async ({ page }) => {
    await mockListingSources(page);
    await page.goto("/map");
    await expect(page.getByRole("contentinfo")).toHaveCount(0);
  });

  dbTest("LOOK-17: the footer is absent on /favorites and /alerts", async ({ page }) => {
    const email = e2eEmail("look17-footer");
    await seedUser(email, PASSWORD);
    await signIn(page, email);

    await page.goto("/favorites");
    await expect(page.getByRole("contentinfo")).toHaveCount(0);

    await page.goto("/alerts");
    await expect(page.getByRole("contentinfo")).toHaveCount(0);
  });
});

// docs/specs/motion.md (Key MOTION, Approved). jsdom computes no transitions
// from app/globals.css, so the state timing (MOTION-1) and the hover/press
// behaviour it drives (MOTION-4, MOTION-7) can only be measured here, on
// /palette's stable primitives — the same reasoning LOOK-9..14 above already
// follow for colour and size.
test("MOTION-3: a button and an input compute the 120ms state transition with the ease-out curve", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/palette");

  for (const testId of ["btn-secondary-48", "field-input"]) {
    const style = await computed(page.getByTestId(testId), [
      "transition-duration",
      "transition-timing-function",
    ]);
    expect(style["transition-duration"], testId).toBe("0.12s");
    expect(style["transition-timing-function"], testId).toBe("cubic-bezier(0.23, 1, 0.32, 1)");
  }
});

test("MOTION-7: a secondary button's hover border and press scale move in the state transition, and reduced motion drops the press scale", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/palette");
  const button = page.getByTestId("btn-secondary-48");

  expect(await button.evaluate((el) => getComputedStyle(el).borderColor)).toBe("rgb(42, 42, 46)");

  await button.hover();
  await expect
    .poll(async () => button.evaluate((el) => getComputedStyle(el).borderColor), { timeout: 200 })
    .toBe("rgb(163, 160, 166)");

  const box = await button.boundingBox();
  if (!box) throw new Error("btn-secondary-48 did not lay out");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect
    .poll(async () => button.evaluate((el) => getComputedStyle(el).scale), {
      timeout: 300,
      intervals: [20],
    })
    .toMatch(/^0\.97( 0\.97)?$/);
  await page.mouse.up();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(200);
  expect(await button.evaluate((el) => getComputedStyle(el).scale)).toBe("none");
  await page.mouse.up();
});

// docs/specs/motion.md (MOTION-5): the hover border of a field and of the
// select trigger applies only while they are not focused, so a focused one
// keeps its lime border under the pointer.
test("MOTION-5: at 1440×900 a focused field input and a focused checkbox select trigger keep their lime border while hovered", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/palette");

  for (const testId of ["field-input", "field-checkbox-select-trigger"]) {
    const field = page.getByTestId(testId);
    await field.focus();
    await expect
      .poll(async () => field.evaluate((el) => getComputedStyle(el).borderColor), {
        message: testId,
        timeout: 300,
        intervals: [20],
      })
      .toBe("rgb(198, 255, 61)");

    await field.hover();
    // Longer than the 120ms state transition: a hover border would have landed.
    await page.waitForTimeout(250);

    expect(await field.evaluate((el) => getComputedStyle(el).borderColor), testId).toBe(
      "rgb(198, 255, 61)",
    );
  }
});
