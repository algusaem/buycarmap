import { test, expect, type Locator, type Page } from "@playwright/test";
import { mockListingSources } from "./fixtures/network";
import { e2eEmail, seedUser } from "./fixtures/db";

// docs/specs/redesign-navigation.md. Replaces e2e/navbar.spec.ts (NAV-2 moves
// here as HEAD-15). These are the criteria jsdom cannot reach: Tailwind's
// responsive classes and a touch target both need a real layout engine.

const dbTest = process.env.E2E_DB ? test : test.skip;
const PASSWORD = "harbour-lentil-quilt-97";

const MOBILE = { width: 375, height: 812 };
const DESKTOP = { width: 1280, height: 800 };

// Deliberately duplicated from favorites.spec.ts rather than shared — five
// lines of page-object glue, and coupling spec files together to save them
// would make either harder to change alone.
async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/email|correo/i).fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /sign in|entrar/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
}

/** Asserts every visible, named control inside `root` clears the 44px touch floor. */
async function assertTouchTargets(root: Locator, label: string) {
  const controls = [
    ...(await root.getByRole("link").all()),
    ...(await root.getByRole("button").all()),
  ];

  // A guard on the guard: with no controls found the loop below passes
  // vacuously and this test would defend nothing at all.
  expect(controls.length, `${label} controls found`).toBeGreaterThan(0);

  for (const control of controls) {
    if (!(await control.isVisible())) continue;

    const box = await control.boundingBox();
    const name = (await control.textContent())?.trim() || "(unnamed)";

    if (box) {
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;
      const hitsCenter = await control.evaluate(
        (el, [cx, cy]) =>
          document.elementFromPoint(cx, cy) === el ||
          el.contains(document.elementFromPoint(cx, cy)),
        [centerX, centerY] as [number, number],
      );
      const clearsFloor = box.width >= 44 && box.height >= 44;
      expect(
        clearsFloor || hitsCenter,
        `${label}: ${name} is ${box.width}x${box.height} and does not hit-test at its own centre`,
      ).toBe(true);
    } else {
      throw new Error(`${label}: ${name} has no box`);
    }
  }
}

test.describe("HEAD-7: header region visibility", () => {
  test("HEAD-7: at phone width, header-phone is visible and header-desktop is not, on / and /login", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);

    for (const path of ["/", "/login"]) {
      await page.goto(path);
      await expect(page.getByTestId("header-phone")).toBeVisible();
      await expect(page.getByTestId("header-desktop")).toBeHidden();
    }
  });

  test("HEAD-7: at desktop width, header-desktop is visible and header-phone is not, on / and /login", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);

    for (const path of ["/", "/login"]) {
      await page.goto(path);
      await expect(page.getByTestId("header-desktop")).toBeVisible();
      await expect(page.getByTestId("header-phone")).toBeHidden();
    }
  });

  test("HEAD-7: /map at phone width shows neither header region", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await mockListingSources(page);
    await page.goto("/map");

    await expect(page.getByTestId("header-desktop")).toBeHidden();
    await expect(page.getByTestId("header-phone")).toBeHidden();
  });
});

test.describe("HEAD-15: touch targets at phone width", () => {
  test("HEAD-15: every control in header-phone on / and /login clears the 44px floor (keeps NAV-2)", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);

    for (const path of ["/", "/login"]) {
      await page.goto(path);
      await assertTouchTargets(page.getByTestId("header-phone"), `header-phone ${path}`);
    }
  });

  dbTest(
    "HEAD-15 (dbTest): signed in at phone width on /favorites, the bottom nav's controls also clear the floor",
    async ({ page }) => {
      const email = e2eEmail("nav-touch");
      await seedUser(email, PASSWORD);
      await page.setViewportSize(MOBILE);
      await signIn(page, email);

      await page.goto("/favorites");
      const bottomNav = page.getByTestId("bottom-nav");
      await expect(bottomNav).toBeVisible();
      await assertTouchTargets(bottomNav, "bottom nav");
    },
  );
});

test.describe("HEAD-16: no horizontal scroll on a narrow desktop", () => {
  for (const width of [1024, 1440]) {
    test(`HEAD-16: at ${width}px wide, the header does not scroll horizontally on /, /map and /login`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await mockListingSources(page);

      for (const path of ["/", "/map", "/login"]) {
        await page.goto(path);
        const header = page.locator("header").first();
        const overflow = await header.evaluate((el) => el.scrollWidth - el.clientWidth);
        expect(overflow, `${path} at ${width}px`).toBeLessThanOrEqual(0);
      }
    });
  }
});

test.describe("HEAD-8: bottom nav visibility", () => {
  dbTest(
    "HEAD-8 (dbTest): signed in at phone width the bottom nav is visible on /favorites and hidden at desktop width",
    async ({ page }) => {
      const email = e2eEmail("nav-bottom");
      await seedUser(email, PASSWORD);

      await page.setViewportSize(MOBILE);
      await signIn(page, email);
      await page.goto("/favorites");
      await expect(page.getByTestId("bottom-nav")).toBeVisible();

      await page.setViewportSize(DESKTOP);
      await expect(page.getByTestId("bottom-nav")).toBeHidden();
    },
  );
});

// (F4 review round 1, docs/specs/redesign-entry.md ENTRY-8): the
// signed-in landing joins the tab bar's routes — amends HEAD-5 and HEAD-7,
// which used to keep a signed-in avatar/account link in the phone header
// here instead.
test.describe("ENTRY-8: the signed-in phone landing has the tab bar, not a header account link", () => {
  dbTest(
    "ENTRY-8 (dbTest): signed in at phone width, / shows the bottom nav with its four links, none current, and no account link or Entrar in the header",
    async ({ page }) => {
      const email = e2eEmail("nav-landing-tabbar");
      await seedUser(email, PASSWORD);

      await page.setViewportSize(MOBILE);
      await signIn(page, email);
      await page.goto("/");

      const bottomNav = page.getByTestId("bottom-nav");
      await expect(bottomNav).toBeVisible();
      await expect(bottomNav.getByRole("link", { name: /mapa|map/i })).toHaveAttribute(
        "href",
        "/map",
      );
      await expect(bottomNav.getByRole("link", { name: /guardados|saved/i })).toHaveAttribute(
        "href",
        "/favorites",
      );
      await expect(bottomNav.getByRole("link", { name: /alertas|alerts/i })).toHaveAttribute(
        "href",
        "/alerts",
      );
      await expect(bottomNav.getByRole("link", { name: /cuenta|account/i })).toHaveAttribute(
        "href",
        "/account",
      );
      expect(await bottomNav.locator('a[aria-current="page"]').count()).toBe(0);

      const phoneHeader = page.getByTestId("header-phone");
      await expect(phoneHeader.getByRole("link", { name: /cuenta|account/i })).toHaveCount(0);
      await expect(phoneHeader.getByText(/^(entrar|sign in)$/i)).toHaveCount(0);
    },
  );
});

test.describe("HEAD-18: Cerrar sesión clears the bottom nav", () => {
  dbTest(
    "HEAD-18 (dbTest): signed in at phone width, Sign out on /account is clear of the bottom nav and works",
    async ({ page }) => {
      const email = e2eEmail("nav-signout");
      await seedUser(email, PASSWORD);

      await page.setViewportSize(MOBILE);
      await signIn(page, email);
      await page.goto("/account");

      const signOutButton = page.getByRole("button", { name: /^(sign out|cerrar sesión)$/i });
      await signOutButton.scrollIntoViewIfNeeded();

      const bottomNav = page.getByTestId("bottom-nav");
      const signOutBox = await signOutButton.boundingBox();
      const navBox = (await bottomNav.isVisible()) ? await bottomNav.boundingBox() : null;

      if (navBox && signOutBox) {
        // No vertical overlap between the two boxes.
        const overlaps =
          signOutBox.y < navBox.y + navBox.height && signOutBox.y + signOutBox.height > navBox.y;
        expect(overlaps, "Sign out overlaps the bottom nav").toBe(false);
      }

      await signOutButton.click();
      await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
    },
  );
});

test.describe("HEAD-19: favorites and alerts scroll past the bottom nav", () => {
  for (const route of ["/favorites", "/alerts"] as const) {
    dbTest(
      `HEAD-19 (dbTest): signed in at phone width, ${route} scrolls and its last element clears the bottom nav`,
      async ({ page }) => {
        const email = e2eEmail(`nav-scroll-${route.slice(1)}`);
        await seedUser(email, PASSWORD);

        await page.setViewportSize(MOBILE);
        await signIn(page, email);
        await page.goto(route);

        // Let Next's post-navigation scroll/focus handling settle first:
        // injecting the marker before it runs gets the extra DOM nodes wiped
        // out as a "hydration mismatch" when that handler re-renders the
        // segment (observed directly: the nodes disappeared and the locator
        // below timed out).
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(500);

        // Simulates a long list: appends a 3,000px filler plus a trailing
        // marker inside the scrolling root, so the page is taller than the
        // viewport exactly as the bug's worked example describes (HEAD-19).
        // Each route's own scrolling root: the list column both routes draw
        // (components/favorites/SavedLayout.tsx), since F6 for /alerts
        // (docs/specs/redesign-alerts.md, ALERTUI-4).
        const rootSelector = '[data-testid="saved-list"]';
        await page.evaluate((selector) => {
          const root = document.querySelector(selector);
          if (!root) throw new Error(`scrolling root ${selector} not found`);
          const filler = document.createElement("div");
          filler.id = "__e2e_filler";
          filler.style.height = "3000px";
          root.appendChild(filler);
          const marker = document.createElement("div");
          marker.id = "__e2e_marker";
          marker.style.height = "1px";
          root.appendChild(marker);
        }, rootSelector);

        const marker = page.locator("#__e2e_marker");

        // The nearest scrollable ancestor of the marker, or the document when
        // none scrolls (today's bug: the body is pinned with overflow-hidden,
        // so nothing above the marker can scroll it into view at all).
        const scrollable = await marker.evaluateHandle((el) => {
          for (let node = el.parentElement; node; node = node.parentElement) {
            const style = getComputedStyle(node);
            if (
              (style.overflowY === "auto" || style.overflowY === "scroll") &&
              node.scrollHeight > node.clientHeight
            ) {
              return node;
            }
          }
          return document.scrollingElement as Element;
        });

        const boxBefore = await marker.boundingBox();
        if (!boxBefore) throw new Error("marker has no box before scrolling");

        // `scroll-behavior: smooth` (app/globals.css) animates this instead of
        // jumping, so the test polls for the target scrollTop instead of a
        // fixed wait.
        const scrollTopBefore = await scrollable.evaluate((el) => el.scrollTop);
        await scrollable.evaluate((el) => el.scrollBy(0, 600));
        await expect
          .poll(() => scrollable.evaluate((el) => el.scrollTop), { timeout: 5_000 })
          .toBeGreaterThanOrEqual(scrollTopBefore + 598);

        const boxAfter = await marker.boundingBox();
        if (!boxAfter) throw new Error("marker has no box after scrolling");

        const movedUpBy = boxBefore.y - boxAfter.y;
        expect(
          movedUpBy,
          `${route}: scrolling 600px should move the marker up by 600px`,
        ).toBeGreaterThanOrEqual(598);
        expect(
          movedUpBy,
          `${route}: scrolling 600px should move the marker up by 600px`,
        ).toBeLessThanOrEqual(602);

        // `scroll-behavior: smooth` (app/globals.css) animates this instead of
        // jumping, so the test polls instead of a fixed wait.
        await scrollable.evaluate((el) => {
          el.scrollTop = el.scrollHeight;
        });
        const maxScrollTop = await scrollable.evaluate(
          (el) => el.scrollHeight - el.clientHeight - 1,
        );
        await expect
          .poll(() => scrollable.evaluate((el) => el.scrollTop), { timeout: 5_000 })
          .toBeGreaterThanOrEqual(maxScrollTop);

        const boxAtEnd = await marker.boundingBox();
        if (!boxAtEnd) throw new Error("marker has no box after scrolling to the end");

        const bottomNav = page.getByTestId("bottom-nav");
        const navBox = await bottomNav.boundingBox();
        if (!navBox) throw new Error("bottom nav has no box");

        expect(
          boxAtEnd.y + boxAtEnd.height,
          `${route}: the marker should clear the bottom nav`,
        ).toBeLessThanOrEqual(navBox.y);
      },
    );
  }
});
