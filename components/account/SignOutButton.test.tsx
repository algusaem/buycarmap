import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "@/test/utils/render";

// docs/specs/redesign-navigation.md (HEAD-13). Sign-out moves here from the
// Navbar's account dropdown (NAV-6, withdrawn); the mechanism is unchanged —
// authClient.signOut() then router.push("/").
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

const signOut = vi.fn();
vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    signOut: (...args: unknown[]) => signOut(...args),
  },
}));

import { SignOutButton } from "./SignOutButton";

beforeEach(() => {
  push.mockReset();
  signOut.mockReset();
});

describe("SignOutButton", () => {
  it("HEAD-13: clicking Sign out calls signOut once, then navigates to /", async () => {
    signOut.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithI18n(<SignOutButton />);

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(push).toHaveBeenCalledWith("/");
  });

  it("negative path: a rejected signOut never navigates, and the button stays usable", async () => {
    signOut.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    renderWithI18n(<SignOutButton />);

    const button = screen.getByRole("button", { name: "Sign out" });
    await user.click(button);

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(push).not.toHaveBeenCalled();
    expect(button).not.toHaveAttribute("aria-disabled");

    // Usable again: a second click still calls signOut, rather than the
    // control being stuck in whatever state the failed attempt left it in.
    signOut.mockResolvedValue(undefined);
    await user.click(button);
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(2));
  });
});
