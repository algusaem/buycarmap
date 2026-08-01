import { describe, expect, it } from "vitest";
import { escapeHtml } from "./layout";
import {
  renderExistingAccountEmail,
  renderPasswordChangedEmail,
  renderPasswordResetEmail,
} from "./auth-emails";

const RESET_URL = "https://buycarmap.com/reset-password?token=abc123";

describe("escapeHtml", () => {
  it("neutralizes every character that could break out of markup", () => {
    expect(escapeHtml(`<script>alert("x") & 'y'</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;) &amp; &#39;y&#39;&lt;/script&gt;",
    );
  });

  it("escapes ampersands before the entities it introduces", () => {
    // Naive ordering would turn "&" into "&amp;" after "<" became "&lt;",
    // producing "&amp;lt;" and rendering the tag as visible text.
    expect(escapeHtml("&<")).toBe("&amp;&lt;");
  });
});

describe("renderPasswordResetEmail", () => {
  it("puts the reset link in both the HTML and the plain-text part", () => {
    const email = renderPasswordResetEmail("en", RESET_URL);

    // Text is not optional: HTML-only mail scores badly with spam filters and
    // the link has to work in text-only clients.
    expect(email.html).toContain(RESET_URL);
    expect(email.text).toContain(RESET_URL);
  });

  it("uses locale-appropriate copy", () => {
    const en = renderPasswordResetEmail("en", RESET_URL);
    const es = renderPasswordResetEmail("es", RESET_URL);

    expect(en.subject).toBe("Reset your BuyCarMap password");
    expect(es.subject).toBe("Restablece tu contraseña de BuyCarMap");
    expect(es.html).toContain("Elegir una nueva contraseña");
  });

  it("states the expiry and the ignore-if-not-you guidance", () => {
    const email = renderPasswordResetEmail("en", RESET_URL);

    expect(email.text).toContain("expires in one hour");
    expect(email.text).toContain("safely ignore this email");
  });

  it("escapes a URL carrying HTML-significant characters", () => {
    const hostile = `https://buycarmap.com/reset-password?token=a"><script>`;
    const email = renderPasswordResetEmail("en", hostile);

    expect(email.html).not.toContain(`"><script>`);
    expect(email.html).toContain("&quot;&gt;&lt;script&gt;");
  });
});

describe("renderPasswordChangedEmail", () => {
  it("tells the owner what happened and what to do if it was not them", () => {
    const email = renderPasswordChangedEmail("en");

    expect(email.subject).toBe("Your BuyCarMap password was changed");
    expect(email.text).toContain("signed out on all other devices");
    expect(email.text).toContain("If this wasn't you");
  });

  it("carries no link, so it cannot be used as a phishing template", () => {
    expect(renderPasswordChangedEmail("en").html).not.toContain("<a href");
  });
});

describe("renderExistingAccountEmail", () => {
  it("tells the address owner about the signup attempt", () => {
    // This is what lets registration stop confirming "that email is taken" to
    // whoever is at the keyboard: the notice goes to the inbox instead.
    const email = renderExistingAccountEmail("es", "https://buycarmap.com/login");

    expect(email.subject).toBe("Alguien ha intentado registrarse con tu correo");
    expect(email.html).toContain("https://buycarmap.com/login");
  });

  it("renders identically no matter which account it concerns", () => {
    // The builder takes only a locale and a URL — no name, creation date or
    // sign-in provider. A forwarded copy therefore discloses nothing beyond
    // what the recipient already knows, and the notice cannot become a second
    // enumeration channel.
    const first = renderExistingAccountEmail("en", "https://buycarmap.com/login");
    const second = renderExistingAccountEmail("en", "https://buycarmap.com/login");

    expect(first).toEqual(second);
    // No address, no display name, no provider identity anywhere in the body.
    expect(first.text).not.toMatch(/@|last sign|google|github/i);
  });
});
