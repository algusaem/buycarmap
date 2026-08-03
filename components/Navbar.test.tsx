import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "@/test/utils/render";

// renderWithI18n mounts I18nProvider, which uses the app router.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const useSession = vi.fn();
const signOut = vi.fn();
vi.mock("next-auth/react", () => ({
  useSession: () => useSession(),
  signOut: (...args: unknown[]) => signOut(...args),
}));

// These children own theme/locale state and their own providers; stub them so
// the test focuses on the navbar's auth controls.
vi.mock("./ThemeSwitcher", () => ({ ThemeSwitcher: () => null }));
vi.mock("./LanguageSwitcher", () => ({ LanguageSwitcher: () => null }));

import { Navbar } from "./Navbar";

describe("Navbar auth controls", () => {
  beforeEach(() => {
    useSession.mockReset();
    signOut.mockReset();
  });

  it("shows neither sign-in nor sign-out while the session is loading", () => {
    useSession.mockReturnValue({ data: null, status: "loading" });
    renderWithI18n(<Navbar />);

    expect(
      screen.queryByRole("link", { name: /sign in/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /sign out/i }),
    ).not.toBeInTheDocument();
  });

  it("offers sign in and sign up when logged out", () => {
    useSession.mockReturnValue({ data: null, status: "unauthenticated" });
    renderWithI18n(<Navbar />);

    expect(screen.getByRole("link", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign up/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /sign out/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the user's name and signs out on click when logged in", async () => {
    useSession.mockReturnValue({
      data: { user: { name: "Ada Lovelace", email: "ada@example.com" } },
      status: "authenticated",
    });
    renderWithI18n(<Navbar />);

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /sign in/i }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/" });
  });

  it("falls back to the email when the user has no name", () => {
    useSession.mockReturnValue({
      data: { user: { name: null, email: "ada@example.com" } },
      status: "authenticated",
    });
    renderWithI18n(<Navbar />);

    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
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
