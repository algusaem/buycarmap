import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { toast } from "sonner";
import { ConnectedAccounts } from "./ConnectedAccounts";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const unlinkAccount = vi.fn();
vi.mock("@/server/account/actions", () => ({
  unlinkAccount: (...args: unknown[]) => unlinkAccount(...args),
}));

const disconnectButtons = () => screen.queryAllByRole("button", { name: "Disconnect" });

beforeEach(() => {
  refresh.mockReset();
  unlinkAccount.mockReset();
  vi.mocked(toast.error).mockClear();
});

describe("ConnectedAccounts", () => {
  it("says so when nothing is connected", () => {
    renderWithI18n(<ConnectedAccounts providers={[]} hasPassword />);

    expect(screen.getByText("No connected accounts.")).toBeInTheDocument();
    expect(disconnectButtons()).toHaveLength(0);
  });

  it("lists each linked provider", () => {
    renderWithI18n(<ConnectedAccounts providers={["google", "github"]} hasPassword />);

    expect(screen.getByText("Google")).toBeInTheDocument();
    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(disconnectButtons()).toHaveLength(2);
  });

  it("submits the provider and refreshes on success", async () => {
    unlinkAccount.mockResolvedValue({ success: true });
    renderWithI18n(<ConnectedAccounts providers={["google"]} hasPassword />);

    await userEvent.click(disconnectButtons()[0]);

    await waitFor(() => expect(unlinkAccount).toHaveBeenCalledOnce());
    const submitted = unlinkAccount.mock.calls[0][0] as FormData;
    expect(submitted.get("provider")).toBe("google");
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("AUTH-14: disables disconnect when it is the only way to sign in", () => {
    // No password and one provider: removing it would strand the account,
    // and password reset cannot rescue a passwordless user.
    renderWithI18n(<ConnectedAccounts providers={["google"]} hasPassword={false} />);

    expect(disconnectButtons()[0]).toBeDisabled();
    expect(
      screen.getByText("This is your only way to sign in. Set a password before disconnecting it."),
    ).toBeInTheDocument();
  });

  it("allows disconnecting when a second provider remains", () => {
    renderWithI18n(<ConnectedAccounts providers={["google", "github"]} hasPassword={false} />);

    for (const button of disconnectButtons()) {
      expect(button).toBeEnabled();
    }
  });

  it("allows disconnecting the sole provider when a password exists", () => {
    renderWithI18n(<ConnectedAccounts providers={["google"]} hasPassword />);

    expect(disconnectButtons()[0]).toBeEnabled();
  });

  it("surfaces a server refusal without refreshing", async () => {
    unlinkAccount.mockResolvedValue({
      success: false,
      error: "lastSignInMethod",
    });
    renderWithI18n(<ConnectedAccounts providers={["google"]} hasPassword />);

    await userEvent.click(disconnectButtons()[0]);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "That's your only way to sign in. Set a password before disconnecting it.",
      ),
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithI18n(
      <ConnectedAccounts providers={["google", "github"]} hasPassword />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
