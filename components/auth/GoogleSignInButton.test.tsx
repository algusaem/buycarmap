import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { GoogleSignInButton } from "./GoogleSignInButton";

// I18nProvider calls useRouter to refresh after a locale switch, which needs an
// app-router context this component never provides.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

// The button picks Google's light or dark palette from the resolved theme.
const useTheme = vi.fn();
vi.mock("next-themes", () => ({ useTheme: () => useTheme() }));

const button = () => screen.getByRole("button");

beforeEach(() => {
  useTheme.mockReturnValue({ resolvedTheme: "dark" });
});

describe("GoogleSignInButton branding", () => {
  // Every expected value below is transcribed from Google's published branding
  // guidelines (developers.google.com/identity/branding-guidelines). Drifting
  // from them is a terms breach, not a cosmetic regression, so they are
  // asserted literally rather than against the app's own tokens.
  it("uses Google's dark palette on the dark theme", () => {
    useTheme.mockReturnValue({ resolvedTheme: "dark" });
    renderWithI18n(
      <GoogleSignInButton isPending={false} disabled={false} onClick={vi.fn()} />,
    );

    expect(button()).toHaveStyle({
      backgroundColor: "#131314",
      border: "1px solid #8E918F",
      color: "#E3E3E3",
    });
  });

  it("uses Google's light palette on the light theme", () => {
    useTheme.mockReturnValue({ resolvedTheme: "light" });
    renderWithI18n(
      <GoogleSignInButton isPending={false} disabled={false} onClick={vi.fn()} />,
    );

    expect(button()).toHaveStyle({
      backgroundColor: "#FFFFFF",
      border: "1px solid #747775",
      color: "#1F1F1F",
    });
  });

  it("falls back to the dark palette before the theme resolves", () => {
    // next-themes reports undefined until it has read the stored preference,
    // and useMounted holds the first render back regardless. Dark is the app's
    // default, so defaulting there keeps the common case flash-free.
    useTheme.mockReturnValue({ resolvedTheme: undefined });
    renderWithI18n(
      <GoogleSignInButton isPending={false} disabled={false} onClick={vi.fn()} />,
    );

    expect(button()).toHaveStyle({ backgroundColor: "#131314" });
  });

  it("uses one of Google's three permitted call-to-action strings", () => {
    renderWithI18n(
      <GoogleSignInButton isPending={false} disabled={false} onClick={vi.fn()} />,
    );

    // "Sign in with", "Sign up with" and "Continue with" are the only phrasings
    // Google permits, each followed by exactly "Google".
    expect(["Sign in with Google", "Sign up with Google", "Continue with Google"])
      .toContain(button().textContent?.trim());
  });
});

describe("GoogleSignInButton behaviour", () => {
  it("calls onClick when pressed", async () => {
    const onClick = vi.fn();
    renderWithI18n(
      <GoogleSignInButton isPending={false} disabled={false} onClick={onClick} />,
    );

    await userEvent.click(button());

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire while disabled by another provider's redirect", async () => {
    const onClick = vi.fn();
    renderWithI18n(
      <GoogleSignInButton isPending={false} disabled onClick={onClick} />,
    );

    expect(button()).toBeDisabled();
    await userEvent.click(button());

    expect(onClick).not.toHaveBeenCalled();
  });

  it("keeps its label while pending so the button does not collapse", () => {
    renderWithI18n(
      <GoogleSignInButton isPending disabled onClick={vi.fn()} />,
    );

    // The spinner replaces the logo, not the text — a button that empties out
    // mid-click shifts the layout and loses its accessible name.
    expect(button()).toHaveAccessibleName("Continue with Google");
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithI18n(
      <GoogleSignInButton isPending={false} disabled={false} onClick={vi.fn()} />,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
