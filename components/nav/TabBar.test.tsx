import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { setResultsSheetFull } from "@/lib/hooks/useResultsSheetFull";

const pathname = vi.fn(() => "/map");
vi.mock("next/navigation", () => ({
  usePathname: () => pathname(),
}));

const useSession = vi.fn();
vi.mock("@/lib/auth/auth-client", () => ({
  authClient: { useSession: () => useSession() },
}));

import { TabBar } from "./TabBar";

// The bar pads itself with `pb-safe-bottom`; jsdom computes no CSS, so the
// token's own definition is read from app/globals.css (MAPUI-52, HEAD-17).
const SAFE_BOTTOM_TOKEN = /--spacing-safe-bottom:\s*([^;]+);/.exec(
  readFileSync(join(__dirname, "..", "..", "app", "globals.css"), "utf-8"),
)?.[1];

const SIGNED_IN = {
  data: { user: { name: "Ada Lovelace", email: "ada@example.com" } },
  isPending: false,
};
const SIGNED_OUT = { data: null, isPending: false };

beforeEach(() => {
  pathname.mockReturnValue("/map");
  useSession.mockReturnValue(SIGNED_IN);
  window.scrollY = 0;
});

// The sheet's position is a module-level store the map page writes; reset it
// so no case leaks a full sheet into the next.
afterEach(() => {
  act(() => setResultsSheetFull(false));
});

describe("MAPUI-52: TabBar — signed in", () => {
  it.each(["/map", "/favorites", "/alerts", "/alerts/abc", "/account"])(
    "MAPUI-52: renders Mapa, Guardados, Alertas and Cuenta on %s",
    (route) => {
      pathname.mockReturnValue(route);
      renderWithI18n(<TabBar />, { locale: "es" });

      expect(screen.getByRole("link", { name: /Mapa/ })).toHaveAttribute("href", "/map");
      expect(screen.getByRole("link", { name: /Guardados/ })).toHaveAttribute("href", "/favorites");
      expect(screen.getByRole("link", { name: /Alertas/ })).toHaveAttribute("href", "/alerts");
      expect(screen.getByRole("link", { name: /Cuenta/ })).toHaveAttribute("href", "/account");
    },
  );

  it("MAPUI-52: Cuenta shows the avatar's initial", () => {
    renderWithI18n(<TabBar />, { locale: "es" });

    expect(screen.getByRole("link", { name: /Cuenta/ })).toHaveTextContent("A");
  });

  it("MAPUI-52: /alerts/abc marks Alertas current", () => {
    pathname.mockReturnValue("/alerts/abc");
    renderWithI18n(<TabBar />, { locale: "es" });

    expect(screen.getByRole("link", { name: /Alertas/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Mapa/ })).not.toHaveAttribute("aria-current");
  });

  // Amended by docs/specs/redesign-saved.md (SAVED-33, Decisions › The current
  // tab's label in the text colour): the current tab's icon stays violet and
  // its label takes the text colour at weight 800; the others stay muted.
  it("MAPUI-52: on /favorites, signed in, «Guardados» is current, violet at weight 800 with its label in the text colour, and «Mapa» stays muted", () => {
    pathname.mockReturnValue("/favorites");
    renderWithI18n(<TabBar />, { locale: "es" });

    const saved = screen.getByRole("link", { name: /Guardados/ });
    expect(saved).toHaveAttribute("aria-current", "page");
    expect(saved).toHaveClass("text-violet", "font-extrabold");
    expect(screen.getByText("Guardados")).toHaveClass("text-text");

    const map = screen.getByRole("link", { name: /Mapa/ });
    expect(map).not.toHaveAttribute("aria-current");
    expect(map).toHaveClass("text-text-muted");
    expect(screen.getByText("Mapa")).not.toHaveClass("text-text");
  });

  it("MAPUI-52: /map marks Mapa current, and nothing else", () => {
    renderWithI18n(<TabBar />, { locale: "es" });

    const current = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAccessibleName(/Mapa/);
  });
});

describe("MAPUI-52: TabBar — signed out on the map", () => {
  it("MAPUI-52: renders only Mapa and Entrar", () => {
    useSession.mockReturnValue(SIGNED_OUT);
    renderWithI18n(<TabBar />, { locale: "es" });

    expect(screen.getByRole("link", { name: /Mapa/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Entrar/ })).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("link", { name: /Guardados/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Alertas/ })).not.toBeInTheDocument();
  });
});

describe("MAPUI-52: TabBar — safe area", () => {
  it("MAPUI-52: the bar is padded by the safe-bottom token, defined as env(safe-area-inset-bottom)", () => {
    renderWithI18n(<TabBar />);

    expect(screen.getByRole("navigation")).toHaveClass("pb-safe-bottom");
    expect(SAFE_BOTTOM_TOKEN).toBe("env(safe-area-inset-bottom)");
  });
});

describe("MAPUI-53: TabBar — hides and comes back", () => {
  it("MAPUI-53: hides while the map's results sheet is full", () => {
    renderWithI18n(<TabBar />);

    act(() => setResultsSheetFull(true));

    expect(screen.getByRole("navigation", { hidden: true })).toHaveAttribute("aria-hidden", "true");
  });

  it("MAPUI-53: shows again once the sheet leaves full", () => {
    renderWithI18n(<TabBar />);
    act(() => setResultsSheetFull(true));
    expect(screen.getByRole("navigation", { hidden: true })).toHaveAttribute("aria-hidden", "true");

    act(() => setResultsSheetFull(false));

    expect(screen.getByRole("navigation", { hidden: true })).toHaveAttribute(
      "aria-hidden",
      "false",
    );
  });

  it("MAPUI-53: hides on scrolling down", () => {
    // MAPUI-53: on /map only the results sheet going full may hide the bar —
    // a plain scroll is covered on a signed-in section page instead.
    pathname.mockReturnValue("/favorites");
    renderWithI18n(<TabBar />);

    window.scrollY = 400;
    fireEvent.scroll(window);

    expect(screen.getByRole("navigation", { hidden: true })).toHaveAttribute("aria-hidden", "true");
  });

  it("MAPUI-53: comes back on scrolling up", () => {
    // On a section page, where scrolling down hides it first (on /map it never would).
    pathname.mockReturnValue("/favorites");
    renderWithI18n(<TabBar />);

    window.scrollY = 400;
    fireEvent.scroll(window);
    expect(screen.getByRole("navigation", { hidden: true })).toHaveAttribute("aria-hidden", "true");
    window.scrollY = 200;
    fireEvent.scroll(window);

    expect(screen.getByRole("navigation", { hidden: true })).toHaveAttribute(
      "aria-hidden",
      "false",
    );
  });
});

// docs/specs/redesign-map.md (MAPUI-53, bug fix). useHideOnScrollDown listens
// to every scroll event bubbling up to `window` in the capture phase, so
// panning the map or scrolling the results sheet on /map fired it too — the
// tab bar hid itself mid-pan. On /map only the results sheet going full may
// hide it; the plain scroll-down/scroll-up behaviour stays for the signed-in
// section pages.
describe("MAPUI-53: TabBar on /map — only the full sheet may hide it (bug fix)", () => {
  it("MAPUI-53: a scroll event on /map does not hide it", () => {
    pathname.mockReturnValue("/map");
    renderWithI18n(<TabBar />);

    window.scrollY = 400;
    fireEvent.scroll(window);

    expect(screen.getByRole("navigation", { hidden: true })).toHaveAttribute(
      "aria-hidden",
      "false",
    );
  });

  it("MAPUI-53: on /map, the sheet going full still hides it regardless of scroll", () => {
    pathname.mockReturnValue("/map");
    renderWithI18n(<TabBar />);
    act(() => setResultsSheetFull(true));

    window.scrollY = 400;
    fireEvent.scroll(window);

    expect(screen.getByRole("navigation", { hidden: true })).toHaveAttribute("aria-hidden", "true");
  });

  it("MAPUI-53: on a signed-in section page, scrolling down still hides it and scrolling up still shows it", () => {
    pathname.mockReturnValue("/favorites");
    renderWithI18n(<TabBar />);

    window.scrollY = 400;
    fireEvent.scroll(window);
    expect(screen.getByRole("navigation", { hidden: true })).toHaveAttribute("aria-hidden", "true");

    window.scrollY = 200;
    fireEvent.scroll(window);
    expect(screen.getByRole("navigation", { hidden: true })).toHaveAttribute(
      "aria-hidden",
      "false",
    );
  });

  // useHideOnScrollDown's scroll position (lib/hooks/useHideOnScrollDown.ts)
  // reads `target.scrollTop` for an Element target, `window.scrollY` only for
  // `window` — a section page's own page scroller is an element, not the
  // window, so this is the shape of scroll that actually applies there.
  it("MAPUI-53: a scrollable element's own scrollTop increasing to 400 hides it", () => {
    pathname.mockReturnValue("/favorites");
    renderWithI18n(
      <>
        <div data-testid="scrollable" />
        <TabBar />
      </>,
    );
    const scrollable = screen.getByTestId("scrollable");

    Object.defineProperty(scrollable, "scrollTop", { value: 400, writable: true });
    fireEvent.scroll(scrollable);

    expect(screen.getByRole("navigation", { hidden: true })).toHaveAttribute("aria-hidden", "true");
  });

  it("MAPUI-53: that element's scrollTop then decreasing to 200 shows it again", () => {
    pathname.mockReturnValue("/favorites");
    renderWithI18n(
      <>
        <div data-testid="scrollable" />
        <TabBar />
      </>,
    );
    const scrollable = screen.getByTestId("scrollable");

    Object.defineProperty(scrollable, "scrollTop", { value: 400, writable: true });
    fireEvent.scroll(scrollable);
    expect(screen.getByRole("navigation", { hidden: true })).toHaveAttribute("aria-hidden", "true");

    Object.defineProperty(scrollable, "scrollTop", { value: 200, writable: true });
    fireEvent.scroll(scrollable);

    expect(screen.getByRole("navigation", { hidden: true })).toHaveAttribute(
      "aria-hidden",
      "false",
    );
  });
});

// docs/specs/redesign-navigation.md (HEAD-8, HEAD-17, both amended by
// MAPUI-52). Moved here from the removed BottomNav's test file: the tab bar
// is the component those criteria now bind. English labels, since
// renderWithI18n renders the English locale by default.
describe("HEAD-8: the tab bar applies", () => {
  it.each(["/favorites", "/alerts", "/alerts/abc", "/account"])(
    "HEAD-8: signed in on %s offers Map, Saved, Alerts and Account",
    (route) => {
      pathname.mockReturnValue(route);
      renderWithI18n(<TabBar />);

      expect(screen.getByRole("link", { name: "Map" })).toHaveAttribute("href", "/map");
      expect(screen.getByRole("link", { name: "Saved" })).toHaveAttribute("href", "/favorites");
      expect(screen.getByRole("link", { name: "Alerts" })).toHaveAttribute("href", "/alerts");
      expect(screen.getByRole("link", { name: "Account" })).toHaveAttribute("href", "/account");
    },
  );

  it("HEAD-8: /favorites marks Saved current, and nothing else", () => {
    pathname.mockReturnValue("/favorites");
    renderWithI18n(<TabBar />);

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
      renderWithI18n(<TabBar />);

      const current = screen
        .getAllByRole("link")
        .filter((link) => link.getAttribute("aria-current") === "page");
      expect(current).toHaveLength(1);
      expect(current[0]).toHaveAccessibleName("Alerts");
    },
  );

  it("HEAD-8: /account marks Account current, and nothing else", () => {
    pathname.mockReturnValue("/account");
    renderWithI18n(<TabBar />);

    const current = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAccessibleName("Account");
  });

  it("HEAD-8: signed out on /map offers Map and Sign in", () => {
    useSession.mockReturnValue(SIGNED_OUT);
    renderWithI18n(<TabBar />);

    expect(screen.getByRole("link", { name: "Map" })).toHaveAttribute("href", "/map");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("HEAD-8: the nav landmark is named Principal in Spanish", () => {
    pathname.mockReturnValue("/favorites");
    renderWithI18n(<TabBar />, { locale: "es" });

    expect(screen.getByRole("navigation", { name: "Principal" })).toBeInTheDocument();
  });
});

describe("HEAD-8: the tab bar does not apply", () => {
  it("HEAD-8: renders nothing on /favorites when signed out", () => {
    pathname.mockReturnValue("/favorites");
    useSession.mockReturnValue(SIGNED_OUT);
    const { container } = renderWithI18n(<TabBar />);

    expect(container).toBeEmptyDOMElement();
  });

  // "/" removed from this signed-in list (amended by ENTRY-8,
  // docs/specs/redesign-entry.md): the signed-in landing now shows the tab
  // bar too (MAPUI-52's own amendment below). It stays in the signed-out
  // list underneath — ENTRY-8 keeps the landing tab-bar-free when signed out.
  it.each(["/login", "/privacy"])("HEAD-8: renders nothing on %s, signed in", (route) => {
    pathname.mockReturnValue(route);
    const { container } = renderWithI18n(<TabBar />);

    expect(container).toBeEmptyDOMElement();
  });

  it.each(["/", "/login", "/privacy"])("HEAD-8: renders nothing on %s, signed out", (route) => {
    pathname.mockReturnValue(route);
    useSession.mockReturnValue(SIGNED_OUT);
    const { container } = renderWithI18n(<TabBar />);

    expect(container).toBeEmptyDOMElement();
  });
});

// docs/specs/redesign-entry.md (ENTRY-8). Amends MAPUI-52: the signed-in
// landing joins the tab bar's routes (nav-routes.ts's showsTabBar returns
// true for "/" once the caller is signed in, alongside "/map" and the
// signed-in section pages), with none of its four tabs marked current.
describe("ENTRY-8: TabBar — the signed-in landing", () => {
  it("ENTRY-8: / signed in shows Mapa, Guardados, Alertas and Cuenta", () => {
    pathname.mockReturnValue("/");
    useSession.mockReturnValue(SIGNED_IN);
    renderWithI18n(<TabBar />, { locale: "es" });

    expect(screen.getByRole("link", { name: /Mapa/ })).toHaveAttribute("href", "/map");
    expect(screen.getByRole("link", { name: /Guardados/ })).toHaveAttribute("href", "/favorites");
    expect(screen.getByRole("link", { name: /Alertas/ })).toHaveAttribute("href", "/alerts");
    expect(screen.getByRole("link", { name: /Cuenta/ })).toHaveAttribute("href", "/account");
  });

  it("ENTRY-8: / signed in marks none of the four tabs current", () => {
    pathname.mockReturnValue("/");
    useSession.mockReturnValue(SIGNED_IN);
    renderWithI18n(<TabBar />, { locale: "es" });

    const current = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(0);
  });

  it("ENTRY-8: / signed out still shows no tab bar", () => {
    pathname.mockReturnValue("/");
    useSession.mockReturnValue(SIGNED_OUT);
    const { container } = renderWithI18n(<TabBar />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe("MAPUI-52: TabBar — accessibility", () => {
  it("MAPUI-52: the signed-in bar on /map has no axe violations", async () => {
    const { container } = renderWithI18n(<TabBar />, { locale: "es" });

    expect(await axe(container)).toHaveNoViolations();
  });
});

// docs/specs/redesign-pages.md (PAGES-66; amends HEAD-6 to HEAD-8). An
// unmatched pathname (the not-found page) shows the tab bar when signed in,
// with none of its tabs current — unlike every known route without a tab bar
// of its own (e.g. /login, /privacy), which stays tab-bar-free regardless of
// session (HEAD-8: "the tab bar does not apply", above).
describe("TabBar — the not-found page (PAGES-66)", () => {
  it("PAGES-66: signed in on an unknown address, shows Map, Saved, Alerts and Account, with none current", () => {
    pathname.mockReturnValue("/esto-no-existe");
    useSession.mockReturnValue(SIGNED_IN);
    renderWithI18n(<TabBar />);

    expect(screen.getByRole("link", { name: "Map" })).toHaveAttribute("href", "/map");
    expect(screen.getByRole("link", { name: "Saved" })).toHaveAttribute("href", "/favorites");
    expect(screen.getByRole("link", { name: "Alerts" })).toHaveAttribute("href", "/alerts");
    expect(screen.getByRole("link", { name: "Account" })).toHaveAttribute("href", "/account");
    const current = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(0);
  });

  it("PAGES-66: signed out on an unknown address, shows no tab bar", () => {
    pathname.mockReturnValue("/esto-no-existe");
    useSession.mockReturnValue(SIGNED_OUT);
    const { container } = renderWithI18n(<TabBar />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe("HEAD-17: the tab bar clears the safe area", () => {
  it(// jsdom computes no CSS, so this only proves the string-level contract:
  // the nav carries the token's class, and the token is the inset. HEAD-17
  // is a "component" criterion (docs/specs/redesign-navigation.md), with no
  // e2e counterpart asserting the real computed offset in a browser.
  "HEAD-17: the nav is padded by the safe-bottom token, defined as env(safe-area-inset-bottom)", () => {
    pathname.mockReturnValue("/favorites");
    renderWithI18n(<TabBar />);

    expect(screen.getByRole("navigation")).toHaveClass("pb-safe-bottom");
    expect(SAFE_BOTTOM_TOKEN).toBe("env(safe-area-inset-bottom)");
  });
});
