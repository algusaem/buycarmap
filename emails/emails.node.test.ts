import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { makeMatchListing } from "@/test/fixtures/alerts";
import type { Locale } from "@/lib/i18n/config";
import { renderEmail } from "./render";
import { PasswordResetEmail, subject as passwordResetSubject } from "./PasswordResetEmail";
import {
  VerifyRegistrationEmail,
  subject as verifyRegistrationSubject,
} from "./VerifyRegistrationEmail";
import { ExistingAccountEmail, subject as existingAccountSubject } from "./ExistingAccountEmail";
import {
  VerifyEmailAddressEmail,
  subject as verifyEmailAddressSubject,
} from "./VerifyEmailAddressEmail";
import { EmailChangeEmail, subject as emailChangeSubject } from "./EmailChangeEmail";
import {
  EmailChangedNoticeEmail,
  subject as emailChangedNoticeSubject,
} from "./EmailChangedNoticeEmail";
import { PasswordChangedEmail, subject as passwordChangedSubject } from "./PasswordChangedEmail";
import { AlertDigestEmail, subject as alertDigestSubject } from "./AlertDigestEmail";

// docs/specs/core-integrations.md, INT-13. Every expected value below was
// hand-copied from today's output of lib/email/templates/{auth,alert}-emails.ts
// (built from lib/email/copy.ts, lib/email/templates/layout.ts and
// messages/{en,es}.json — read in full before writing this file), for the
// fixed inputs declared next to each describe block. These literals are never
// computed by calling the old functions here, because lib/email/templates/*
// is deleted by INT-15 — renderEmail and every emails/*.tsx component is
// still a stub (renders null / returns ""), so every assertion below fails.

const APP_URL = "https://buycarmap.vercel.app";
const TOKEN = "abc123";

describe("PasswordResetEmail (INT-13)", () => {
  // Worked example (docs/specs/core-integrations.md): the Spanish
  // password-reset email's link is <APP_URL>/reset-password?token=<token>.
  const resetUrl = `${APP_URL}/reset-password?token=${TOKEN}`;

  it("INT-13: en subject matches today's renderPasswordResetEmail copy", () => {
    expect(passwordResetSubject("en", { locale: "en", resetUrl })).toBe(
      "Reset your BuyCarMap password",
    );
  });

  it("INT-13: es subject matches today's renderPasswordResetEmail copy", () => {
    expect(passwordResetSubject("es", { locale: "es", resetUrl })).toBe(
      "Restablece tu contraseña de BuyCarMap",
    );
  });

  it("INT-13: en renders the reset link with today's button text, in HTML and text", async () => {
    const { html, text } = await renderEmail(
      createElement(PasswordResetEmail, { locale: "en", resetUrl }),
    );

    expect(html).toContain(resetUrl);
    expect(html).toContain("Choose a new password");
    expect(text).toContain(resetUrl);
  });

  it("INT-13: es renders the reset link with today's button text, in HTML and text", async () => {
    const { html, text } = await renderEmail(
      createElement(PasswordResetEmail, { locale: "es", resetUrl }),
    );

    expect(html).toContain(resetUrl);
    expect(html).toContain("Elegir una nueva contraseña");
    expect(text).toContain(resetUrl);
  });
});

describe("VerifyRegistrationEmail (INT-13)", () => {
  const verifyUrl = `${APP_URL}/verify-email?token=${TOKEN}`;

  it("INT-13: en subject and button text match today's copy", async () => {
    expect(verifyRegistrationSubject("en", { locale: "en", verifyUrl })).toBe(
      "Confirm your BuyCarMap account",
    );
    const { html } = await renderEmail(
      createElement(VerifyRegistrationEmail, { locale: "en", verifyUrl }),
    );
    expect(html).toContain(verifyUrl);
    expect(html).toContain("Confirm my account");
  });

  it("INT-13: es subject and button text match today's copy", async () => {
    expect(verifyRegistrationSubject("es", { locale: "es", verifyUrl })).toBe(
      "Confirma tu cuenta de BuyCarMap",
    );
    const { html } = await renderEmail(
      createElement(VerifyRegistrationEmail, { locale: "es", verifyUrl }),
    );
    expect(html).toContain(verifyUrl);
    expect(html).toContain("Confirmar mi cuenta");
  });
});

describe("ExistingAccountEmail (INT-13)", () => {
  const loginUrl = `${APP_URL}/login`;

  it("INT-13: en subject and button text match today's copy", async () => {
    expect(existingAccountSubject("en", { locale: "en", loginUrl })).toBe(
      "Someone tried to sign up with your email",
    );
    const { html } = await renderEmail(
      createElement(ExistingAccountEmail, { locale: "en", loginUrl }),
    );
    expect(html).toContain(loginUrl);
    expect(html).toContain("Sign in instead");
  });

  it("INT-13: es subject and button text match today's copy", async () => {
    expect(existingAccountSubject("es", { locale: "es", loginUrl })).toBe(
      "Alguien ha intentado registrarse con tu correo",
    );
    const { html } = await renderEmail(
      createElement(ExistingAccountEmail, { locale: "es", loginUrl }),
    );
    expect(html).toContain(loginUrl);
    expect(html).toContain("Iniciar sesión");
  });
});

describe("VerifyEmailAddressEmail (INT-13)", () => {
  const verifyUrl = `${APP_URL}/confirm-email?token=${TOKEN}`;

  it("INT-13: en subject and button text match today's copy", async () => {
    expect(verifyEmailAddressSubject("en", { locale: "en", verifyUrl })).toBe(
      "Verify your BuyCarMap email address",
    );
    const { html } = await renderEmail(
      createElement(VerifyEmailAddressEmail, { locale: "en", verifyUrl }),
    );
    expect(html).toContain(verifyUrl);
    expect(html).toContain("Verify my email");
  });

  it("INT-13: es subject and button text match today's copy", async () => {
    expect(verifyEmailAddressSubject("es", { locale: "es", verifyUrl })).toBe(
      "Verifica tu correo de BuyCarMap",
    );
    const { html } = await renderEmail(
      createElement(VerifyEmailAddressEmail, { locale: "es", verifyUrl }),
    );
    expect(html).toContain(verifyUrl);
    expect(html).toContain("Verificar mi correo");
  });
});

describe("EmailChangeEmail (INT-13)", () => {
  const confirmUrl = `${APP_URL}/confirm-email?token=${TOKEN}`;

  it("INT-13: en subject and button text match today's copy", async () => {
    expect(emailChangeSubject("en", { locale: "en", confirmUrl })).toBe(
      "Confirm your new BuyCarMap email address",
    );
    const { html } = await renderEmail(
      createElement(EmailChangeEmail, { locale: "en", confirmUrl }),
    );
    expect(html).toContain(confirmUrl);
    expect(html).toContain("Confirm this address");
  });

  it("INT-13: es subject and button text match today's copy", async () => {
    expect(emailChangeSubject("es", { locale: "es", confirmUrl })).toBe(
      "Confirma tu nueva dirección de BuyCarMap",
    );
    const { html } = await renderEmail(
      createElement(EmailChangeEmail, { locale: "es", confirmUrl }),
    );
    expect(html).toContain(confirmUrl);
    expect(html).toContain("Confirmar esta dirección");
  });
});

describe("EmailChangedNoticeEmail (INT-13, no link)", () => {
  it("INT-13: en subject and copy match today's notice, with no link", async () => {
    expect(emailChangedNoticeSubject("en", { locale: "en" })).toBe(
      "Your BuyCarMap email address was changed",
    );
    const { html, text } = await renderEmail(
      createElement(EmailChangedNoticeEmail, { locale: "en" }),
    );
    expect(text).toContain("Reset your password immediately and contact us.");
    expect(html).not.toContain("<a href");
  });

  it("INT-13: es subject and copy match today's notice, with no link", async () => {
    expect(emailChangedNoticeSubject("es", { locale: "es" })).toBe(
      "Se ha cambiado el correo de tu cuenta de BuyCarMap",
    );
    const { html, text } = await renderEmail(
      createElement(EmailChangedNoticeEmail, { locale: "es" }),
    );
    expect(text).toContain("Restablece tu contraseña de inmediato y contacta con nosotros.");
    expect(html).not.toContain("<a href");
  });
});

describe("PasswordChangedEmail (INT-13, no link)", () => {
  it("INT-13: en subject and copy match today's notice, with no link", async () => {
    expect(passwordChangedSubject("en", { locale: "en" })).toBe(
      "Your BuyCarMap password was changed",
    );
    const { html, text } = await renderEmail(createElement(PasswordChangedEmail, { locale: "en" }));
    expect(text).toContain("signed out on all other devices");
    expect(html).not.toContain("<a href");
  });

  it("INT-13: es subject and copy match today's notice, with no link", async () => {
    expect(passwordChangedSubject("es", { locale: "es" })).toBe(
      "Se ha cambiado tu contraseña de BuyCarMap",
    );
    const { html, text } = await renderEmail(createElement(PasswordChangedEmail, { locale: "es" }));
    expect(text).toContain("Se ha cerrado la sesión en el resto de dispositivos");
    expect(html).not.toContain("<a href");
  });
});

describe("AlertDigestEmail (INT-13)", () => {
  const match = makeMatchListing({
    id: "wallapop-abc123",
    title: "Audi A3 2.0 TDI",
    price: 14500,
    url: "https://es.wallapop.com/item/audi-a3-abc123",
  });
  const unsubscribeUrl = "https://buycarmap.test/api/alerts/unsubscribe?token=t0k";
  const alertLabel = "Audi A3 under 20k";

  function buildProps(locale: Locale) {
    return { locale, alertLabel, matches: [match], unsubscribeUrl };
  }

  it("INT-13: en subject names the single match, as today's renderAlertEmail does", () => {
    expect(alertDigestSubject("en", buildProps("en"))).toBe(
      "New match for your alert: Audi A3 2.0 TDI",
    );
  });

  it("INT-13: es subject names the single match, as today's renderAlertEmail does", () => {
    expect(alertDigestSubject("es", buildProps("es"))).toBe(
      "Nuevo coche para tu alerta: Audi A3 2.0 TDI",
    );
  });

  it("INT-13: links the match to its original listing and offers the unsubscribe link, in HTML and text", async () => {
    const { html, text } = await renderEmail(createElement(AlertDigestEmail, buildProps("en")));

    expect(html).toContain(match.url);
    expect(html).toContain(match.title);
    expect(html).toContain(unsubscribeUrl);
    expect(text).toContain(match.url);
    expect(text).toContain(unsubscribeUrl);
  });

  // ALERT-22 (docs/specs/alerts.md), moved here under the same id from the
  // deleted lib/email/templates/alert-emails.test.ts (docs/specs/core-integrations.md,
  // decision 6): the email renders each listing from the stored snapshot,
  // making no request to any source API.
  it("ALERT-22: renders every match from the stored snapshot alone, touching no source API", async () => {
    const calls: string[] = [];
    server.use(
      http.get("*/api/wallapop/search", ({ request }) => {
        calls.push(request.url);
        return HttpResponse.json({});
      }),
      http.post("*/api/cochesnet/search", ({ request }) => {
        calls.push(request.url);
        return HttpResponse.json({});
      }),
      http.get("*/api/milanuncios/search", ({ request }) => {
        calls.push(request.url);
        return HttpResponse.json({});
      }),
    );
    const second = makeMatchListing({
      id: "cochesnet-99",
      title: "Seat Leon FR",
      price: 11200,
      source: "Coches.net",
      url: "https://www.coches.net/seat-leon-99",
    });

    const { html } = await renderEmail(
      createElement(AlertDigestEmail, { ...buildProps("en"), matches: [match, second] }),
    );

    expect(html).toContain(match.title);
    expect(html).toContain(second.title);
    expect(calls).toEqual([]);
  });
});
