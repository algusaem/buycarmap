import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "@/test/utils/render";
import { LanguageSwitcher } from "./LanguageSwitcher";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
}));

describe("LanguageSwitcher", () => {
  it("CORE-5: marks the active language and offers the other one", () => {
    renderWithI18n(<LanguageSwitcher />);

    const [en, es] = screen.getAllByRole("button");
    expect(en).toHaveTextContent("EN");
    expect(es).toHaveTextContent("ES");
    // Colour alone would not be a redundant cue, but it is what distinguishes
    // them today; asserting the class keeps that from silently disappearing.
    expect(en.className).toContain("text-primary");
    expect(es.className).not.toContain("text-primary");
  });

  it("CORE-5: persists the choice in the locale cookie", async () => {
    renderWithI18n(<LanguageSwitcher />);

    await userEvent.click(screen.getByRole("button", { name: "ES" }));

    // The cookie is what getLocale() reads on the next server render, so this
    // is the whole mechanism by which the choice outlives the page.
    expect(document.cookie).toContain("locale=es");
  });

  it("CORE-5: re-renders the page so server components pick the language up", async () => {
    refresh.mockClear();
    renderWithI18n(<LanguageSwitcher />);

    await userEvent.click(screen.getByRole("button", { name: "ES" }));

    expect(refresh).toHaveBeenCalled();
  });
});
