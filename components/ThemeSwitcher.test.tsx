import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "@/test/utils/render";
import { ThemeSwitcher } from "./ThemeSwitcher";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

// useThemeTransition wraps setTheme in the View Transitions API, which jsdom
// does not implement. The transition is decoration; the theme change is the
// behaviour, so the hook is stubbed down to what it is decorating.
const toggleTheme = vi.fn();
const resolvedTheme = vi.fn(() => "dark");
vi.mock("@/lib/hooks/useThemeTransition", () => ({
  useThemeTransition: () => ({
    resolvedTheme: resolvedTheme(),
    toggleTheme,
  }),
}));

describe("ThemeSwitcher", () => {
  it("CORE-10: toggles the theme when pressed", async () => {
    resolvedTheme.mockReturnValue("dark");
    renderWithI18n(<ThemeSwitcher />);

    // The control renders a placeholder until mounted, so wait for the real one.
    const button = await screen.findByRole("button");
    await userEvent.click(button);

    expect(toggleTheme).toHaveBeenCalledTimes(1);
  });

  it("CORE-10: shows the label for the theme currently in effect", async () => {
    resolvedTheme.mockReturnValue("light");
    renderWithI18n(<ThemeSwitcher />);

    await waitFor(() => expect(screen.getByRole("button")).toHaveTextContent("Light"));
  });
});
