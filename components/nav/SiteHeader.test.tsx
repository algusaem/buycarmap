import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithI18n } from "@/test/utils/render";

// docs/specs/redesign-navigation.md (HEAD). SiteHeader replaces Navbar: one
// <header> holding two always-mounted regions (header-desktop, header-phone),
// chosen by CSS rather than by a hook — see the spec's "One header component
// per kind of page, chosen by route" decision. Both regions are mounted at
// once in jsdom (there is no layout engine to hide one), so every query below
// is scoped with `within(...)` to the region it actually asserts about.
const pathname = vi.fn(() => "/");
const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  usePathname: () => pathname(),
}));

const useSession = vi.fn();
vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    useSession: () => useSession(),
  },
}));

// LanguageControl (components/nav/LanguageControl.tsx) mounts
// useLocaleSwitcher, which calls this action and next/navigation's router —
// both mocked here only so SiteHeader can render its real child without
// reaching the network. LanguageControl's own behaviour is
// components/nav/LanguageControl.test.tsx's job.
vi.mock("@/server/locale/actions", () => ({
  setLocale: vi.fn(async () => ({ ok: true, value: undefined })),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { SiteHeader } from "./SiteHeader";

const SIGNED_IN = {
  data: { user: { name: "Ada Lovelace", email: "ada@example.com" } },
  isPending: false,
};
const SIGNED_OUT = { data: null, isPending: false };
const LOADING = { data: null, isPending: true };

function desktop() {
  return within(screen.getByTestId("header-desktop"));
}

function phone() {
  return within(screen.getByTestId("header-phone"));
}

const SIGNED_IN_SECTION_ROUTES = ["/favorites", "/alerts", "/alerts/abc", "/account"];
const SIGN_IN_LEGAL_ROUTES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/confirm-email",
  "/privacy",
  "/terms",
];
const ALL_ROUTES = ["/map", "/", ...SIGNED_IN_SECTION_ROUTES, ...SIGN_IN_LEGAL_ROUTES];

beforeEach(() => {
  useSession.mockReset();
  pathname.mockReturnValue("/");
  push.mockReset();
  refresh.mockReset();
});

describe("SiteHeader — map header", () => {
  it("HEAD-1: signed in on /map, the desktop region offers the language group, Saved, Alerts and the avatar, and no Map link", () => {
    pathname.mockReturnValue("/map");
    useSession.mockReturnValue(SIGNED_IN);
    renderWithI18n(<SiteHeader />);

    const region = desktop();
    expect(region.getByRole("link", { name: "BuyCarMap" })).toHaveAttribute("href", "/");
    expect(region.getByRole("group", { name: "Language" })).toBeInTheDocument();
    expect(region.getByRole("link", { name: "Saved" })).toHaveAttribute("href", "/favorites");
    expect(region.getByRole("link", { name: "Alerts" })).toHaveAttribute("href", "/alerts");
    expect(region.getByRole("link", { name: "Account" })).toHaveAttribute("href", "/account");
    expect(region.queryByRole("link", { name: "Map" })).not.toBeInTheDocument();
  });

  it("HEAD-2: signed out on /map, the desktop region offers the wordmark, the language group and Sign in, and no guarded link", () => {
    pathname.mockReturnValue("/map");
    useSession.mockReturnValue(SIGNED_OUT);
    renderWithI18n(<SiteHeader />);

    const region = desktop();
    expect(region.getByRole("link", { name: "BuyCarMap" })).toHaveAttribute("href", "/");
    expect(region.getByRole("group", { name: "Language" })).toBeInTheDocument();
    expect(region.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(region.queryByRole("link", { name: "Saved" })).not.toBeInTheDocument();
    expect(region.queryByRole("link", { name: "Alerts" })).not.toBeInTheDocument();
    expect(region.queryByRole("link", { name: "Account" })).not.toBeInTheDocument();
  });
});

describe("SiteHeader — pages header", () => {
  it.each(SIGNED_IN_SECTION_ROUTES)(
    "HEAD-3: signed in on %s, the desktop region offers Map, Saved, Alerts and the avatar",
    (route) => {
      pathname.mockReturnValue(route);
      useSession.mockReturnValue(SIGNED_IN);
      renderWithI18n(<SiteHeader />);

      const region = desktop();
      expect(region.getByRole("link", { name: "Map" })).toHaveAttribute("href", "/map");
      expect(region.getByRole("link", { name: "Saved" })).toHaveAttribute("href", "/favorites");
      expect(region.getByRole("link", { name: "Alerts" })).toHaveAttribute("href", "/alerts");
      expect(region.getByRole("link", { name: "Account" })).toHaveAttribute("href", "/account");
    },
  );
});

describe("SiteHeader — current page", () => {
  function currentLinks() {
    return desktop()
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
  }

  it("HEAD-4: /favorites marks Saved current, and nothing else", () => {
    pathname.mockReturnValue("/favorites");
    useSession.mockReturnValue(SIGNED_IN);
    renderWithI18n(<SiteHeader />);

    const current = currentLinks();
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAccessibleName("Saved");
  });

  it.each(["/alerts", "/alerts/abc"])(
    "HEAD-4: %s marks Alerts current, and nothing else",
    (route) => {
      pathname.mockReturnValue(route);
      useSession.mockReturnValue(SIGNED_IN);
      renderWithI18n(<SiteHeader />);

      const current = currentLinks();
      expect(current).toHaveLength(1);
      expect(current[0]).toHaveAccessibleName("Alerts");
    },
  );

  it("HEAD-4: /account marks the avatar current, and no section link", () => {
    pathname.mockReturnValue("/account");
    useSession.mockReturnValue(SIGNED_IN);
    renderWithI18n(<SiteHeader />);

    const current = currentLinks();
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAccessibleName("Account");
  });

  it("NAV-7: marks the destination matching the current page, and marks no other", () => {
    pathname.mockReturnValue("/alerts");
    useSession.mockReturnValue(SIGNED_IN);
    renderWithI18n(<SiteHeader />);

    expect(desktop().getByRole("link", { name: "Alerts" })).toHaveAttribute("aria-current", "page");
    expect(desktop().getByRole("link", { name: "Saved" })).not.toHaveAttribute("aria-current");
  });
});

describe("SiteHeader — landing", () => {
  it("HEAD-5: / signed out offers Sign in and Create account", () => {
    pathname.mockReturnValue("/");
    useSession.mockReturnValue(SIGNED_OUT);
    renderWithI18n(<SiteHeader />);

    const region = desktop();
    expect(region.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(region.getByRole("link", { name: "Create account" })).toHaveAttribute(
      "href",
      "/register",
    );
  });

  it("HEAD-5: / signed in offers Map, Saved, Alerts and the avatar, with no current destination", () => {
    pathname.mockReturnValue("/");
    useSession.mockReturnValue(SIGNED_IN);
    renderWithI18n(<SiteHeader />);

    const region = desktop();
    expect(region.getByRole("link", { name: "Map" })).toHaveAttribute("href", "/map");
    expect(region.getByRole("link", { name: "Saved" })).toHaveAttribute("href", "/favorites");
    expect(region.getByRole("link", { name: "Alerts" })).toHaveAttribute("href", "/alerts");
    expect(region.getByRole("link", { name: "Account" })).toHaveAttribute("href", "/account");
    const current = region
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(0);
  });
});

describe("SiteHeader — sign-in, recovery and legal pages", () => {
  it.each(SIGN_IN_LEGAL_ROUTES)(
    "HEAD-6: %s signed in shows only the wordmark, the language group and Back to map",
    (route) => {
      pathname.mockReturnValue(route);
      useSession.mockReturnValue(SIGNED_IN);
      renderWithI18n(<SiteHeader />);

      const region = desktop();
      expect(region.getByRole("link", { name: "BuyCarMap" })).toBeInTheDocument();
      expect(region.getByRole("group", { name: "Language" })).toBeInTheDocument();
      expect(region.getByRole("link", { name: "Back to map" })).toHaveAttribute("href", "/map");
      expect(region.queryByRole("link", { name: "Saved" })).not.toBeInTheDocument();
      expect(region.queryByRole("link", { name: "Alerts" })).not.toBeInTheDocument();
      expect(region.queryByRole("link", { name: "Account" })).not.toBeInTheDocument();
      expect(region.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
      expect(region.queryByRole("link", { name: "Create account" })).not.toBeInTheDocument();
    },
  );

  it.each(SIGN_IN_LEGAL_ROUTES)(
    "HEAD-6: %s signed out shows only the wordmark, the language group and Back to map",
    (route) => {
      pathname.mockReturnValue(route);
      useSession.mockReturnValue(SIGNED_OUT);
      renderWithI18n(<SiteHeader />);

      const region = desktop();
      expect(region.getByRole("link", { name: "BuyCarMap" })).toBeInTheDocument();
      expect(region.getByRole("group", { name: "Language" })).toBeInTheDocument();
      expect(region.getByRole("link", { name: "Back to map" })).toHaveAttribute("href", "/map");
      expect(region.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
      expect(region.queryByRole("link", { name: "Create account" })).not.toBeInTheDocument();
    },
  );
});

describe("SiteHeader — phone region", () => {
  it("HEAD-7: /map at phone width renders no header-phone region", () => {
    pathname.mockReturnValue("/map");
    useSession.mockReturnValue(SIGNED_IN);
    renderWithI18n(<SiteHeader />);

    expect(screen.queryByTestId("header-phone")).not.toBeInTheDocument();
  });

  // Amended by ENTRY-8 (docs/specs/redesign-entry.md): the phone landing
  // header used to keep the avatar since the landing had no tab bar of its
  // own; now that the landing has one (MAPUI-52's own amendment), Cuenta
  // lives there instead — the same reason the section pages already show no
  // avatar at phone width (MAPUI-54, asserted a few lines below).
  it("ENTRY-8/HEAD-7: / signed in shows the wordmark and the language control, with no avatar and no Sign in, because Cuenta is in the tab bar", () => {
    pathname.mockReturnValue("/");
    useSession.mockReturnValue(SIGNED_IN);
    renderWithI18n(<SiteHeader />);

    const region = phone();
    expect(region.getByRole("link", { name: "BuyCarMap" })).toHaveAttribute("href", "/");
    expect(region.getByRole("group", { name: "Language" })).toBeInTheDocument();
    expect(region.queryByRole("link", { name: "Account" })).not.toBeInTheDocument();
    expect(region.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
  });

  it.each(["/favorites", "/alerts", "/alerts/abc", "/account"])(
    "HEAD-7/MAPUI-54: %s signed in shows the wordmark and the language control and no avatar at phone width, because Cuenta is in the tab bar",
    (route) => {
      pathname.mockReturnValue(route);
      useSession.mockReturnValue(SIGNED_IN);
      renderWithI18n(<SiteHeader />);

      const region = phone();
      expect(region.getByRole("link", { name: "BuyCarMap" })).toHaveAttribute("href", "/");
      expect(region.getByRole("group", { name: "Language" })).toBeInTheDocument();
      expect(region.queryByRole("link", { name: "Account" })).not.toBeInTheDocument();
    },
  );

  it("HEAD-7: / signed out shows Sign in as the phone region's right-hand item", () => {
    pathname.mockReturnValue("/");
    useSession.mockReturnValue(SIGNED_OUT);
    renderWithI18n(<SiteHeader />);

    expect(phone().getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });

  it.each(["/login", "/register"])(
    "HEAD-7: %s shows Map as the phone region's right-hand item",
    (route) => {
      pathname.mockReturnValue(route);
      useSession.mockReturnValue(SIGNED_OUT);
      renderWithI18n(<SiteHeader />);

      expect(phone().getByRole("link", { name: "Map" })).toHaveAttribute("href", "/map");
    },
  );

  it.each(["/privacy", "/terms"])(
    "HEAD-7: %s shows Back as the phone region's right-hand item",
    (route) => {
      pathname.mockReturnValue(route);
      useSession.mockReturnValue(SIGNED_OUT);
      renderWithI18n(<SiteHeader />);

      expect(phone().getByRole("link", { name: "Back" })).toHaveAttribute("href", "/map");
    },
  );
});

describe("SiteHeader — avatar initial", () => {
  it('HEAD-9: "Ada Lovelace" renders the initial A', () => {
    pathname.mockReturnValue("/account");
    useSession.mockReturnValue({
      data: { user: { name: "Ada Lovelace", email: "ada@example.com" } },
      isPending: false,
    });
    renderWithI18n(<SiteHeader />);

    expect(desktop().getByRole("link", { name: "Account" })).toHaveTextContent("A");
  });

  it('HEAD-9: no name, email "beatriz@example.com", renders the initial B', () => {
    pathname.mockReturnValue("/account");
    useSession.mockReturnValue({
      data: { user: { name: null, email: "beatriz@example.com" } },
      isPending: false,
    });
    renderWithI18n(<SiteHeader />);

    expect(desktop().getByRole("link", { name: "Account" })).toHaveTextContent("B");
  });

  it('HEAD-9: name "álvaro" renders the initial Á', () => {
    pathname.mockReturnValue("/account");
    useSession.mockReturnValue({
      data: { user: { name: "álvaro", email: "alvaro@example.com" } },
      isPending: false,
    });
    renderWithI18n(<SiteHeader />);

    expect(desktop().getByRole("link", { name: "Account" })).toHaveTextContent("Á");
  });

  it("NAV-15: a signed-in user with no display name is identified by their email's initial", () => {
    pathname.mockReturnValue("/account");
    useSession.mockReturnValue({
      data: { user: { name: null, email: "beatriz@example.com" } },
      isPending: false,
    });
    renderWithI18n(<SiteHeader />);

    expect(desktop().getByRole("link", { name: "Account" })).toHaveTextContent("B");
  });

  it("HEAD-9: the avatar's accessible name is Account in English", () => {
    pathname.mockReturnValue("/account");
    useSession.mockReturnValue({
      data: { user: { name: "Ada Lovelace", email: "ada@example.com" } },
      isPending: false,
    });
    renderWithI18n(<SiteHeader />);

    expect(desktop().getByRole("link", { name: "Account" })).toBeInTheDocument();
  });

  it("HEAD-9: the avatar's accessible name is Cuenta in Spanish", () => {
    pathname.mockReturnValue("/account");
    useSession.mockReturnValue({
      data: { user: { name: "Ada Lovelace", email: "ada@example.com" } },
      isPending: false,
    });
    renderWithI18n(<SiteHeader />, { locale: "es" });

    expect(
      within(screen.getByTestId("header-desktop")).getByRole("link", { name: "Cuenta" }),
    ).toBeInTheDocument();
  });
});

describe("SiteHeader — session resolving", () => {
  it("HEAD-11: offers no signed-in or signed-out destination while the session resolves, and both regions keep their structure", () => {
    pathname.mockReturnValue("/");
    useSession.mockReturnValue(LOADING);
    renderWithI18n(<SiteHeader />);

    expect(screen.getByTestId("header-desktop")).toBeInTheDocument();
    expect(screen.getByTestId("header-phone")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Create account" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Saved" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Alerts" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Account" })).not.toBeInTheDocument();
  });

  it("NAV-8: offers neither signed-in nor signed-out destinations while the session resolves", () => {
    pathname.mockReturnValue("/");
    useSession.mockReturnValue(LOADING);
    renderWithI18n(<SiteHeader />);

    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Saved" })).not.toBeInTheDocument();
  });

  it("NAV-9: the placeholder keeps the same two-region structure the resolved header has", () => {
    pathname.mockReturnValue("/");
    useSession.mockReturnValue(LOADING);
    const { rerender } = renderWithI18n(<SiteHeader />);

    expect(screen.getByTestId("header-desktop")).toBeInTheDocument();
    expect(screen.getByTestId("header-phone")).toBeInTheDocument();

    useSession.mockReturnValue(SIGNED_OUT);
    rerender(<SiteHeader />);

    expect(screen.getByTestId("header-desktop")).toBeInTheDocument();
    expect(screen.getByTestId("header-phone")).toBeInTheDocument();
  });

  it("HEAD-11: on /map, while the session resolves, the desktop region offers neither Saved, Alerts, the avatar nor Sign in, and holds one placeholder in their place", () => {
    pathname.mockReturnValue("/map");
    useSession.mockReturnValue(LOADING);
    renderWithI18n(<SiteHeader />);

    for (const name of ["Saved", "Alerts", "Account", "Sign in"]) {
      expect(desktop().queryByRole("link", { name })).not.toBeInTheDocument();
    }
    expect(
      screen.getByTestId("header-desktop").querySelectorAll('[data-slot="skeleton"]'),
    ).toHaveLength(1);
  });

  it("HEAD-11: on /favorites, while the session resolves, the desktop region holds four placeholders (Map, Saved, Alerts, avatar) and the phone region one (avatar), with no destination offered", () => {
    pathname.mockReturnValue("/favorites");
    useSession.mockReturnValue(LOADING);
    renderWithI18n(<SiteHeader />);

    for (const name of ["Map", "Saved", "Alerts", "Account", "Sign in"]) {
      expect(screen.queryByRole("link", { name })).not.toBeInTheDocument();
    }
    expect(
      screen.getByTestId("header-desktop").querySelectorAll('[data-slot="skeleton"]'),
    ).toHaveLength(4);
    expect(
      screen.getByTestId("header-phone").querySelectorAll('[data-slot="skeleton"]'),
    ).toHaveLength(1);
  });
});

describe("SiteHeader — session ending underneath the user", () => {
  it("HEAD-12: a session ending switches the header to the signed-out shape of the same page, without a reload", () => {
    pathname.mockReturnValue("/");
    useSession.mockReturnValue(SIGNED_IN);
    const { rerender } = renderWithI18n(<SiteHeader />);

    expect(desktop().getByRole("link", { name: "Saved" })).toBeInTheDocument();

    useSession.mockReturnValue(SIGNED_OUT);
    rerender(<SiteHeader />);

    expect(desktop().queryByRole("link", { name: "Saved" })).not.toBeInTheDocument();
    expect(desktop().getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });
});

describe("SiteHeader — no menu, no dropdown", () => {
  it.each(ALL_ROUTES)("HEAD-14: %s signed in renders no menu trigger, menu or dialog", (route) => {
    pathname.mockReturnValue(route);
    useSession.mockReturnValue(SIGNED_IN);
    renderWithI18n(<SiteHeader />);

    expect(screen.queryByRole("button", { name: /^(menu|menú)$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each(ALL_ROUTES)("HEAD-14: %s signed out renders no menu trigger, menu or dialog", (route) => {
    pathname.mockReturnValue(route);
    useSession.mockReturnValue(SIGNED_OUT);
    renderWithI18n(<SiteHeader />);

    expect(screen.queryByRole("button", { name: /^(menu|menú)$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("SiteHeader — no theme control", () => {
  it("LOOK-5: renders no theme control, in either region", () => {
    pathname.mockReturnValue("/");
    useSession.mockReturnValue(SIGNED_OUT);
    renderWithI18n(<SiteHeader />);

    const THEME_LABEL = /^(dark|light|oscuro|claro)$/i;
    expect(screen.queryByRole("button", { name: THEME_LABEL })).not.toBeInTheDocument();

    const themeAriaLabelled = Array.from(document.body.querySelectorAll("[aria-label]")).filter(
      (element) => /tema|theme/i.test(element.getAttribute("aria-label") ?? ""),
    );
    expect(themeAriaLabelled).toEqual([]);
  });
});

describe("SiteHeader — favorites link reachability", () => {
  it.each(["/map", "/favorites", "/alerts", "/account", "/"])(
    "FAV-17: %s gives a signed-in user a link to Saved in the desktop region",
    (route) => {
      pathname.mockReturnValue(route);
      useSession.mockReturnValue(SIGNED_IN);
      renderWithI18n(<SiteHeader />);

      expect(desktop().getByRole("link", { name: "Saved" })).toHaveAttribute("href", "/favorites");
    },
  );

  it.each(["/map", "/"])("FAV-17: %s gives a signed-out visitor no link to Saved", (route) => {
    pathname.mockReturnValue(route);
    useSession.mockReturnValue(SIGNED_OUT);
    renderWithI18n(<SiteHeader />);

    expect(desktop().queryByRole("link", { name: "Saved" })).not.toBeInTheDocument();
  });
});

describe("SiteHeader — signed-out visitor is offered no guarded destination", () => {
  it.each(["/map", "/"])(
    "NAV-10: %s offers a signed-out visitor no link to Saved or Alerts",
    (route) => {
      pathname.mockReturnValue(route);
      useSession.mockReturnValue(SIGNED_OUT);
      renderWithI18n(<SiteHeader />);

      expect(screen.queryByRole("link", { name: "Saved" })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Alerts" })).not.toBeInTheDocument();
    },
  );
});

describe("SiteHeader — language in the user's language", () => {
  it("NAV-11: names the language group, the avatar and the sections in Spanish", () => {
    pathname.mockReturnValue("/favorites");
    useSession.mockReturnValue({
      data: { user: { name: "Ada Lovelace", email: "ada@example.com" } },
      isPending: false,
    });
    renderWithI18n(<SiteHeader />, { locale: "es" });

    const region = within(screen.getByTestId("header-desktop"));
    expect(region.getByRole("group", { name: "Idioma" })).toBeInTheDocument();
    expect(region.getByRole("link", { name: "Cuenta" })).toBeInTheDocument();
    expect(region.getByRole("link", { name: "Guardados" })).toBeInTheDocument();
    expect(region.getByRole("link", { name: "Alertas" })).toBeInTheDocument();
  });
});

// docs/specs/redesign-alerts.md (ALERTUI-2, ALERTUI-22; amends HEAD-7 and
// MAPUI-54): at phone width /alerts/[id]'s header shows «Volver», a 40px
// round link to /alerts, before the wordmark, and the language control;
// /alerts' shows no «Volver».
// docs/specs/redesign-pages.md (PAGES-66; amends HEAD-6 to HEAD-8). An
// unmatched pathname — the not-found page — is not one of the known access
// routes above (SIGN_IN_LEGAL_ROUTES), so it takes a header that depends on
// the session instead of the fixed access header every one of those routes
// keeps regardless of who is signed in.
describe("SiteHeader — the not-found page (PAGES-66)", () => {
  it("PAGES-66: signed out on an unknown address, the desktop region offers only the wordmark, the language group and Back to map", () => {
    pathname.mockReturnValue("/esto-no-existe");
    useSession.mockReturnValue(SIGNED_OUT);
    renderWithI18n(<SiteHeader />);

    const region = desktop();
    expect(region.getByRole("link", { name: "BuyCarMap" })).toBeInTheDocument();
    expect(region.getByRole("group", { name: "Language" })).toBeInTheDocument();
    expect(region.getByRole("link", { name: "Back to map" })).toHaveAttribute("href", "/map");
    expect(region.queryByRole("link", { name: "Saved" })).not.toBeInTheDocument();
    expect(region.queryByRole("link", { name: "Account" })).not.toBeInTheDocument();
  });

  it("PAGES-66: signed out on an unknown address, the phone region's right-hand item is Map", () => {
    pathname.mockReturnValue("/esto-no-existe");
    useSession.mockReturnValue(SIGNED_OUT);
    renderWithI18n(<SiteHeader />);

    expect(phone().getByRole("link", { name: "Map" })).toHaveAttribute("href", "/map");
  });

  it("PAGES-66: signed in on an unknown address, the desktop region offers Map, Saved, Alerts and the avatar, with no current destination", () => {
    pathname.mockReturnValue("/esto-no-existe");
    useSession.mockReturnValue(SIGNED_IN);
    renderWithI18n(<SiteHeader />);

    const region = desktop();
    expect(region.getByRole("link", { name: "Map" })).toHaveAttribute("href", "/map");
    expect(region.getByRole("link", { name: "Saved" })).toHaveAttribute("href", "/favorites");
    expect(region.getByRole("link", { name: "Alerts" })).toHaveAttribute("href", "/alerts");
    expect(region.getByRole("link", { name: "Account" })).toHaveAttribute("href", "/account");
    const current = region
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(0);
  });

  it("PAGES-66: while the session resolves on an unknown address, neither header shows: the pending boxes stand in", () => {
    pathname.mockReturnValue("/esto-no-existe");
    useSession.mockReturnValue({ data: null, isPending: true });
    renderWithI18n(<SiteHeader />);

    const region = desktop();
    expect(region.getByRole("link", { name: "BuyCarMap" })).toBeInTheDocument();
    expect(region.queryByRole("link", { name: "Back to map" })).not.toBeInTheDocument();
    expect(region.queryByRole("link", { name: "Saved" })).not.toBeInTheDocument();
    expect(region.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
    expect(phone().queryByRole("link", { name: "Map" })).not.toBeInTheDocument();
  });

  it("PAGES-66: a known access route (e.g. /register) keeps the access header regardless of session, unlike an unknown address", () => {
    pathname.mockReturnValue("/register");
    useSession.mockReturnValue(SIGNED_IN);
    renderWithI18n(<SiteHeader />);

    const region = desktop();
    expect(region.getByRole("link", { name: "Back to map" })).toHaveAttribute("href", "/map");
    expect(region.queryByRole("link", { name: "Saved" })).not.toBeInTheDocument();
  });
});

describe("SiteHeader — the alert page's «Volver» at phone width", () => {
  it("ALERTUI-22: /alerts/<id> shows «Volver» to /alerts before the wordmark, and the language control", () => {
    pathname.mockReturnValue("/alerts/0199a000-0000-7000-8000-00000000c001");
    useSession.mockReturnValue(SIGNED_IN);
    renderWithI18n(<SiteHeader />, { locale: "es" });

    const region = phone();
    const back = region.getByRole("link", { name: "Volver" });
    expect(back).toHaveAttribute("href", "/alerts");
    expect(back).toHaveClass("size-10", "rounded-full");
    const wordmark = region.getByRole("link", { name: "BuyCarMap" });
    expect(
      back.compareDocumentPosition(wordmark) & Node.DOCUMENT_POSITION_FOLLOWING,
      "«Volver» before the wordmark",
    ).toBeTruthy();
    expect(region.getByRole("group", { name: "Idioma" })).toBeInTheDocument();
  });

  it("ALERTUI-2: /alerts shows no «Volver»", () => {
    pathname.mockReturnValue("/alerts");
    useSession.mockReturnValue(SIGNED_IN);
    renderWithI18n(<SiteHeader />, { locale: "es" });

    expect(phone().queryByRole("link", { name: "Volver" })).not.toBeInTheDocument();
    expect(phone().getByRole("link", { name: "BuyCarMap" })).toBeInTheDocument();
  });
});
