import { test, expect, type Page, type Response } from "@playwright/test";
import { mockListingSources } from "./fixtures/network";

// PLAT-21 (e2e half) and PLAT-23 (docs/specs/core-platform.md): the CSP moves
// from a static header in next.config.ts to a per-request nonce in proxy.ts,
// and the pages that depend on an inline bootstrap script (next-themes) keep
// working under it with no CSP violation reported to the console.

const THEME_TOGGLE = /dark|light|oscuro|claro/i;

function scriptSrcDirective(response: Response): string | undefined {
  const csp = response.headers()["content-security-policy"] ?? "";
  return csp
    .split(";")
    .map((directive) => directive.trim())
    .find((directive) => directive.startsWith("script-src"));
}

async function cspViolationMessages(page: Page): Promise<string[]> {
  const messages: string[] = [];
  page.on("console", (message) => {
    if (/content[- ]security[- ]policy/i.test(message.text())) messages.push(message.text());
  });
  return messages;
}

for (const path of ["/", "/login", "/map"]) {
  test(`PLAT-21: ${path} sends a nonce-based CSP with no 'unsafe-inline' in script-src`, async ({
    page,
  }) => {
    if (path === "/map") await mockListingSources(page);

    const response = await page.goto(path);
    expect(response).not.toBeNull();

    const scriptSrc = scriptSrcDirective(response as Response);
    expect(scriptSrc).toBeDefined();
    expect(scriptSrc).toMatch(/'nonce-/);
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  test(`PLAT-23: ${path} reports no Content-Security-Policy violation in the console`, async ({
    page,
  }) => {
    const violations = await cspViolationMessages(page);
    if (path === "/map") await mockListingSources(page);

    await page.goto(path);
    await page.waitForLoadState("networkidle");

    expect(violations).toEqual([]);
  });
}

test("PLAT-23: the theme toggle still flips the html class under the nonce-based CSP", async ({
  page,
}) => {
  await page.goto("/");

  const html = page.locator("html");
  await expect(html).not.toHaveClass(/light/);

  await page.getByRole("button", { name: THEME_TOGGLE }).click();

  await expect(html).toHaveClass(/light/);
});
