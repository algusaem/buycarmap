import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountPage } from "@/components/account/AccountPage";
import { SiteHeader } from "@/components/nav/SiteHeader";
import { TabBar } from "@/components/nav/TabBar";
import { ACCOUNT_COPY, albaAccount } from "@/test/fixtures/pages-account";
import { renderAccount, withinCard } from "@/test/utils/pages-account";
import { renderWithI18n } from "@/test/utils/render";
import { stubLayoutBox, stubPhoneWidth, restoreMatchMedia } from "@/test/utils/viewport";

// docs/specs/redesign-pages.md (PAGES-26, PAGES-38, PAGES-72, PAGES-73) at
// phone width: matchMedia reports `(width < 64rem)`, the query useIsPhone
// reads. The desktop composition is AccountPage.test.tsx's. The clock is
// frozen on the worked examples' day, 2026-10-16.

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/account",
}));
vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    signOut: vi.fn(),
    useSession: () => ({
      data: { user: { name: "Alba", email: "alba@example.com" } },
      isPending: false,
    }),
  },
}));

const updateProfile = vi.fn();
vi.mock("@/server/account/actions", () => ({
  updateProfile: (...a: unknown[]) => updateProfile(...a),
  changePassword: vi.fn(),
  unlinkAccount: vi.fn(),
  listMySessions: vi.fn().mockResolvedValue([]),
  revokeMySession: vi.fn(),
  revokeOtherMySessions: vi.fn(),
  signOutEverywhere: vi.fn(),
  deleteAccount: vi.fn(),
}));
vi.mock("@/server/email-verification/actions", () => ({
  requestEmailChange: vi.fn(),
  requestEmailVerification: vi.fn(),
}));
vi.mock("@/server/two-factor/actions", () => ({
  startTwoFactorSetup: vi.fn(),
  confirmTwoFactorSetup: vi.fn(),
  regenerateRecoveryCodes: vi.fn(),
  disableTwoFactor: vi.fn(),
}));

stubLayoutBox({ width: 390 });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-16T12:00:00.000Z") });
  stubPhoneWidth();
  updateProfile.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  restoreMatchMedia();
  vi.restoreAllMocks();
});

describe("PAGES-26: /account at phone width", () => {
  it("PAGES-26: shows the phone header, «Cuenta», the short line, the cards in one column, «Cerrar sesión» after the last card, and the tab bar with «Cuenta» current", () => {
    // The page under the root layout's header and tab bar, on /account.
    renderWithI18n(
      <>
        <SiteHeader />
        <main>
          <AccountPage {...albaAccount()} />
        </main>
        <TabBar />
      </>,
      { locale: "es" },
    );

    // The pages header's phone region, not the access header's «Mapa».
    const phoneHeader = screen.getByTestId("header-phone");
    expect(within(phoneHeader).queryByRole("link", { name: "Mapa" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: ACCOUNT_COPY.heading }),
    ).toBeInTheDocument();
    // Breakpoints pick the line (jsdom draws no CSS): the short one below `lg`.
    expect(screen.getByText(ACCOUNT_COPY.descriptionPhone)).toHaveClass("lg:hidden");
    expect(screen.getByText(ACCOUNT_COPY.descriptionDesktop)).toHaveClass("hidden", "lg:block");
    const main = screen.getByRole("main");
    const cards = within(main).getAllByRole("region");
    expect(cards[0].parentElement).toHaveClass("grid-cols-1");
    // «Cerrar sesión» after the last card is the one shown below `lg`.
    const signOutButtons = within(main).getAllByRole("button", { name: ACCOUNT_COPY.signOut });
    const afterCards = signOutButtons.filter(
      (button) =>
        cards[cards.length - 1].compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(afterCards).toHaveLength(1);
    expect(afterCards[0]).toHaveClass("lg:hidden");
    // The tab bar, «Cuenta» its one current tab.
    const tabBar = document.querySelector("[data-tab-bar]") as HTMLElement;
    const current = within(tabBar)
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAccessibleName("Cuenta");
  });
});

describe("PAGES-38 at phone width: the card's form opens in a bottom sheet", () => {
  it("PAGES-38: «Cambiar nombre» opens a sheet with a handle and a centred title, no «×»", async () => {
    renderAccount(albaAccount({ name: "Alba" }));

    await userEvent.click(
      withinCard("Alba").getByRole("button", { name: ACCOUNT_COPY.changeName }),
    );
    const sheet = await screen.findByRole("dialog", { name: ACCOUNT_COPY.changeName });

    expect(sheet.querySelector("[data-sheet-handle]")).not.toBeNull();
    // Its buttons are exactly the submit and «Cancelar»: no «×».
    expect(
      within(sheet)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual([ACCOUNT_COPY.saveChanges, ACCOUNT_COPY.cancel]);
  });

  it("PAGES-38: Escape still closes the sheet with nothing sent and returns focus to the opener", async () => {
    renderAccount(albaAccount({ name: "Alba" }));
    const opener = withinCard("Alba").getByRole("button", { name: ACCOUNT_COPY.changeName });
    await userEvent.click(opener);
    await screen.findByRole("dialog", { name: ACCOUNT_COPY.changeName });

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
    expect(updateProfile).not.toHaveBeenCalled();
  });
});

// PAGES-39 (the drag gesture itself: more than 100px closes, a slow 40px
// drag springs back) is e2e-only (database run), as the spec's Contracts ›
// Tests section states — see e2e/pages-account.spec.ts.

describe("PAGES-73 at phone width: focus still starts on the first field", () => {
  it("PAGES-73: «Cambiar nombre»'s sheet opens with focus on «Nombre»", async () => {
    renderAccount(albaAccount({ name: "Alba" }));

    await userEvent.click(
      withinCard("Alba").getByRole("button", { name: ACCOUNT_COPY.changeName }),
    );
    const sheet = await screen.findByRole("dialog", { name: ACCOUNT_COPY.changeName });

    await waitFor(() => expect(within(sheet).getByLabelText("Nombre")).toHaveFocus());
  });
});
