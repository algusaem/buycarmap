import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { renderWithI18n } from "@/test/utils/render";
import esMessages from "@/messages/es.json";

// docs/specs/redesign-navigation.md (HEAD-8, HEAD-17). The component contract
// (no props) reads the pathname and the session itself, same as SiteHeader.
const pathname = vi.fn(() => "/map");
vi.mock("next/navigation", () => ({
  usePathname: () => pathname(),
}));

const useSession = vi.fn();
vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    useSession: () => useSession(),
  },
}));

import { BottomNav } from "./BottomNav";

const SIGNED_IN = {
  data: { user: { name: "Ada Lovelace", email: "ada@example.com" } },
  isPending: false,
};
const SIGNED_OUT = { data: null, isPending: false };

beforeEach(() => {
  useSession.mockReset();
  pathname.mockReturnValue("/map");
});

describe("BottomNav — it applies", () => {
  it.each(["/favorites", "/alerts", "/alerts/abc", "/account"])(
    "HEAD-8: signed in on %s offers Mapa, Guardados and Alertas",
    (route) => {
      pathname.mockReturnValue(route);
      useSession.mockReturnValue(SIGNED_IN);
      renderWithI18n(<BottomNav />);

      expect(screen.getByRole("link", { name: "Map" })).toHaveAttribute("href", "/map");
      expect(screen.getByRole("link", { name: "Saved" })).toHaveAttribute("href", "/favorites");
      expect(screen.getByRole("link", { name: "Alerts" })).toHaveAttribute("href", "/alerts");
    },
  );

  it("HEAD-8: /favorites marks Saved current, and nothing else", () => {
    pathname.mockReturnValue("/favorites");
    useSession.mockReturnValue(SIGNED_IN);
    renderWithI18n(<BottomNav />);

    const current = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAccessibleName("Saved");
  });

  it.each(["/alerts", "/alerts/abc"])(
    "HEAD-8: %s marks Alerts current, and nothing else",
    (route) => {
      pathname.mockReturnValue(route);
      useSession.mockReturnValue(SIGNED_IN);
      renderWithI18n(<BottomNav />);

      const current = screen
        .getAllByRole("link")
        .filter((link) => link.getAttribute("aria-current") === "page");
      expect(current).toHaveLength(1);
      expect(current[0]).toHaveAccessibleName("Alerts");
    },
  );

  it("HEAD-8: /account marks no section current", () => {
    pathname.mockReturnValue("/account");
    useSession.mockReturnValue(SIGNED_IN);
    renderWithI18n(<BottomNav />);

    const current = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(0);
  });

  it("HEAD-8: the nav landmark is named Principal in Spanish", () => {
    pathname.mockReturnValue("/favorites");
    useSession.mockReturnValue(SIGNED_IN);
    render(<BottomNav />, {
      wrapper: ({ children }) => (
        <NextIntlClientProvider locale="es" messages={esMessages} timeZone="UTC">
          {children}
        </NextIntlClientProvider>
      ),
    });

    expect(screen.getByRole("navigation", { name: "Principal" })).toBeInTheDocument();
  });
});

describe("BottomNav — it does not apply", () => {
  it("HEAD-8: renders nothing when signed out", () => {
    pathname.mockReturnValue("/favorites");
    useSession.mockReturnValue(SIGNED_OUT);
    const { container } = renderWithI18n(<BottomNav />);

    expect(container).toBeEmptyDOMElement();
  });

  it.each(["/map", "/", "/login", "/privacy"])(
    "HEAD-8: renders nothing on %s, signed in",
    (route) => {
      pathname.mockReturnValue(route);
      useSession.mockReturnValue(SIGNED_IN);
      const { container } = renderWithI18n(<BottomNav />);

      expect(container).toBeEmptyDOMElement();
    },
  );

  it.each(["/map", "/", "/login", "/privacy"])(
    "HEAD-8: renders nothing on %s, signed out",
    (route) => {
      pathname.mockReturnValue(route);
      useSession.mockReturnValue(SIGNED_OUT);
      const { container } = renderWithI18n(<BottomNav />);

      expect(container).toBeEmptyDOMElement();
    },
  );
});

describe("BottomNav — safe area", () => {
  it(// jsdom computes no CSS, so a real safe-area offset can only be proven in
  // a browser (HEAD-18's e2e half). This is the contract's string-level
  // half: the rule has to be present in the class or inline style at all.
  "HEAD-17: the nav's class or inline style includes env(safe-area-inset-bottom)", () => {
    pathname.mockReturnValue("/favorites");
    useSession.mockReturnValue(SIGNED_IN);
    renderWithI18n(<BottomNav />);

    const nav = screen.getByRole("navigation");
    const styleAttr = nav.getAttribute("style") ?? "";
    const classAttr = nav.getAttribute("class") ?? "";
    expect(`${classAttr} ${styleAttr}`).toContain("env(safe-area-inset-bottom)");
  });
});
