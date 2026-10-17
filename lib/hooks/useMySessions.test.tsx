import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

vi.mock("@/server/account/actions", () => ({
  listMySessions: vi.fn(),
  revokeMySession: vi.fn(),
  revokeOtherMySessions: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import * as Sentry from "@sentry/nextjs";
import { listMySessions, revokeMySession, revokeOtherMySessions } from "@/server/account/actions";
import { useMySessions } from "./useMySessions";

const SESSION_A = {
  id: "session-a",
  userAgent: "ua-a",
  ipAddress: "1.1.1.1",
  lastUsedAt: new Date(),
  current: true,
};

beforeEach(() => {
  vi.mocked(listMySessions).mockReset();
  vi.mocked(revokeMySession).mockReset();
  vi.mocked(revokeOtherMySessions).mockReset();
  vi.mocked(Sentry.captureException).mockReset();
});

// BAUTH-4 (docs/specs/core-better-auth.md): owns the request lifecycle of
// the «Sesiones» dialog on /account. Since docs/specs/redesign-pages.md
// (PAGES-49; BAUTH-4 amended) the list is read again each time the dialog
// opens, which mounts the hook. It no longer waits on the client session to
// decide whether to read — only the signed-in page opens the dialog, and
// listMySessions answers nothing to a signed-out caller — so the old
// "asks for nothing when nobody is signed in" case is replaced by the
// re-read on every mount.
describe("useMySessions", () => {
  it("BAUTH-4: reads the list again each time it mounts (PAGES-49)", async () => {
    vi.mocked(listMySessions).mockResolvedValue([SESSION_A]);

    const first = renderHook(() => useMySessions());
    await waitFor(() => expect(first.result.current.status).toBe("ready"));
    first.unmount();
    const second = renderHook(() => useMySessions());
    await waitFor(() => expect(second.result.current.status).toBe("ready"));

    expect(listMySessions).toHaveBeenCalledTimes(2);
  });

  it("BAUTH-4: loads the signed-in user's sessions", async () => {
    vi.mocked(listMySessions).mockResolvedValue([SESSION_A]);

    const { result } = renderHook(() => useMySessions());

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.sessions).toEqual([SESSION_A]);
  });

  it("BAUTH-4: reports an error state and reports it to Sentry when the list fails", async () => {
    vi.mocked(listMySessions).mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useMySessions());

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it("BAUTH-4: reads the list again on reload, after a failure (PAGES-50)", async () => {
    vi.mocked(listMySessions).mockRejectedValueOnce(new Error("boom"));
    vi.mocked(listMySessions).mockResolvedValueOnce([SESSION_A]);

    const { result } = renderHook(() => useMySessions());
    await waitFor(() => expect(result.current.status).toBe("error"));
    await result.current.reload();

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.sessions).toEqual([SESSION_A]);
  });

  it("BAUTH-4: refetches after revoking one session", async () => {
    vi.mocked(listMySessions).mockResolvedValue([SESSION_A]);
    vi.mocked(revokeMySession).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useMySessions());
    await waitFor(() => expect(result.current.status).toBe("ready"));

    const outcome = await result.current.revokeSession("session-b");

    expect(outcome).toEqual({ success: true });
    await waitFor(() => expect(listMySessions).toHaveBeenCalledTimes(2));
  });

  it("BAUTH-4: does not refetch when revoking a session fails", async () => {
    vi.mocked(listMySessions).mockResolvedValue([SESSION_A]);
    vi.mocked(revokeMySession).mockResolvedValue({ success: false, error: "unauthorized" });

    const { result } = renderHook(() => useMySessions());
    await waitFor(() => expect(result.current.status).toBe("ready"));

    const outcome = await result.current.revokeSession("session-b");

    expect(outcome).toEqual({ success: false, error: "unauthorized" });
    expect(listMySessions).toHaveBeenCalledTimes(1);
  });

  it("BAUTH-4: refetches after revoking every other session", async () => {
    vi.mocked(listMySessions).mockResolvedValue([SESSION_A]);
    vi.mocked(revokeOtherMySessions).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useMySessions());
    await waitFor(() => expect(result.current.status).toBe("ready"));

    const outcome = await result.current.revokeOthers();

    expect(outcome).toEqual({ success: true });
    await waitFor(() => expect(listMySessions).toHaveBeenCalledTimes(2));
  });
});

// docs/specs/redesign-pages.md (Edge cases, «No sessions listed»): the user's
// own session is always listed, so a read that answers none means this
// session ended elsewhere — the failed read, never an empty list.
describe("useMySessions with no session listed", () => {
  it("PAGES-50: a read that answers no session is the error state, with nothing reported to Sentry", async () => {
    vi.mocked(listMySessions).mockResolvedValue([]);

    const { result } = renderHook(() => useMySessions());

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.sessions).toEqual([]);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
