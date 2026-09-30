import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { toast } from "sonner";
import { SessionsCard } from "./SessionsCard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
const signOut = vi.fn();
vi.mock("next-auth/react", () => ({
  signOut: (...args: unknown[]) => signOut(...args),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const signOutEverywhere = vi.fn();
vi.mock("@/server/account/actions", () => ({
  signOutEverywhere: (...args: unknown[]) => signOutEverywhere(...args),
}));

const button = () => screen.getByRole("button", { name: "Sign out everywhere" });

beforeEach(() => {
  signOut.mockReset();
  signOutEverywhere.mockReset();
  vi.mocked(toast.error).mockClear();
});

describe("SessionsCard", () => {
  it("warns that this device is included", () => {
    renderWithI18n(<SessionsCard />);

    // Surprising people by signing them out of the tab they are using is worse
    // than the extra sentence.
    expect(
      screen.getByText(/signs you out on every device, including this one/i),
    ).toBeInTheDocument();
  });

  it("revokes then clears the local cookie", async () => {
    signOutEverywhere.mockResolvedValue({ success: true });
    renderWithI18n(<SessionsCard />);

    await userEvent.click(button());

    await waitFor(() => expect(signOutEverywhere).toHaveBeenCalledOnce());
    // The revocation clock now excludes this token too, so drop it here rather
    // than waiting for the next revalidation to notice.
    await waitFor(() => expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/" }));
  });

  it("stays signed in when the server refuses", async () => {
    signOutEverywhere.mockResolvedValue({
      success: false,
      error: "unauthorized",
    });
    renderWithI18n(<SessionsCard />);

    await userEvent.click(button());

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(signOut).not.toHaveBeenCalled();
  });

  it("re-enables the button after a failure", async () => {
    signOutEverywhere.mockResolvedValue({
      success: false,
      error: "generic",
    });
    renderWithI18n(<SessionsCard />);

    await userEvent.click(button());

    await waitFor(() => expect(button()).toBeEnabled());
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithI18n(<SessionsCard />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
