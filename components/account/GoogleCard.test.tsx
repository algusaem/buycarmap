import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { toast } from "sonner";
import { GoogleCard } from "./GoogleCard";

// Moved from ConnectedAccounts.test.tsx when the connected-accounts list
// became the «Google» card (docs/specs/redesign-pages.md, PAGES-34, PAGES-53;
// AUTH-14 and BAUTH-10 amended): the same cases, with the disconnect control
// aria-disabled rather than disabled, the last-method line without its
// set-a-password sentence, and the card updated by the page (onUnlinked)
// instead of a route refresh.
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const unlinkAccount = vi.fn();
vi.mock("@/server/account/actions", () => ({
  unlinkAccount: (...args: unknown[]) => unlinkAccount(...args),
}));

const disconnectButtons = () => screen.queryAllByRole("button", { name: "Disconnect" });
const onUnlinked = vi.fn();

beforeEach(() => {
  unlinkAccount.mockReset();
  onUnlinked.mockReset();
  vi.mocked(toast.error).mockClear();
});

describe("GoogleCard", () => {
  it("says so when nothing is connected", () => {
    renderWithI18n(<GoogleCard providers={[]} hasPassword onUnlinked={onUnlinked} />);

    expect(screen.getByText("No connected accounts.")).toBeInTheDocument();
    expect(disconnectButtons()).toHaveLength(0);
  });

  it("shows Google as connected", () => {
    renderWithI18n(<GoogleCard providers={["google"]} hasPassword onUnlinked={onUnlinked} />);

    expect(screen.getByRole("region", { name: "Google" })).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(disconnectButtons()).toHaveLength(1);
  });

  it("submits the provider and tells the page on success", async () => {
    unlinkAccount.mockResolvedValue({ success: true });
    renderWithI18n(<GoogleCard providers={["google"]} hasPassword onUnlinked={onUnlinked} />);

    await userEvent.click(disconnectButtons()[0]);

    await waitFor(() => expect(unlinkAccount).toHaveBeenCalledOnce());
    const submitted = unlinkAccount.mock.calls[0][0] as FormData;
    expect(submitted.get("provider")).toBe("google");
    await waitFor(() => expect(onUnlinked).toHaveBeenCalled());
  });

  it("AUTH-14: disables disconnect when it is the only way to sign in", async () => {
    // No password and one provider: removing it would strand the account,
    // and password reset cannot rescue a passwordless user.
    renderWithI18n(
      <GoogleCard providers={["google"]} hasPassword={false} onUnlinked={onUnlinked} />,
    );

    expect(disconnectButtons()[0]).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("It’s your only way to sign in.")).toBeInTheDocument();
    // PAGES-34: the line that says why describes the disabled button.
    expect(disconnectButtons()[0]).toHaveAccessibleDescription("It’s your only way to sign in.");
    await userEvent.click(disconnectButtons()[0]);
    expect(unlinkAccount).not.toHaveBeenCalled();
  });

  it("BAUTH-10: disables disconnect when it is the only way to sign in, same as AUTH-14", () => {
    // BAUTH-10 (docs/specs/core-better-auth.md): unlinking keeps AUTH-14's
    // rule unchanged under Better Auth — the only remaining way to sign in
    // still cannot be disconnected from the UI.
    renderWithI18n(
      <GoogleCard providers={["google"]} hasPassword={false} onUnlinked={onUnlinked} />,
    );

    expect(disconnectButtons()[0]).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("It’s your only way to sign in.")).toBeInTheDocument();
  });

  it("allows disconnecting when a second provider remains", () => {
    // "apple" stands in for any second linked provider id: the server counts
    // it as a way back in, so Google may go.
    renderWithI18n(
      <GoogleCard providers={["google", "apple"]} hasPassword={false} onUnlinked={onUnlinked} />,
    );

    expect(disconnectButtons()[0]).not.toHaveAttribute("aria-disabled");
  });

  it("allows disconnecting the sole provider when a password exists", () => {
    renderWithI18n(<GoogleCard providers={["google"]} hasPassword onUnlinked={onUnlinked} />);

    expect(disconnectButtons()[0]).not.toHaveAttribute("aria-disabled");
  });

  it("security review BLOCKER: never renders a 'credential' entry, even if passed one", () => {
    renderWithI18n(
      <GoogleCard providers={["credential", "google"]} hasPassword onUnlinked={onUnlinked} />,
    );

    expect(screen.queryByText("credential")).not.toBeInTheDocument();
    // Only the real provider gets a disconnect control — "credential" is
    // Better Auth's own sign-in plumbing, never something to disconnect.
    expect(disconnectButtons()).toHaveLength(1);
  });

  it("surfaces a server refusal without dropping Google", async () => {
    unlinkAccount.mockResolvedValue({ success: false, error: "lastSignInMethod" });
    renderWithI18n(<GoogleCard providers={["google"]} hasPassword onUnlinked={onUnlinked} />);

    await userEvent.click(disconnectButtons()[0]);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "You can’t disconnect it: it’s your only way to sign in.",
      ),
    );
    expect(onUnlinked).not.toHaveBeenCalled();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithI18n(
      <GoogleCard providers={["google"]} hasPassword onUnlinked={onUnlinked} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
