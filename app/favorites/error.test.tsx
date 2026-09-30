import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "@/test/utils/render";

// I18nProvider calls useRouter() for its locale-switch refresh.
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
  usePathname: () => "/favorites",
}));

import FavoritesError from "./error";

// PLAT-14 (docs/specs/core-platform.md): /favorites gets an error.tsx that
// shows a translated message and a retry button, instead of the read
// silently turning into an empty list (issue #48).

describe("FavoritesError", () => {
  it("PLAT-14: shows a retry control that calls reset", async () => {
    const reset = vi.fn();
    renderWithI18n(<FavoritesError error={new Error("x")} reset={reset} />);

    const retry = screen.getByRole("button", { name: /retry/i });
    await userEvent.click(retry);

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("PLAT-14: retry also refreshes the route's server data", async () => {
    refresh.mockClear();
    const reset = vi.fn();
    renderWithI18n(<FavoritesError error={new Error("x")} reset={reset} />);

    const retry = screen.getByRole("button", { name: /retry/i });
    await userEvent.click(retry);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("PLAT-14: never shows the raw error message", () => {
    renderWithI18n(<FavoritesError error={new Error("x")} reset={vi.fn()} />);

    expect(screen.queryByText("x")).not.toBeInTheDocument();
  });
});
