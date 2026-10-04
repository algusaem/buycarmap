// Renders every emails/*.tsx template, in both locales, to a static HTML
// file under the given directory, for e2e/emails.spec.ts to screenshot
// (docs/specs/core-integrations.md, INT-14).

import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { AlertDigestEmail } from "@/emails/AlertDigestEmail";
import { EmailChangeEmail } from "@/emails/EmailChangeEmail";
import { EmailChangedNoticeEmail } from "@/emails/EmailChangedNoticeEmail";
import { ExistingAccountEmail } from "@/emails/ExistingAccountEmail";
import { PasswordChangedEmail } from "@/emails/PasswordChangedEmail";
import { PasswordResetEmail } from "@/emails/PasswordResetEmail";
import { renderEmail } from "@/emails/render";
import { VerifyEmailAddressEmail } from "@/emails/VerifyEmailAddressEmail";
import { VerifyRegistrationEmail } from "@/emails/VerifyRegistrationEmail";
import type { CarListing } from "@/interfaces/listing";
import type { Locale } from "@/lib/i18n/config";

const APP_URL = "https://buycarmap.vercel.app";
const TOKEN = "abc123";
const LOCALES: Locale[] = ["en", "es"];

const SAMPLE_MATCH: CarListing = {
  id: "wallapop-abc123",
  image: "https://example.com/audi-a3.jpg",
  title: "Audi A3 2.0 TDI",
  subtitle: "2.0 TDI 150cv",
  price: 14500,
  mileage: 95000,
  year: 2018,
  fuel: "diesel",
  brand: "Audi",
  model: "A3",
  location: "Madrid",
  source: "Wallapop",
  lat: 40.4168,
  lng: -3.7038,
  url: "https://es.wallapop.com/item/audi-a3-abc123",
};

/** One fixture per template name, matching the props each component takes. */
function fixturesFor(locale: Locale) {
  return {
    PasswordResetEmail: createElement(PasswordResetEmail, {
      locale,
      resetUrl: `${APP_URL}/reset-password?token=${TOKEN}`,
    }),
    VerifyRegistrationEmail: createElement(VerifyRegistrationEmail, {
      locale,
      verifyUrl: `${APP_URL}/verify-email?token=${TOKEN}`,
    }),
    ExistingAccountEmail: createElement(ExistingAccountEmail, {
      locale,
      loginUrl: `${APP_URL}/login`,
    }),
    VerifyEmailAddressEmail: createElement(VerifyEmailAddressEmail, {
      locale,
      verifyUrl: `${APP_URL}/confirm-email?token=${TOKEN}`,
    }),
    EmailChangeEmail: createElement(EmailChangeEmail, {
      locale,
      confirmUrl: `${APP_URL}/confirm-email?token=${TOKEN}`,
    }),
    EmailChangedNoticeEmail: createElement(EmailChangedNoticeEmail, { locale }),
    PasswordChangedEmail: createElement(PasswordChangedEmail, { locale }),
    AlertDigestEmail: createElement(AlertDigestEmail, {
      locale,
      alertLabel: "Audi A3 under 20k",
      matches: [SAMPLE_MATCH],
      unsubscribeUrl: `${APP_URL}/api/alerts/unsubscribe?token=t0k`,
      alertUrl: `${APP_URL}/alerts/alert_1`,
    }),
  };
}

/**
 * Renders every template in both locales to `<outDir>/<Name>.<locale>.html`
 * (the path e2e/emails.spec.ts reads), and returns the list of files written.
 */
export async function renderAllEmailsToDisk(outDir: string): Promise<string[]> {
  await mkdir(outDir, { recursive: true });

  const written: string[] = [];

  for (const locale of LOCALES) {
    const fixtures = fixturesFor(locale);
    for (const [name, element] of Object.entries(fixtures)) {
      const { html } = await renderEmail(element);
      const path = `${outDir}/${name}.${locale}.html`;
      await writeFile(path, html, "utf8");
      written.push(path);
    }
  }

  return written;
}

// Guarded so `renderAllEmailsToDisk` can be imported (e.g. by a one-off
// script) without this running as a side effect — and so it can also run as
// a CLI entry, `<outDir>` as the one argument. e2e/emails.spec.ts invokes it
// this way, in a child process, rather than importing it directly: see the
// comment there for why.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  // No top-level await: the CLI entry runs under tsx's CJS transform
  // (e2e/emails.spec.ts's child process), which rejects it.
  void (async () => {
    const outDir = process.argv[2];
    if (!outDir) {
      console.error("Usage: render-emails.ts <outDir>");
      process.exit(1);
    }
    const written = await renderAllEmailsToDisk(outDir);
    console.log(`Rendered ${written.length} file(s) to ${outDir}`);
  })();
}
