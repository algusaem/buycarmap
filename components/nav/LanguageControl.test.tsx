import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { renderWithI18n } from "@/test/utils/render";
import esMessages from "@/messages/es.json";

// docs/specs/redesign-navigation.md (HEAD-10), amending CORE-5
// (docs/specs/cross-cutting.md) and ALERT-50 (docs/specs/alerts.md): both
// criteria move from LanguageSwitcher.tsx to this component, which still goes
// through the existing useLocaleSwitcher hook (cookie + setLocale) — only the
// markup and its accessible names change, to role="group" with two
// aria-pressed buttons instead of bare text.
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
import { LanguageControl } from "./LanguageControl";

beforeEach(() => {
  refresh.mockClear();
  vi.mocked(setLocale).mockReset();
  vi.mocked(setLocale).mockResolvedValue({ ok: true, value: undefined });
  vi.mocked(Sentry.captureException).mockReset();
  vi.mocked(toast.error).mockReset();
});

function renderInLocale(locale: "en" | "es") {
  const messages = locale === "es" ? esMessages : undefined;
  if (locale === "en") return renderWithI18n(<LanguageControl />);
  return render(<LanguageControl />, {
    wrapper: ({ children }) => (
      <NextIntlClientProvider locale="es" messages={messages} timeZone="UTC">
        {children}
      </NextIntlClientProvider>
    ),
  });
}

describe("LanguageControl — contract", () => {
  it("HEAD-10: is a group named Language with one button per locale", () => {
    renderInLocale("en");

    const group = screen.getByRole("group", { name: "Language" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Spanish" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "English" })).toBeInTheDocument();
  });

  it("HEAD-10: visible text stays ES / EN regardless of the accessible name", () => {
    renderInLocale("en");

    expect(screen.getByRole("button", { name: "Spanish" })).toHaveTextContent("ES");
    expect(screen.getByRole("button", { name: "English" })).toHaveTextContent("EN");
  });

  it("HEAD-10 (worked example): locale es marks Español pressed and Inglés not", () => {
    renderInLocale("es");

    const es = screen.getByRole("button", { name: "Español" });
    const en = screen.getByRole("button", { name: "Inglés" });
    expect(es).toHaveAttribute("aria-pressed", "true");
    expect(en).toHaveAttribute("aria-pressed", "false");
  });

  it("HEAD-10 (worked example): pressing Inglés writes cookie locale=en and calls setLocale once", async () => {
    renderInLocale("es");

    await userEvent.click(screen.getByRole("button", { name: "Inglés" }));

    expect(document.cookie).toContain("locale=en");
    expect(setLocale).toHaveBeenCalledTimes(1);
    expect(setLocale).toHaveBeenCalledWith("en");
  });
});

describe("LanguageControl — CORE-5 (moved from LanguageSwitcher.test.tsx)", () => {
  it("CORE-5: marks the active language pressed and the other one not", () => {
    renderInLocale("en");

    expect(screen.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Spanish" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("CORE-5: persists the choice in the locale cookie", async () => {
    renderInLocale("en");

    await userEvent.click(screen.getByRole("button", { name: "Spanish" }));

    expect(document.cookie).toContain("locale=es");
  });

  it("CORE-5: re-renders the page so server components pick the language up", async () => {
    renderInLocale("en");

    await userEvent.click(screen.getByRole("button", { name: "Spanish" }));

    expect(refresh).toHaveBeenCalled();
  });
});

describe("LanguageControl — ALERT-50 (moved from LanguageSwitcher.test.tsx and Navbar.test.tsx)", () => {
  it("ALERT-50: switching to English writes the cookie and asks the server to store it on the account", async () => {
    renderInLocale("en");

    await userEvent.click(screen.getByRole("button", { name: "English" }));

    // Called signed in or not: for a signed-out visitor setLocale is a no-op
    // (ALERT-33), so the switch does not need to know who is signed in.
    expect(document.cookie).toContain("locale=en");
    expect(setLocale).toHaveBeenCalledTimes(1);
    expect(setLocale).toHaveBeenCalledWith("en");
  });

  it("ALERT-50: a failed store still switches the page to English, with no toast", async () => {
    const failure = new Error("network down");
    vi.mocked(setLocale).mockRejectedValue(failure);
    renderInLocale("en");

    await userEvent.click(screen.getByRole("button", { name: "English" }));

    expect(document.cookie).toContain("locale=en");
    expect(refresh).toHaveBeenCalled();
    await waitFor(() => expect(Sentry.captureException).toHaveBeenCalledWith(failure));
    expect(toast.error).not.toHaveBeenCalled();
  });
});
