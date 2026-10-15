import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { GoogleSignInButton } from "./GoogleSignInButton";

// I18nProvider calls useRouter to refresh after a locale switch, which needs an
// app-router context this component never provides.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const button = () => screen.getByRole("button");

// Google's dark-variant values, transcribed from its published branding
// guidelines (developers.google.com/identity/branding-guidelines). Drifting
// from them is a terms breach, not a cosmetic regression, so the tokens the
// button paints with are checked against these literals.
const GOOGLE_DARK = { bg: "#131314", line: "#8E918F", text: "#E3E3E3" } as const;

// jsdom computes no Tailwind CSS, so the tokens' own definitions are read from
// app/globals.css.
const GLOBALS = readFileSync(join(__dirname, "..", "..", "app", "globals.css"), "utf-8");
const tokenValue = (name: string) =>
  new RegExp(`^\\s*--${name}:\\s*([^;]+);`, "m").exec(GLOBALS)?.[1]?.trim().toUpperCase();

describe("GoogleSignInButton branding", () => {
  it("defines the google-* tokens with Google's dark palette", () => {
    expect(tokenValue("google-bg")).toBe(GOOGLE_DARK.bg);
    expect(tokenValue("google-line")).toBe(GOOGLE_DARK.line);
    expect(tokenValue("google-text")).toBe(GOOGLE_DARK.text);
  });

  it("paints with the google-* tokens, the app's only theme", () => {
    renderWithI18n(<GoogleSignInButton isPending={false} disabled={false} onClick={vi.fn()} />);

    expect(button()).toHaveClass(
      "bg-google-bg",
      "border",
      "border-google-line",
      "text-google-text",
    );
  });

  it("is the full-width 52px pill the design draws", () => {
    renderWithI18n(<GoogleSignInButton isPending={false} disabled={false} onClick={vi.fn()} />);

    expect(button()).toHaveClass("h-13", "w-full", "rounded-pill");
  });

  it("uses one of Google's three permitted call-to-action strings", () => {
    renderWithI18n(<GoogleSignInButton isPending={false} disabled={false} onClick={vi.fn()} />);

    // "Sign in with", "Sign up with" and "Continue with" are the only phrasings
    // Google permits, each followed by exactly "Google".
    expect(["Sign in with Google", "Sign up with Google", "Continue with Google"]).toContain(
      button().textContent?.trim(),
    );
  });
});

describe("GoogleSignInButton behaviour", () => {
  it("calls onClick when pressed", async () => {
    const onClick = vi.fn();
    renderWithI18n(<GoogleSignInButton isPending={false} disabled={false} onClick={onClick} />);

    await userEvent.click(button());

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire while disabled by another provider's redirect", async () => {
    const onClick = vi.fn();
    renderWithI18n(<GoogleSignInButton isPending={false} disabled onClick={onClick} />);

    expect(button()).toBeDisabled();
    await userEvent.click(button());

    expect(onClick).not.toHaveBeenCalled();
  });

  it("keeps its label while pending so the button does not collapse", () => {
    renderWithI18n(<GoogleSignInButton isPending disabled onClick={vi.fn()} />);

    // The spinner replaces the logo, not the text — a button that empties out
    // mid-click shifts the layout and loses its accessible name.
    expect(button()).toHaveAccessibleName("Continue with Google");
  });

  it("hides the pending spinner from assistive technology", () => {
    renderWithI18n(<GoogleSignInButton isPending disabled onClick={vi.fn()} />);

    expect(button().querySelector(".animate-spin")).toHaveAttribute("aria-hidden", "true");
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithI18n(
      <GoogleSignInButton isPending={false} disabled={false} onClick={vi.fn()} />,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
