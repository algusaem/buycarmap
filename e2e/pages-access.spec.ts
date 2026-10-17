import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { box, expectWithin, hitArea } from "./fixtures/measure";

// docs/specs/redesign-pages.md (PAGES-7, PAGES-8, PAGES-70, PAGES-75). These
// four need no database (Contracts › Tests, also noted in
// e2e/pages-legal.spec.ts's header comment): the access pages
// (/register, /verify-email, /confirm-email, /forgot-password,
// /reset-password) are public, so none of this file signs anyone in.
//
// Playwright negotiates "en-US" by default (no locale cookie is forced
// anywhere in this repo's e2e suite, per e2e/landing.spec.ts's own note), so
// every page here is forced to Spanish — the language the boards and the
// acceptance criteria actually draw copy in — with `test.use({ locale:
// "es-ES" })`. That changes `Accept-Language`, which `i18n/request.ts`
// negotiates from.
test.use({ locale: "es-ES" });

const DESKTOP_1440 = { width: 1440, height: 900 };
const LAPTOP_1024 = { width: 1024, height: 900 };
const PHONE_390 = { width: 390, height: 844 };

// A fabricated token: /verify-email, /confirm-email and /reset-password
// read only whether a token is present (PAGES-14) — never its validity —
// before any button is pressed, so this is enough to reach the
// token-present composition without a database.
const TOKEN = "e2e-layout-token";

/** The centre x of the scrolling container (`main`), in viewport coordinates — e2e/landing.spec.ts's helper, duplicated rather than imported across spec files (that file's own stated convention). */
async function scrollContainerCenterX(page: Page): Promise<number> {
  return page.locator("main").evaluate((main) => {
    const rect = main.getBoundingClientRect();
    return rect.x + rect.width / 2;
  });
}

test.describe("PAGES-7: /register's layout by viewport", () => {
  test("PAGES-7: at 1440×900, two columns — the headline left of the panel, the illustration at most 620px wide, and «o» and the arrow visible", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP_1440);
    await page.goto("/register");

    const headline = page.getByRole("heading", { level: 1 });
    await expect(headline).toBeVisible();
    const headlineBox = await box(headline);
    const panelBox = await box(page.locator("form").first());
    expect(
      headlineBox.x + headlineBox.width,
      "headline wholly left of the panel",
    ).toBeLessThanOrEqual(panelBox.x);

    const illustration = page.locator('img[src*="/illus/"]:visible').first();
    await expect(illustration).toBeVisible();
    const illustrationBox = await box(illustration);
    expect(illustrationBox.width, "illustration at most 620px wide").toBeLessThanOrEqual(621);

    await expect(page.getByText(/^o$/)).toBeVisible();
    // The arrow from the headline to the «o» (AccessLayout.tsx's AccessArrow).
    await expect(page.locator("[data-access-arrow]")).toBeVisible();

    // ENTRY-28's rule: the headline, the line and the illustration's drawn
    // content (its box is as tall as what is drawn) centred as one group on
    // the panel, the form's own parent.
    const line = await box(
      page.getByText("Recibir alertas es gratis, regístrate y nos encargamos del resto."),
    );
    const drawn = await box(page.locator("[data-art-layer]"));
    const panel = await box(page.locator("form").first().locator("xpath=.."));
    const top = Math.min(headlineBox.y, line.y, drawn.y);
    const bottom = Math.max(
      headlineBox.y + headlineBox.height,
      line.y + line.height,
      drawn.y + drawn.height,
    );
    expect(
      Math.abs((top + bottom) / 2 - (panel.y + panel.height / 2)),
      "left block centre vs. panel centre",
    ).toBeLessThanOrEqual(2);

    // ENTRY-26's conditions: scrolled to the end, the drawn content is wholly
    // inside the viewport and every clipping ancestor, and above the footer.
    await page
      .locator("main")
      .locator("xpath=..")
      .evaluate((scroller) => {
        scroller.scrollTop = scroller.scrollHeight;
      });
    const scrolled = await box(page.locator("[data-art-layer]"));
    expect(scrolled.x, "drawn content inside the viewport (left)").toBeGreaterThanOrEqual(0);
    expect(scrolled.y, "drawn content inside the viewport (top)").toBeGreaterThanOrEqual(0);
    expect(scrolled.x + scrolled.width, "inside the viewport (right)").toBeLessThanOrEqual(1440);
    expect(scrolled.y + scrolled.height, "inside the viewport (bottom)").toBeLessThanOrEqual(900);
    const clipping = await page.locator("[data-art-layer]").evaluate((element) => {
      const boxes: { left: number; top: number; right: number; bottom: number }[] = [];
      for (let node = element.parentElement; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.overflowX === "visible" && style.overflowY === "visible") continue;
        const rect = node.getBoundingClientRect();
        boxes.push({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom });
      }
      return boxes;
    });
    for (const ancestor of clipping) {
      expect(scrolled.x, "inside a clipping ancestor (left)").toBeGreaterThanOrEqual(ancestor.left);
      expect(scrolled.y, "inside a clipping ancestor (top)").toBeGreaterThanOrEqual(ancestor.top);
      expect(scrolled.x + scrolled.width, "inside a clipping ancestor (right)").toBeLessThanOrEqual(
        ancestor.right,
      );
      expect(
        scrolled.y + scrolled.height,
        "inside a clipping ancestor (bottom)",
      ).toBeLessThanOrEqual(ancestor.bottom);
    }
    const footer = await box(page.locator("footer"));
    expect(scrolled.y + scrolled.height, "drawn content above the footer").toBeLessThanOrEqual(
      footer.y,
    );
  });

  test("PAGES-7: at 1024×900, one centred 440px column with no panel, no arrow and no illustration", async ({
    page,
  }) => {
    await page.setViewportSize(LAPTOP_1024);
    await page.goto("/register");

    const centerX = await scrollContainerCenterX(page);
    const email = page.locator("#email");
    await expect(email).toBeVisible();
    const column = await box(page.locator("form").first());
    expectWithin(column.width, 440, "column width at 1024px");
    expectWithin(column.x + column.width / 2, centerX, "column horizontally centred");

    await expect(page.locator('img[src*="/illus/"]:visible')).toHaveCount(0);
    const borderWidth = await page
      .locator("form")
      .first()
      .evaluate((form) => {
        const panel = form.parentElement;
        return panel ? getComputedStyle(panel).borderWidth : null;
      });
    expect(borderWidth, "no panel border at 1024px").toBe("0px");
  });

  test("PAGES-7: at 390×844, the phone composition — no panel and no illustration", async ({
    page,
  }) => {
    await page.setViewportSize(PHONE_390);
    await page.goto("/register");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator('img[src*="/illus/"]:visible')).toHaveCount(0);
    const borderWidth = await page
      .locator("form")
      .first()
      .evaluate((form) => {
        const panel = form.parentElement;
        return panel ? getComputedStyle(panel).borderWidth : null;
      });
    expect(borderWidth, "no panel border on the phone").toBe("0px");
  });
});

test.describe("PAGES-8: every control on the access pages has a 44×44px hit area, at 390×844", () => {
  test("PAGES-8: the password field's eye button, «Crear cuenta» and the legal notice's links", async ({
    page,
  }) => {
    await page.setViewportSize(PHONE_390);
    await page.goto("/register");

    const eye = page.getByRole("button", { name: /mostrar contraseña/i }).first();
    const submit = page.getByRole("button", { name: "Crear cuenta" });
    const terms = page.getByRole("link", { name: "Términos" });
    const privacy = page.getByRole("link", { name: "Privacidad" });

    for (const control of [eye, submit, terms, privacy]) {
      const size = await hitArea(control);
      expect(size.width, "hit width ≥ 44px").toBeGreaterThanOrEqual(44);
      expect(size.height, "hit height ≥ 44px").toBeGreaterThanOrEqual(44);
    }
  });

  const OTHER_CONTROLS = [
    {
      path: "/register",
      controls: (page: Page) => [
        page.getByRole("link", { name: "Entra" }),
        page.getByRole("button", { name: /mostrar contraseña/i }).nth(1),
      ],
    },
    {
      path: "/forgot-password",
      controls: (page: Page) => [
        page.getByRole("link", { name: "Volver a entrar" }),
        page.getByRole("button", { name: "Enviar enlace" }),
      ],
    },
    {
      path: "/verify-email",
      controls: (page: Page) => [
        page.getByRole("link", { name: "Volver al registro" }),
        page.getByRole("main").getByRole("link", { name: "Entrar", exact: true }),
      ],
    },
    {
      path: `/reset-password?token=${TOKEN}`,
      controls: (page: Page) => [
        page.getByRole("button", { name: /mostrar contraseña/i }).nth(0),
        page.getByRole("button", { name: /mostrar contraseña/i }).nth(1),
        page.getByRole("button", { name: "Guardar contraseña" }),
      ],
    },
  ];

  for (const { path, controls } of OTHER_CONTROLS) {
    test(`PAGES-8: ${path}'s controls`, async ({ page }) => {
      await page.setViewportSize(PHONE_390);
      await page.goto(path);

      for (const control of controls(page)) {
        await expect(control).toBeVisible();
        const size = await hitArea(control);
        expect(size.width, "hit width ≥ 44px").toBeGreaterThanOrEqual(44);
        expect(size.height, "hit height ≥ 44px").toBeGreaterThanOrEqual(44);
      }
    });
  }
});

test.describe("PAGES-75: the laptop-width pages take /register's 1024 column", () => {
  const ROUTES = [
    { path: `/verify-email?token=${TOKEN}`, submit: "Confirmar mi cuenta" },
    { path: `/reset-password?token=${TOKEN}`, submit: "Guardar contraseña" },
    { path: `/confirm-email?token=${TOKEN}`, submit: "Confirmar esta dirección" },
    { path: "/forgot-password", submit: "Enviar enlace" },
  ];

  for (const viewport of [LAPTOP_1024, { width: 1300, height: 900 }]) {
    for (const { path, submit } of ROUTES) {
      test(`PAGES-75: ${path} at ${viewport.width}×${viewport.height} is one centred 440px column with no panel and no illustration`, async ({
        page,
      }) => {
        await page.setViewportSize(viewport);
        await page.goto(path);

        const centerX = await scrollContainerCenterX(page);
        const action = page.getByRole("button", { name: submit });
        await expect(action).toBeVisible();
        // The column holds the form or the actions (PAGES-75): /verify-email and
        // /confirm-email draw a button, not a form.
        const column = await box(page.locator("main > div").first());
        expectWithin(column.width, 440, `column width at ${viewport.width}px`);
        expectWithin(
          column.x + column.width / 2,
          centerX,
          `column horizontally centred at ${viewport.width}px`,
        );
        await expect(page.locator('img[src*="/illus/"]:visible')).toHaveCount(0);
      });
    }
  }
});

// e2e/a11y.spec.ts's own helper, duplicated here rather than exported and
// imported across spec files — the same convention e2e/pages-legal.spec.ts
// already follows for its signIn() helper.
async function seriousViolations(page: Page) {
  await page.waitForFunction(
    () =>
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
        .every((animation) => animation.playState !== "running") &&
      Array.from(
        document.querySelectorAll<HTMLElement>("[style*='opacity']:not([data-radix-focus-guard])"),
      ).every((element) => {
        const opacity = Number.parseFloat(element.style.opacity);
        return Number.isNaN(opacity) || opacity === 1;
      }),
  );
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations.filter((v) => v.impact === "serious" || v.impact === "critical");
}

function expectNoSeriousViolations(violations: Awaited<ReturnType<typeof seriousViolations>>) {
  expect(violations, violations.map((v) => `${v.id}: ${v.help}`).join("\n")).toEqual([]);
}

test.describe("PAGES-70: axe on the access, legal and not-found pages, no serious or critical violation", () => {
  const ROUTES = [
    "/register",
    `/verify-email?token=${TOKEN}`,
    "/verify-email",
    `/confirm-email?token=${TOKEN}`,
    "/forgot-password",
    `/reset-password?token=${TOKEN}`,
    "/reset-password",
    "/privacy",
    "/terms",
    "/esto-no-existe",
  ];

  for (const viewport of [DESKTOP_1440, PHONE_390]) {
    for (const path of ROUTES) {
      test(`PAGES-70: ${path} at ${viewport.width}×${viewport.height}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto(path);

        expectNoSeriousViolations(await seriousViolations(page));
      });
    }
  }
});

// docs/specs/redesign-pages.md (PAGES-16, PAGES-19, PAGES-21, PAGES-24): what
// the access pages do once their button reaches the server. That needs a
// database (the address and the tokens are looked up), so these run in
// `pnpm test:e2e:db` (E2E_DB) only, unlike the rest of this file. The DB
// run's server has no Redis (playwright.config.ts's NO_REDIS), so rate
// limiting is off and every request here is answered.
const dbTest = process.env.E2E_DB ? test : test.skip;

// Shaped like a real token, but issued by nobody.
const MADE_UP_TOKEN = "e2e-made-up-token-0123456789abcdef";

test.describe("PAGES-21: /forgot-password's sent state", () => {
  dbTest(
    "PAGES-21: an address with no account gives way to «¿Ya está? / Mira tu correo»",
    async ({ page }) => {
      await page.setViewportSize(DESKTOP_1440);
      await page.goto("/forgot-password");

      await page.getByLabel("Email").fill(`e2e-pages21-${Date.now()}@e2e.local`);
      await page.getByRole("button", { name: "Enviar enlace" }).click();

      const headline = page.getByRole("heading", { level: 1 });
      await expect(headline).toContainText("¿Ya está?", { timeout: 15_000 });
      await expect(headline).toContainText("Mira tu correo");
      await expect(page.getByLabel("Email")).toHaveCount(0);
    },
  );
});

test.describe("PAGES-16, PAGES-19, PAGES-24: a made-up token, pressed, is the expired-link state", () => {
  dbTest("PAGES-16: /verify-email", async ({ page }) => {
    await page.goto(`/verify-email?token=${MADE_UP_TOKEN}`);

    await page.getByRole("button", { name: "Confirmar mi cuenta" }).click();

    await expect(page.getByRole("heading", { level: 1 })).toContainText("¿Enlace caducado?", {
      timeout: 15_000,
    });
  });

  dbTest("PAGES-19: /confirm-email", async ({ page }) => {
    await page.goto(`/confirm-email?token=${MADE_UP_TOKEN}`);

    await page.getByRole("button", { name: "Confirmar esta dirección" }).click();

    await expect(page.getByRole("heading", { level: 1 })).toContainText("¿Enlace caducado?", {
      timeout: 15_000,
    });
  });

  dbTest("PAGES-24: /reset-password", async ({ page }) => {
    await page.goto(`/reset-password?token=${MADE_UP_TOKEN}`);

    await page.getByLabel("Nueva contraseña", { exact: true }).fill("tangerine-gravel-orbit-41");
    await page.getByLabel("Repite la contraseña").fill("tangerine-gravel-orbit-41");
    await page.getByRole("button", { name: "Guardar contraseña" }).click();

    await expect(page.getByRole("heading", { level: 1 })).toContainText("¿Enlace caducado?", {
      timeout: 15_000,
    });
  });
});
