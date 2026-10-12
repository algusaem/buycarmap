import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { renderWithI18n } from "@/test/utils/render";
import esMessages from "@/messages/es.json";
import { Footer } from "./Footer";

// LOOK-16 (docs/specs/redesign-foundation.md): the site footer's legal links
// and the Storyset illustration credit, in both locales — the English copy
// is owner-approved (2026-10-12, the spec's worked example). `components/
// Footer.tsx` does not exist yet; this is the failing spec LOOK-17's
// e2e/foundation.spec.ts expects the footer to satisfy once it does.
//
// es is rendered by hand here (not via renderWithI18n, which is locked to
// `messages/en.json`) the same way components/Navbar.test.tsx's NAV-11 does:
// a bare `render` wrapped in `NextIntlClientProvider` with `messages/es.json`.
function renderEs() {
  return render(<Footer />, {
    wrapper: ({ children }) => (
      <NextIntlClientProvider locale="es" messages={esMessages} timeZone="UTC">
        {children}
      </NextIntlClientProvider>
    ),
  });
}

describe("Footer", () => {
  it("LOOK-16: in Spanish, shows Privacidad, Términos and the Storyset credit", () => {
    renderEs();
    const footer = screen.getByRole("contentinfo");

    expect(screen.getByRole("link", { name: "Privacidad" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Términos" })).toHaveAttribute("href", "/terms");

    const storyset = screen.getByRole("link", { name: "Storyset" });
    expect(storyset).toHaveAttribute("href", "https://storyset.com");
    expect(storyset).toHaveAttribute("target", "_blank");
    expect(storyset).toHaveAttribute("rel", "noopener noreferrer");

    // The sentence spans a text node and the nested "Storyset" link, so it is
    // asserted on the footer's full text rather than by a single getByText.
    expect(footer.textContent?.replace(/\s+/g, " ")).toContain("Ilustraciones de Storyset");
  });

  it("LOOK-16: in English, shows Privacy, Terms and the Storyset credit", () => {
    renderWithI18n(<Footer />);
    const footer = screen.getByRole("contentinfo");

    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");

    const storyset = screen.getByRole("link", { name: "Storyset" });
    expect(storyset).toHaveAttribute("href", "https://storyset.com");
    expect(storyset).toHaveAttribute("target", "_blank");
    expect(storyset).toHaveAttribute("rel", "noopener noreferrer");

    expect(footer.textContent?.replace(/\s+/g, " ")).toContain("Illustrations by Storyset");
  });
});
