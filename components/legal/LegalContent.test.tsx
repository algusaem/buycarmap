import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithI18n } from "@/test/utils/render";
import { LegalContent } from "./LegalContent";

// I18nProvider (via renderWithI18n) calls useRouter, so the app router must be
// mocked even though this component only reads translations.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("LegalContent", () => {
  it("renders the Terms document with its heading and sections", () => {
    renderWithI18n(<LegalContent doc="terms" />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Terms of Service" }),
    ).toBeInTheDocument();
    // First and last section headings render, so the sections list is mapped.
    expect(screen.getByText("About the service")).toBeInTheDocument();
    expect(screen.getByText("Contact")).toBeInTheDocument();
    expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
  });

  it("renders the Privacy document when doc='privacy'", () => {
    renderWithI18n(<LegalContent doc="privacy" />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Privacy Policy" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Information we collect")).toBeInTheDocument();
  });

  it("selects content by the doc prop and does not leak the other document", () => {
    renderWithI18n(<LegalContent doc="privacy" />);

    // "About the service" is a Terms-only heading; it must not appear here.
    expect(screen.queryByText("About the service")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Terms of Service" }),
    ).not.toBeInTheDocument();
  });
});
