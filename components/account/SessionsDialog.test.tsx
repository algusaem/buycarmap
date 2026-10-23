import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { withAnimations } from "@/test/utils/animations";
import { toast } from "sonner";
import { SessionsDialog } from "./SessionsDialog";

// Moved from SessionsCard.test.tsx when the sessions section became the
// «Sesiones» dialog (docs/specs/redesign-pages.md, PAGES-49 to PAGES-52;
// BAUTH-4 amended): the same cases, with the device read «X on Y» rather
// than «X · Y» (PAGES-52), «Sign out the others» shown with this device alone
// (PAGES-35, PAGES-49), and no empty state — the signed-in user's own session
// is always in the list.
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

const signOut = vi.fn();
vi.mock("@/lib/auth/auth-client", () => ({
  authClient: { signOut: (...args: unknown[]) => signOut(...args) },
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

const everywhereButton = () => screen.getByRole("button", { name: "Sign out everywhere" });

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

const onChanged = vi.fn();

function renderDialog() {
  return renderWithI18n(
    <SessionsDialog
      open
      isPhone={false}
      returnFocusRef={{ current: null }}
      onClose={vi.fn()}
      onChanged={onChanged}
    />,
  );
}

beforeEach(() => {
  signOut.mockReset();
  push.mockReset();
  onChanged.mockReset();
  signOutEverywhere.mockReset();
  listMySessions.mockReset();
  revokeMySession.mockReset();
  revokeOtherMySessions.mockReset();
  vi.mocked(toast.error).mockClear();
  vi.mocked(toast.success).mockClear();
  listMySessions.mockResolvedValue([MINE, OTHER]);
});

describe("SessionsDialog", () => {
  it("warns that this device is included", async () => {
    renderDialog();

    // Surprising people by signing them out of the tab they are using is worse
    // than the extra sentence.
    expect(
      await screen.findByText(/signs you out on every device, including this one/i),
    ).toBeInTheDocument();
  });

  it("revokes then clears the local cookie", async () => {
    signOutEverywhere.mockResolvedValue({ success: true });
    renderDialog();

    await userEvent.click(everywhereButton());

    await waitFor(() => expect(signOutEverywhere).toHaveBeenCalledOnce());
    // Every session, including this one, was just revoked — drop the cookie
    // here rather than waiting for the next revalidation to notice.
    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(push).toHaveBeenCalledWith("/");
  });

  it("stays signed in when the server refuses", async () => {
    signOutEverywhere.mockResolvedValue({ success: false, error: "unauthorized" });
    renderDialog();

    await userEvent.click(everywhereButton());

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(signOut).not.toHaveBeenCalled();
  });

  it("re-enables the button after a failure", async () => {
    signOutEverywhere.mockResolvedValue({ success: false, error: "generic" });
    renderDialog();

    await userEvent.click(everywhereButton());

    await waitFor(() => expect(everywhereButton()).not.toHaveAttribute("aria-disabled"));
  });

  it("has no accessibility violations", async () => {
    renderDialog();
    await waitFor(() => expect(screen.getByText("This device")).toBeInTheDocument());
    expect(await axe(document.body)).toHaveNoViolations();
  });
});

describe("BAUTH-4: the active sessions list", () => {
  it("BAUTH-4: lists each session with a device label, marks the current one, and hides its own revoke button", async () => {
    renderDialog();

    await waitFor(() => expect(screen.getByText("Chrome on Windows")).toBeInTheDocument());
    expect(screen.getByText("Safari on iOS")).toBeInTheDocument();
    expect(screen.getByText("This device")).toBeInTheDocument();

    // Only the non-current session gets its own "Sign out" button.
    // Named with its device (PAGES-49; the name decided 2026-10-16, owner).
    expect(screen.getAllByRole("button", { name: /^Sign out of / })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Sign out of Safari on iOS" })).toBeInTheDocument();
  });

  it("BAUTH-4: shows a loading state before the list resolves", () => {
    // Never resolves, so the dialog stays in its loading state.
    listMySessions.mockReturnValue(
      new Promise(() => {
        // Intentionally left pending.
      }),
    );
    renderDialog();

    expect(screen.queryByText("This device")).not.toBeInTheDocument();
  });

  it("BAUTH-4: shows an error state when the list fails to load", async () => {
    listMySessions.mockRejectedValue(new Error("boom"));
    renderDialog();

    await waitFor(() =>
      expect(screen.getByText("Could not load your sessions.")).toBeInTheDocument(),
    );
  });

  it("BAUTH-4: revokes a single other session", async () => {
    revokeMySession.mockResolvedValue({ success: true });
    renderDialog();

    await waitFor(() => expect(screen.getByText("This device")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /^Sign out of / }));

    await waitFor(() => expect(revokeMySession).toHaveBeenCalledWith(OTHER.id));
    // Revoking refetches the list.
    await waitFor(() => expect(listMySessions).toHaveBeenCalledTimes(2));
  });

  it("BAUTH-4: reports an error without clearing the list when revoking a session fails", async () => {
    revokeMySession.mockResolvedValue({ success: false, error: "unauthorized" });
    renderDialog();

    await waitFor(() => expect(screen.getByText("This device")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /^Sign out of / }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByText("This device")).toBeInTheDocument();
  });

  it("BAUTH-4: signs out of every other session", async () => {
    revokeOtherMySessions.mockResolvedValue({ success: true });
    renderDialog();

    await waitFor(() => expect(screen.getByText("This device")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Sign out the others" }));

    await waitFor(() => expect(revokeOtherMySessions).toHaveBeenCalledOnce());
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it("BAUTH-4: still offers to sign out the others when there is only this device (PAGES-35, PAGES-49)", async () => {
    listMySessions.mockResolvedValue([MINE]);
    renderDialog();

    await waitFor(() => expect(screen.getByText("This device")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Sign out the others" })).toBeInTheDocument();
  });
});

function expectOpaque(element: HTMLElement) {
  const opacity = element.style.opacity;
  expect(opacity === "" || Number(opacity) >= 1).toBe(true);
}

// docs/specs/motion.md (MOTION-27, edge case "A step nobody triggered"): the
// sessions dialog's swap from loading to the list follows the last input
// that opened it — at once after a key, a fade after a pointer.
describe("MOTION-27: SessionsDialog — loading to the list", () => {
  it("MOTION-27: the list is drawn with no inline opacity below 1 when a key opened the dialog", async () => {
    await withAnimations(async (clock) => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
      renderDialog();
      await waitFor(() => expect(listMySessions).toHaveBeenCalledOnce());
      // `AnimatePresence mode="wait"`: the loading state's exit must finish
      // before the list mounts — real animations are frozen by
      // `withAnimations`, so the clock has to be moved past it by hand.
      await clock.finish();

      const list = await screen.findByText("This device");
      expectOpaque(list.closest("ul") as HTMLElement);
    });
  });

  it("MOTION-27: the list still fades in when a pointer opened the dialog, with an inline opacity below 1 right after", async () => {
    await withAnimations(async (clock) => {
      window.dispatchEvent(new PointerEvent("pointerdown"));
      renderDialog();
      await waitFor(() => expect(listMySessions).toHaveBeenCalledOnce());
      await clock.finish();

      const list = await screen.findByText("This device");
      expect(Number((list.closest("ul") as HTMLElement).style.opacity)).toBeLessThan(1);
    });
  });
});

// docs/specs/motion.md (MOTION-27): a revoked session's row follows the
// input that revoked it — leaving in the same tick after a key, still
// mounted right after a pointer press.
describe("MOTION-27: SessionsDialog — a revoked row leaving", () => {
  it("MOTION-27: Enter on «Sign out of Safari on iOS» removes its row with no transition left in flight", async () => {
    listMySessions.mockReset();
    listMySessions.mockResolvedValueOnce([MINE, OTHER]).mockResolvedValueOnce([MINE]);
    revokeMySession.mockResolvedValue({ success: true });
    await withAnimations(async (clock) => {
      renderDialog();
      await waitFor(() => expect(listMySessions).toHaveBeenCalledOnce());
      // `AnimatePresence mode="wait"`: the loading state's exit must finish
      // before the list mounts, to even reach the row under test.
      await clock.finish();
      await screen.findByText("Safari on iOS");
      const revokeButton = screen.getByRole("button", { name: "Sign out of Safari on iOS" });
      revokeButton.focus();

      await userEvent.keyboard("{Enter}");

      await waitFor(() => expect(screen.queryByText("Safari on iOS")).not.toBeInTheDocument());
    });
  });

  it("MOTION-27: a pointer press on «Sign out of Safari on iOS» leaves its row mounted right after", async () => {
    listMySessions.mockReset();
    listMySessions.mockResolvedValueOnce([MINE, OTHER]).mockResolvedValueOnce([MINE]);
    revokeMySession.mockResolvedValue({ success: true });
    await withAnimations(async (clock) => {
      renderDialog();
      await waitFor(() => expect(listMySessions).toHaveBeenCalledOnce());
      await clock.finish();
      await screen.findByText("Safari on iOS");
      const revokeButton = screen.getByRole("button", { name: "Sign out of Safari on iOS" });

      await userEvent.click(revokeButton);

      await waitFor(() => expect(listMySessions).toHaveBeenCalledTimes(2));
      expect(screen.getByText("Safari on iOS")).toBeInTheDocument();
    });
  });
});
