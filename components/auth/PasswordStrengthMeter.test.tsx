import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithI18n } from "@/test/utils/render";
import { PasswordStrengthMeter } from "./PasswordStrengthMeter";

// I18nProvider calls useRouter to refresh after a locale switch, which needs an
// app-router context this component never provides.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

// Scores 4: 20 characters, no sequence, keyboard run, repeat or blocklist hit.
const STRONG = "harbour-lentil-quilt";

describe("PasswordStrengthMeter", () => {
  it("renders nothing before the user has typed", () => {
    const { container } = renderWithI18n(<PasswordStrengthMeter password="" />);

    // An empty meter under an empty field is noise, and reads as "very weak"
    // before the user has done anything wrong.
    expect(container).toBeEmptyDOMElement();
  });

  it("rates a blocklisted password as the bottom band", () => {
    renderWithI18n(<PasswordStrengthMeter password="password" />);

    expect(screen.getByText("Very weak")).toBeInTheDocument();
    expect(
      screen.getByText("This is a commonly used password"),
    ).toBeInTheDocument();
  });

  it("rates an unpredictable passphrase as the top band", () => {
    renderWithI18n(<PasswordStrengthMeter password={STRONG} />);

    expect(screen.getByText("Strong")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("names each weakness it found rather than only the score", () => {
    // "abcdefgh1111" is long enough to clear the length rule, so the two issues
    // below are the only reason it scores low — the user needs to be told which.
    renderWithI18n(<PasswordStrengthMeter password="abcdefgh1111" />);

    expect(
      screen.getByText("Avoid sequences like “abcd” or “1234”"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Avoid repeating the same character"),
    ).toBeInTheDocument();
  });

  it("flags a password built out of the user's own email", () => {
    renderWithI18n(
      <PasswordStrengthMeter
        password="ada-lovelace-1815"
        userInputs={["ada@example.com"]}
      />,
    );

    expect(
      screen.getByText("Avoid using your name or email"),
    ).toBeInTheDocument();
    expect(screen.getByText("Very weak")).toBeInTheDocument();
  });

  it("does not flag a password merely because inputs were supplied", () => {
    // Guards the check above against passing for any non-empty userInputs.
    renderWithI18n(
      <PasswordStrengthMeter
        password={STRONG}
        userInputs={["ada@example.com"]}
      />,
    );

    expect(
      screen.queryByText("Avoid using your name or email"),
    ).not.toBeInTheDocument();
  });

  it("states the strength as text, not by colour alone", () => {
    // The bar is aria-hidden, so this line is the only thing a screen reader
    // or a colour-blind user has to go on.
    renderWithI18n(<PasswordStrengthMeter password="password" />);

    expect(screen.getByText("Password strength")).toBeInTheDocument();
  });
});
