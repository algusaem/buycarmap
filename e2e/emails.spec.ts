import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { test } from "@playwright/test";

// INT-14 (docs/specs/core-integrations.md): screenshots every email
// template, in both locales, at desktop and mobile widths, for the owner to
// confirm before the commit (RULES.md §22 item 5).
//
// Gated like e2e/screenshots.spec.ts: every test skips itself unless
// SCREENSHOTS=1, so a plain `pnpm test:e2e` run never touches this file.
//
// Harness detail: `renderAllEmailsToDisk` is run in a child `tsx` process
// (`execFileSync`) rather than imported and called in-process. `@playwright/test`
// transforms every `.tsx` file it loads (including transitively, through this
// spec importing `scripts/render-emails.ts`, which imports `emails/*.tsx`)
// through its own JSX factory for its component-testing feature, which does
// not produce real React elements — `render()` then fails with "Objects are
// not valid as a React child (found: object with keys {__pw_type, type,
// props, key})" even for a trivial `<div />`, confirmed with a minimal
// zero-dependency repro outside this file. A child process never goes
// through Playwright's loader at all, so the real `tsx` compiler (the same
// one `pnpm exec tsx` uses elsewhere) handles the JSX normally. Expected
// values and titles below are unchanged.
//
// How to run:
//   SCREENSHOTS=1 pnpm exec playwright test e2e/emails.spec.ts

const OUT_DIR = path.join("test-results", "emails");

const EMAIL_NAMES = [
  "PasswordResetEmail",
  "VerifyRegistrationEmail",
  "ExistingAccountEmail",
  "VerifyEmailAddressEmail",
  "EmailChangeEmail",
  "EmailChangedNoticeEmail",
  "PasswordChangedEmail",
  "AlertDigestEmail",
] as const;

const LOCALES = ["en", "es"] as const;

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

test.beforeAll(() => {
  if (!process.env.SCREENSHOTS) return;
  mkdirSync(OUT_DIR, { recursive: true });
  execFileSync(process.execPath, [
    "--import",
    "tsx",
    path.resolve(__dirname, "../scripts/render-emails.ts"),
    OUT_DIR,
  ]);
});

for (const name of EMAIL_NAMES) {
  for (const locale of LOCALES) {
    for (const viewport of VIEWPORTS) {
      test(`INT-14: ${name} renders correctly (${locale}, ${viewport.name})`, async ({ page }) => {
        test.skip(!process.env.SCREENSHOTS, "Only runs with SCREENSHOTS=1 (RULES.md §22 item 5)");

        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(`file://${path.resolve(OUT_DIR, `${name}.${locale}.html`)}`);
        await page.screenshot({
          path: path.join(OUT_DIR, `${name}.${locale}.${viewport.name}.png`),
          fullPage: true,
        });
      });
    }
  }
}
