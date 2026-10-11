import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "@/test/utils/render";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
}));
vi.mock("@/server/locale/actions", () => ({ setLocale: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import * as Sentry from "@sentry/nextjs";
import { toast } from "sonner";
import { setLocale } from "@/server/locale/actions";
import { LanguageSwitcher } from "./LanguageSwitcher";

beforeEach(() => {
  refresh.mockClear();
  vi.mocked(setLocale).mockReset();
  vi.mocked(setLocale).mockResolvedValue({ ok: true, value: undefined });
  vi.mocked(Sentry.captureException).mockReset();
  vi.mocked(toast.error).mockReset();
});

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
    renderWithI18n(<LanguageSwitcher />);

    await userEvent.click(screen.getByRole("button", { name: "ES" }));

    expect(refresh).toHaveBeenCalled();
  });

  it("ALERT-50: switching to English writes the cookie and asks the server to store it on the account", async () => {
    renderWithI18n(<LanguageSwitcher />);

    await userEvent.click(screen.getByRole("button", { name: "EN" }));

    // Called signed in or not: for a signed-out visitor setLocale is a no-op
    // (ALERT-33), so the switch does not need to know who is signed in.
    expect(document.cookie).toContain("locale=en");
    expect(setLocale).toHaveBeenCalledTimes(1);
    expect(setLocale).toHaveBeenCalledWith("en");
  });

  it("ALERT-50: a failed store still switches the page to English, with no toast", async () => {
    const failure = new Error("network down");
    vi.mocked(setLocale).mockRejectedValue(failure);
    renderWithI18n(<LanguageSwitcher />);

    await userEvent.click(screen.getByRole("button", { name: "EN" }));

    expect(document.cookie).toContain("locale=en");
    expect(refresh).toHaveBeenCalled();
    await waitFor(() => expect(Sentry.captureException).toHaveBeenCalledWith(failure));
    expect(toast.error).not.toHaveBeenCalled();
  });
});
