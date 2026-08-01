import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "@/test/utils/render";
import { HeroContent } from "./HeroContent";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

// The sign-in CTA is session-aware, so the component now reads useSession.
const useSession = vi.fn();
vi.mock("next-auth/react", () => ({
  useSession: () => useSession(),
}));

const searchButton = () => screen.getByRole("button", { name: "Search" });
const signInCta = () =>
  screen.queryByRole("link", { name: /Sign in to save searches/i });

describe("HeroContent search", () => {
  beforeEach(() => {
    push.mockReset();
    useSession.mockReturnValue({ data: null, status: "unauthenticated" });
  });

  it("navigates to the map with the typed query as a param", async () => {
    renderWithI18n(<HeroContent />);

    await userEvent.type(screen.getByRole("textbox"), "golf");
    await userEvent.click(searchButton());

    expect(push).toHaveBeenCalledWith("/map?q=golf");
  });

  it("url-encodes multi-word queries", async () => {
    renderWithI18n(<HeroContent />);

    await userEvent.type(screen.getByRole("textbox"), "BMW Serie 3");
    await userEvent.click(searchButton());

    // encodeURIComponent turns spaces into %20.
    expect(push).toHaveBeenCalledWith("/map?q=BMW%20Serie%203");
  });

  it("navigates to the bare map when the query is blank", async () => {
    renderWithI18n(<HeroContent />);

    await userEvent.type(screen.getByRole("textbox"), "   ");
    await userEvent.click(searchButton());

    // Whitespace trims to empty, so no query param is appended.
    expect(push).toHaveBeenCalledWith("/map");
  });

  it("searches immediately when a popular chip is clicked", async () => {
    renderWithI18n(<HeroContent />);

    await userEvent.click(
      screen.getByRole("button", { name: "Seat León" }),
    );

    expect(push).toHaveBeenCalledWith("/map?q=Seat%20Le%C3%B3n");
  });
});

describe("HeroContent sign-in call to action", () => {
  beforeEach(() => push.mockReset());

  it("invites a signed-out visitor to sign in", () => {
    useSession.mockReturnValue({ data: null, status: "unauthenticated" });
    renderWithI18n(<HeroContent />);

    expect(signInCta()).toBeInTheDocument();
  });

  it("hides the invitation once the visitor is signed in", () => {
    // "Sign in to save searches" shown to someone already signed in reads as a
    // broken page, not as a prompt.
    useSession.mockReturnValue({
      data: { user: { id: "u1", email: "ada@example.com" } },
      status: "authenticated",
    });
    renderWithI18n(<HeroContent />);

    expect(signInCta()).not.toBeInTheDocument();
  });

  it("hides the invitation while the session is still loading", () => {
    // Rendering it during loading and pulling it away a moment later is a
    // visible flicker on every page load for signed-in users.
    useSession.mockReturnValue({ data: null, status: "loading" });
    renderWithI18n(<HeroContent />);

    expect(signInCta()).not.toBeInTheDocument();
  });

  it("keeps the explore-map action in every session state", () => {
    for (const status of ["unauthenticated", "authenticated", "loading"]) {
      useSession.mockReturnValue({ data: null, status });
      const { unmount } = renderWithI18n(<HeroContent />);

      expect(
        screen.getByRole("link", { name: /Explore the map/i }),
      ).toBeInTheDocument();
      unmount();
    }
  });
});
