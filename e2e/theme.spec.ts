import { test, expect } from "@playwright/test";

// useThemeTransition drives the View Transitions API, which jsdom does not
// implement — the component test stubs the hook and can only prove the toggle
// is wired. This is the only place the real thing runs.
const THEME_TOGGLE = /dark|light|oscuro|claro/i;

test("CORE-10: toggling the theme switches it and survives a reload", async ({
  page,
}) => {
  await page.goto("/");

  const html = page.locator("html");
  // Dark is the default (see globals.css: :root is dark, .light overrides).
  await expect(html).not.toHaveClass(/light/);

  await page.getByRole("button", { name: THEME_TOGGLE }).click();
  await expect(html).toHaveClass(/light/);

  // next-themes persists to localStorage; a reload that flipped back would mean
  // every visit starts over.
  await page.reload();
  await expect(html).toHaveClass(/light/);

  await page.getByRole("button", { name: THEME_TOGGLE }).click();
  await expect(html).not.toHaveClass(/light/);
});
