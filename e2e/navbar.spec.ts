import { test, expect, Locator, Page } from "@playwright/test";

// These three criteria are the ones jsdom cannot reach. Tailwind's `lg:hidden`
// and `hidden lg:flex` do nothing without a layout engine, and neither does a
// touch target — both need a real viewport, so they live here rather than in
// components/Navbar.test.tsx with the other fourteen.

const MOBILE = { width: 375, height: 812 };
const DESKTOP = { width: 1280, height: 800 };

const SIGN_UP = /sign up|registrarse/i;
const MENU = /^(menu|menú)$/i;
const THEME = /dark|light|oscuro|claro/i;

/** The navbar's control cluster, which carries `aria-hidden` until the session resolves. */
function controlCluster(page: Page) {
  return page.getByRole("navigation").locator("> div > [aria-hidden]");
}

/**
 * Waits for `useSession` to settle.
 *
 * Keyed on the cluster's own `aria-hidden`, and neither of the two obvious
 * alternatives works:
 *
 *  - Waiting for a control to be *attached* returns immediately. The loading
 *    state renders the real controls and hides them with `visibility`, so they
 *    are in the DOM the whole time. NAV-2 would then measure a bar where every
 *    control is invisible, skip all of them, and pass having asserted nothing.
 *  - Waiting for the register link to be *visible* would prove NAV-17 inside
 *    the helper, leaving that criterion's own assertion tautological.
 *
 * The cluster's resolved state is independent of both.
 */
async function waitForSessionToResolve(page: Page) {
  await expect(controlCluster(page)).toHaveAttribute("aria-hidden", "false", {
    timeout: 15_000,
  });
}

test("NAV-2: every navbar control on a phone is at least 44 by 44 pixels", async ({
  page,
}) => {
  await page.setViewportSize(MOBILE);
  await page.goto("/");
  await waitForSessionToResolve(page);

  await assertTouchTargets(page.getByRole("navigation").first(), "bar");

  // The menu counts too, and it is where the worst offender ended up: the
  // language switcher's bare "EN" was roughly 20x16, under half the floor.
  // It lives in a portal outside <nav>, so querying the bar alone would let
  // exactly the control this criterion exists for go unchecked.
  await page.getByRole("button", { name: MENU }).click();

  const menu = page.getByRole("dialog");
  await expect(menu).toBeVisible();
  // `.all()` inside the helper resolves once and does not wait, so the panel's
  // contents have to be there before it runs. Without this the suite failed
  // under parallel load — two workers contending for one dev server was enough
  // to measure an empty panel.
  await expect(menu.getByRole("button", { name: THEME })).toBeVisible();

  await assertTouchTargets(menu, "menu");
});

/** Asserts every visible control inside `root` clears the 44px touch floor. */
async function assertTouchTargets(root: Locator, label: string) {
  const controls = [
    ...(await root.getByRole("link").all()),
    ...(await root.getByRole("button").all()),
  ];

  // A guard on the guard: with no controls found the loop below passes
  // vacuously and this test would defend nothing at all.
  expect(controls.length, `${label} controls found`).toBeGreaterThan(1);

  for (const control of controls) {
    if (!(await control.isVisible())) continue;

    const box = await control.boundingBox();
    const name = (await control.textContent())?.trim() || "(unnamed)";

    expect(box, `${label}: ${name} has no box`).not.toBeNull();
    expect(box!.width, `${label}: ${name} width`).toBeGreaterThanOrEqual(44);
    expect(box!.height, `${label}: ${name} height`).toBeGreaterThanOrEqual(44);
  }
}

test("NAV-17: a visitor on a phone can register without opening the menu", async ({
  page,
}) => {
  await page.setViewportSize(MOBILE);
  await page.goto("/");
  await waitForSessionToResolve(page);

  // The defect this spec exists for. The register link was `hidden
  // sm:inline-flex`, so the product's primary conversion action was absent on
  // exactly the devices most people arrive on — and absent in a way no jsdom
  // test could see, because jsdom applies no CSS and the element was always in
  // the DOM. `toBeVisible` is the whole point of this assertion.
  await expect(
    page.getByRole("navigation").getByRole("link", { name: SIGN_UP }),
  ).toBeVisible();
});

test("NAV-9: the bar does not shift when the session resolves", async ({
  page,
}) => {
  // Hold the session request open so the placeholder state is measurable
  // rather than a frame that has already passed.
  await page.route("**/api/auth/session", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });

  await page.setViewportSize(MOBILE);
  await page.goto("/");

  const nav = page.getByRole("navigation");
  // Located by the `aria-hidden` it genuinely carries rather than by a test id,
  // which this codebase keeps out of production components. It is present in
  // both states, which is what makes a before/after comparison possible at all.
  const controls = controlCluster(page);

  // Two things this must NOT do, both of which produced a test that passed
  // against a deliberately broken placeholder:
  //
  //  - Measure the logo. The bar is `justify-between`, so the logo is pinned to
  //    the left edge and cannot move however badly the cluster reflows.
  //  - Wait for a control that exists only after the session resolves. That
  //    wait blocks until the placeholder is already gone, so "before" and
  //    "after" are both the resolved state and the assertion is vacuous.
  //
  // Asserting the loading state first is what pins the measurement to the
  // moment the placeholder is actually on screen.
  await expect(controls).toHaveAttribute("aria-hidden", "true");
  const navBefore = await nav.boundingBox();
  const controlsBefore = await controls.boundingBox();

  await expect(controls).toHaveAttribute("aria-hidden", "false");
  const navAfter = await nav.boundingBox();
  const controlsAfter = await controls.boundingBox();

  // Same box, so nothing slides when the session lands. The cluster is
  // right-aligned, so a placeholder of the wrong width moves everything in it.
  expect(navAfter!.height).toBe(navBefore!.height);
  expect(controlsAfter!.width).toBe(controlsBefore!.width);
  expect(controlsAfter!.x).toBe(controlsBefore!.x);
});

test("NAV-13: the menu trigger and the full control row swap at the breakpoint", async ({
  page,
}) => {
  await page.setViewportSize(MOBILE);
  await page.goto("/");
  await waitForSessionToResolve(page);

  const nav = page.getByRole("navigation");

  // On a phone the row collapses: theme moves into the menu, so the only way
  // to reach it is the trigger.
  await expect(nav.getByRole("button", { name: MENU })).toBeVisible();
  await expect(nav.getByRole("button", { name: THEME })).toBeHidden();

  await page.setViewportSize(DESKTOP);

  // On desktop the trigger has nothing to collapse and the theme toggle stays
  // one click away, animation and all.
  await expect(nav.getByRole("button", { name: THEME })).toBeVisible();
  await expect(nav.getByRole("button", { name: MENU })).toBeHidden();
});
