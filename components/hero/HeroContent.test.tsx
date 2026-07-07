import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "@/test/utils/render";
import { HeroContent } from "./HeroContent";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const searchButton = () => screen.getByRole("button", { name: "Search" });

describe("HeroContent search", () => {
  beforeEach(() => push.mockReset());

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
