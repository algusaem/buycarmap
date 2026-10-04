import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { toast } from "sonner";
import { SessionsCard } from "./SessionsCard";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

// BAUTH-1 (docs/specs/core-better-auth.md), harness change: signing out
// everywhere now calls `authClient.signOut()` (Better Auth), not NextAuth's
// `next-auth/react` `signOut`.
// BAUTH-4, harness change: `useMySessions` (lib/hooks/useMySessions.ts) also
// reads `authClient.useSession()` to know whether to fetch the list at all —
// the mock now needs both.
const signOut = vi.fn();
const useSession = vi.fn();
vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    signOut: (...args: unknown[]) => signOut(...args),
    useSession: () => useSession(),
  },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const signOutEverywhere = vi.fn();
const listMySessions = vi.fn();
const revokeMySession = vi.fn();
const revokeOtherMySessions = vi.fn();
vi.mock("@/server/account/actions", () => ({
  signOutEverywhere: (...args: unknown[]) => signOutEverywhere(...args),
  listMySessions: (...args: unknown[]) => listMySessions(...args),
  revokeMySession: (...args: unknown[]) => revokeMySession(...args),
  revokeOtherMySessions: (...args: unknown[]) => revokeOtherMySessions(...args),
}));

const button = () => screen.getByRole("button", { name: "Sign out everywhere" });

const MINE = {
  id: "session-mine",
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
  ipAddress: "203.0.113.1",
  lastUsedAt: new Date("2026-10-04T10:00:00Z"),
  current: true,
};
const OTHER = {
  id: "session-other",
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1",
  ipAddress: "203.0.113.2",
  lastUsedAt: new Date("2026-10-03T10:00:00Z"),
  current: false,
};

beforeEach(() => {
  signOut.mockReset();
  push.mockReset();
  signOutEverywhere.mockReset();
  listMySessions.mockReset();
  revokeMySession.mockReset();
  revokeOtherMySessions.mockReset();
  vi.mocked(toast.error).mockClear();
  vi.mocked(toast.success).mockClear();
  useSession.mockReset();
  useSession.mockReturnValue({ data: { user: { id: "user-1" } }, isPending: false });
  listMySessions.mockResolvedValue([MINE, OTHER]);
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
    // Every session, including this one, was just revoked — drop the cookie
    // here rather than waiting for the next revalidation to notice.
    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(push).toHaveBeenCalledWith("/");
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
    await waitFor(() => expect(listMySessions).toHaveBeenCalled());
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("BAUTH-4: the active sessions list", () => {
  it("BAUTH-4: lists each session with a device label, marks the current one, and hides its own revoke button", async () => {
    renderWithI18n(<SessionsCard />);

    await waitFor(() => expect(screen.getByText(/Chrome · Windows/)).toBeInTheDocument());
    expect(screen.getByText(/Safari · iOS/)).toBeInTheDocument();
    expect(screen.getByText("This device")).toBeInTheDocument();

    // Only the non-current session gets its own "Sign out" button.
    expect(screen.getAllByRole("button", { name: /^Sign out —/ })).toHaveLength(1);
  });

  it("BAUTH-4: shows a loading state before the list resolves", () => {
    // Never resolves, so the component stays in its loading state.
    listMySessions.mockReturnValue(
      new Promise(() => {
        // Intentionally left pending.
      }),
    );
    renderWithI18n(<SessionsCard />);

    expect(screen.queryByText("This device")).not.toBeInTheDocument();
  });

  it("BAUTH-4: shows an error state when the list fails to load", async () => {
    listMySessions.mockRejectedValue(new Error("boom"));
    renderWithI18n(<SessionsCard />);

    await waitFor(() =>
      expect(screen.getByText("Could not load your sessions.")).toBeInTheDocument(),
    );
  });

  it("BAUTH-4: shows an empty state when there are no sessions at all", async () => {
    listMySessions.mockResolvedValue([]);
    renderWithI18n(<SessionsCard />);

    await waitFor(() => expect(screen.getByText("No active sessions found.")).toBeInTheDocument());
  });

  it("BAUTH-4: revokes a single other session", async () => {
    revokeMySession.mockResolvedValue({ success: true });
    renderWithI18n(<SessionsCard />);

    await waitFor(() => expect(screen.getByText("This device")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /^Sign out —/ }));

    await waitFor(() => expect(revokeMySession).toHaveBeenCalledWith(OTHER.id));
    // Revoking refetches the list.
    await waitFor(() => expect(listMySessions).toHaveBeenCalledTimes(2));
  });

  it("BAUTH-4: reports an error without clearing the list when revoking a session fails", async () => {
    revokeMySession.mockResolvedValue({ success: false, error: "unauthorized" });
    renderWithI18n(<SessionsCard />);

    await waitFor(() => expect(screen.getByText("This device")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /^Sign out —/ }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByText("This device")).toBeInTheDocument();
  });

  it("BAUTH-4: signs out of every other session", async () => {
    revokeOtherMySessions.mockResolvedValue({ success: true });
    renderWithI18n(<SessionsCard />);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Sign out of all other sessions" }),
      ).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole("button", { name: "Sign out of all other sessions" }));

    await waitFor(() => expect(revokeOtherMySessions).toHaveBeenCalledOnce());
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it("BAUTH-4: hides the 'sign out of all other sessions' button when there is only this device", async () => {
    listMySessions.mockResolvedValue([MINE]);
    renderWithI18n(<SessionsCard />);

    await waitFor(() => expect(screen.getByText("This device")).toBeInTheDocument());
    expect(
      screen.queryByRole("button", { name: "Sign out of all other sessions" }),
    ).not.toBeInTheDocument();
  });
});
