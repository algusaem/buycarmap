import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent, { UserEvent } from "@testing-library/user-event";
import { I18nProvider } from "@/lib/i18n/client";
import { renderWithI18n } from "@/test/utils/render";

// NAV-7 reads the current route to mark the active destination, so the pathname
// is controllable rather than fixed.
const pathname = vi.fn(() => "/");
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => pathname(),
}));

const useSession = vi.fn();
const signOut = vi.fn();
vi.mock("next-auth/react", () => ({
  useSession: () => useSession(),
  signOut: (...args: unknown[]) => signOut(...args),
}));

// Stubbed as findable controls rather than as null. These components own their
// own state and are specified by cross-cutting.md (CORE-5, CORE-10); what NAV-14
// asserts is *where the navbar puts them*, which needs them to be queryable.
vi.mock("./ThemeSwitcher", () => ({
  ThemeSwitcher: () => <button type="button">Dark</button>,
}));
vi.mock("./LanguageSwitcher", () => ({
  LanguageSwitcher: () => <button type="button">EN</button>,
}));

import { Navbar } from "./Navbar";

const SIGNED_IN = {
  data: { user: { name: "Ada Lovelace", email: "ada@example.com" } },
  status: "authenticated",
};
const SIGNED_OUT = { data: null, status: "unauthenticated" };
const LOADING = { data: null, status: "loading" };

// The collapsed menu on mobile: a Dialog, so its contents exist only while open.
// That is what keeps a closed navbar from rendering every link twice in jsdom —
// see the spec's "Breakpoints stay in CSS" decision.
const menuTrigger = () => screen.getByRole("button", { name: /^menu$/i });

// The desktop account dropdown, labelled by whoever is signed in.
const accountTrigger = () =>
  screen.getByRole("button", { name: /ada lovelace|ada@example\.com/i });

async function openMenu(user: UserEvent) {
  await user.click(menuTrigger());
  return within(await screen.findByRole("dialog"));
}

async function openAccountMenu(user: UserEvent) {
  await user.click(accountTrigger());
  return within(await screen.findByRole("menu"));
}

beforeEach(() => {
  useSession.mockReset();
  signOut.mockReset();
  pathname.mockReturnValue("/");
});

describe("Navbar destinations", () => {
  it("NAV-1: offers both signing in and registering from the menu when signed out", async () => {
    const user = userEvent.setup();
    useSession.mockReturnValue(SIGNED_OUT);
    renderWithI18n(<Navbar />);

    const menu = await openMenu(user);

    expect(menu.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(menu.getByRole("link", { name: /sign up/i })).toHaveAttribute(
      "href",
      "/register",
    );
  });

  // NAV-17 is deliberately absent here and lives in e2e/navbar.spec.ts. The
  // defect it covers is `hidden sm:inline-flex` on the register link, and jsdom
  // applies no CSS — the element is in the DOM either way, so a component test
  // would pass against the broken code it exists to catch.

  it("NAV-3: offers saved cars, alerts, account and sign out from the menu when signed in", async () => {
    const user = userEvent.setup();
    useSession.mockReturnValue(SIGNED_IN);
    renderWithI18n(<Navbar />);

    const menu = await openMenu(user);

    expect(menu.getByRole("link", { name: /saved cars/i })).toHaveAttribute(
      "href",
      "/favorites",
    );
    expect(menu.getByRole("link", { name: /alerts/i })).toHaveAttribute(
      "href",
      "/alerts",
    );
    expect(menu.getByRole("link", { name: /account/i })).toHaveAttribute(
      "href",
      "/account",
    );
    expect(menu.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });

  it("NAV-10: offers a signed-out visitor no route to saved cars or alerts", async () => {
    const user = userEvent.setup();
    useSession.mockReturnValue(SIGNED_OUT);
    renderWithI18n(<Navbar />);

    // Not an access-control assertion — both pages are guarded server-side.
    // These links would lead a visitor to a sign-in redirect, which is a dead
    // end dressed as a destination.
    expect(
      screen.queryByRole("link", { name: /saved cars/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /alerts/i }),
    ).not.toBeInTheDocument();

    const menu = await openMenu(user);
    expect(
      menu.queryByRole("link", { name: /saved cars/i }),
    ).not.toBeInTheDocument();
    expect(
      menu.queryByRole("link", { name: /alerts/i }),
    ).not.toBeInTheDocument();
  });

  it("NAV-14: puts the theme and language controls inside the menu", async () => {
    const user = userEvent.setup();
    useSession.mockReturnValue(SIGNED_OUT);
    renderWithI18n(<Navbar />);

    const menu = await openMenu(user);

    expect(menu.getByRole("button", { name: "Dark" })).toBeInTheDocument();
    expect(menu.getByRole("button", { name: "EN" })).toBeInTheDocument();
  });
});

describe("Navbar menu behaviour", () => {
  it("NAV-4: closes on Escape and returns focus to the control that opened it", async () => {
    const user = userEvent.setup();
    useSession.mockReturnValue(SIGNED_IN);
    renderWithI18n(<Navbar />);

    const trigger = menuTrigger();
    await user.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // Dropping focus to <body> strands a keyboard user at the top of the
    // document with no way back to where they were.
    expect(trigger).toHaveFocus();
  });

  it("NAV-12: opens from the keyboard alone and moves focus into itself", async () => {
    const user = userEvent.setup();
    useSession.mockReturnValue(SIGNED_IN);
    renderWithI18n(<Navbar />);

    menuTrigger().focus();
    await user.keyboard("{Enter}");

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it("NAV-5: closes when the route changes, so it cannot cover the page just opened", async () => {
    const user = userEvent.setup();
    useSession.mockReturnValue(SIGNED_IN);
    const { rerender } = renderWithI18n(<Navbar />);

    await openMenu(user);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Asserted through the route change rather than by clicking the link:
    // navigation is client-side, so the panel stays mounted across it unless
    // something closes it, and the pathname is the signal that it happened.
    pathname.mockReturnValue("/favorites");
    rerender(<Navbar />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("NAV-16: stops offering signed-in destinations when the session ends underneath it", async () => {
    const user = userEvent.setup();
    useSession.mockReturnValue(SIGNED_IN);
    const { rerender } = renderWithI18n(<Navbar />);

    const menu = await openMenu(user);
    expect(menu.getByRole("button", { name: /sign out/i })).toBeInTheDocument();

    // Revocation elsewhere, an expired token, or a sign-out in another tab.
    useSession.mockReturnValue(SIGNED_OUT);
    rerender(<Navbar />);

    expect(
      screen.queryByRole("button", { name: /sign out/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /account/i }),
    ).not.toBeInTheDocument();
  });
});

describe("Navbar session states", () => {
  it("NAV-8: offers neither signed-in nor signed-out destinations while the session resolves", () => {
    useSession.mockReturnValue(LOADING);
    renderWithI18n(<Navbar />);

    expect(
      screen.queryByRole("link", { name: /sign in/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /sign up/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /sign out/i }),
    ).not.toBeInTheDocument();
  });

  it("NAV-6: signs out and returns to the home page", async () => {
    const user = userEvent.setup();
    useSession.mockReturnValue(SIGNED_IN);
    renderWithI18n(<Navbar />);

    const menu = await openAccountMenu(user);
    await user.click(menu.getByRole("menuitem", { name: /sign out/i }));

    // "/" and not the current page: the page they were on may be guarded, and
    // landing on a sign-in redirect immediately after signing out reads as the
    // sign-out having failed.
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/" });
  });

  it("NAV-18: lets the language be chosen from the account menu with the keyboard alone", async () => {
    const user = userEvent.setup();
    useSession.mockReturnValue(SIGNED_IN);
    renderWithI18n(<Navbar />);

    // Keyboard only, because that is precisely what the first implementation
    // broke: the switcher was nested inside a plain menu item, so arrow keys
    // landed on the item and Enter fired the item's own onSelect. The control
    // was reachable by mouse and unreachable by anything else.
    accountTrigger().focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("menu");

    expect(
      screen.getByRole("menuitemradio", { name: "English" }),
    ).toBeChecked();

    // Arrow-keyed rather than focused directly. Focusing the option by hand
    // would sidestep the menu's own keyboard model, which is the thing that
    // was broken — the assertion has to travel the route a user travels.
    // Account is focused on open; the two languages follow it.
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(screen.getByRole("menuitemradio", { name: "Español" })).toHaveFocus();

    await user.keyboard("{Enter}");

    // The cookie is what getLocale() reads on the next server render, so it is
    // the whole mechanism by which the choice outlives the page.
    expect(document.cookie).toContain("locale=es");
  });

  it("NAV-15: identifies a user with no display name by their email address", () => {
    useSession.mockReturnValue({
      data: { user: { name: null, email: "ada@example.com" } },
      status: "authenticated",
    });
    renderWithI18n(<Navbar />);

    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
  });
});

describe("Navbar current page", () => {
  it("NAV-7: marks the destination matching the current page, and marks no other", () => {
    useSession.mockReturnValue(SIGNED_IN);
    pathname.mockReturnValue("/favorites");
    renderWithI18n(<Navbar />);

    // aria-current rather than colour alone: a colour change is invisible to a
    // screen reader and fails the project's rule against colour-only status.
    expect(screen.getByRole("link", { name: /saved cars/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: /alerts/i }),
    ).not.toHaveAttribute("aria-current");
  });
});

describe("Navbar language", () => {
  it("NAV-11: names the menu trigger in the user's language", () => {
    useSession.mockReturnValue(SIGNED_OUT);
    // Spanish is the default locale, so an English-only key reaches most users.
    // The contract this asserts: a `nav.menu` key exists in both locales, with
    // the Spanish value "Menú".
    render(<Navbar />, {
      wrapper: ({ children }) => (
        <I18nProvider locale="es">{children}</I18nProvider>
      ),
    });

    expect(screen.getByRole("button", { name: "Menú" })).toBeInTheDocument();
  });
});

describe("Navbar favorites link", () => {
  beforeEach(() => useSession.mockReset());

  it("FAV-17: gives a signed-in user a way to reach their saved cars", () => {
    useSession.mockReturnValue({
      data: { user: { email: "ada@example.com", name: "Ada" } },
      status: "authenticated",
    });

    renderWithI18n(<Navbar />);

    // A real link, not a click handler: Cmd/middle-click has to work.
    expect(screen.getByRole("link", { name: /saved cars/i })).toHaveAttribute(
      "href",
      "/favorites",
    );
  });

  it("FAV-17: does not offer it to a signed-out visitor", () => {
    useSession.mockReturnValue({ data: null, status: "unauthenticated" });

    renderWithI18n(<Navbar />);

    // The page is guarded, so the link would only bounce them to sign-in.
    expect(
      screen.queryByRole("link", { name: /saved cars/i }),
    ).not.toBeInTheDocument();
  });
});
