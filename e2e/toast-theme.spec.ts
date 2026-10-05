import { test, expect, type Page } from "@playwright/test";

// FRONT-23: the toast must paint with the active theme's card, border and
// foreground tokens. Sonner ships its own light surface; the layout's
// classNames have to win over it in both themes. The expectation is each
// token's own computed value (the spec's worked example): the build rewrites
// the oklch() values in app/globals.css into lab(), so a hand-written oklch()
// literal never matches what the browser reports. Before the fix the toast
// read rgb(255, 255, 255) in both themes.
interface ToastColours {
  backgroundColor: string;
  borderTopColor: string;
  color: string;
}

async function tokenColours(page: Page): Promise<ToastColours> {
  return page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.backgroundColor = "var(--card)";
    probe.style.borderTopColor = "var(--border)";
    probe.style.color = "var(--foreground)";
    document.body.append(probe);
    const style = getComputedStyle(probe);
    const output = {
      backgroundColor: style.backgroundColor,
      borderTopColor: style.borderTopColor,
      color: style.color,
    };
    probe.remove();
    return output;
  });
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

test("FRONT-23: a toast uses the dark theme's card, border and foreground tokens", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(page.locator("html")).not.toHaveClass(/light/);

  const colours = await toastColours(page);

  expect(colours.backgroundColor).not.toBe("rgb(255, 255, 255)");
  expect(colours).toEqual(await tokenColours(page));
});

test("FRONT-23: a toast uses the light theme's card, border and foreground tokens", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("theme", "light"));
  await page.goto("/login");
  await expect(page.locator("html")).toHaveClass(/light/);

  const colours = await toastColours(page);

  expect(colours.backgroundColor).not.toBe("rgb(255, 255, 255)");
  expect(colours).toEqual(await tokenColours(page));
});
