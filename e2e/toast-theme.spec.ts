import { test, expect, type Page } from "@playwright/test";

// FRONT-23 (amended 2026-10-12, LOOK — redesign-foundation.md, LOOK-14): the
// toast takes its colours from the design tokens surface/line/text, in the
// app's single dark theme — there is no other theme to compare against any
// more. Expected values are LOOK-1's token hex values converted to rgb by
// hand: surface #18181B -> rgb(24, 24, 27), line #2A2A2E -> rgb(42, 42, 46),
// text #F4F2F0 -> rgb(244, 242, 240). Before the FRONT-23 fix the toast read
// rgb(255, 255, 255), which is why that value is still checked against.
interface ToastColours {
  backgroundColor: string;
  borderTopColor: string;
  color: string;
}

async function toastColours(page: Page): Promise<ToastColours> {
  await page.goto("/login");
  await page.getByLabel(/email|correo/i).fill("nobody@example.com");
  await page.locator('input[type="password"]').fill("not-the-password");
  await page.getByRole("button", { name: /sign in|entrar/i }).click();

  const toast = page.locator("[data-sonner-toast]").first();
  await expect(toast).toBeVisible();
  return toast.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      backgroundColor: style.backgroundColor,
      borderTopColor: style.borderTopColor,
      color: style.color,
    };
  });
}

test("FRONT-23: a toast uses the surface/line/text design tokens in the single dark theme (amended 2026-10-12, LOOK — redesign-foundation.md)", async ({
  page,
}) => {
  const colours = await toastColours(page);

  expect(colours.backgroundColor).not.toBe("rgb(255, 255, 255)");
  expect(colours.backgroundColor).toBe("rgb(24, 24, 27)");
  expect(colours.borderTopColor).toBe("rgb(42, 42, 46)");
  expect(colours.color).toBe("rgb(244, 242, 240)");
});
