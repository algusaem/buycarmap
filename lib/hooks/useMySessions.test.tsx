import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const useSession = vi.fn();
vi.mock("@/lib/auth/auth-client", () => ({
  authClient: { useSession: () => useSession() },
}));
vi.mock("@/server/account/actions", () => ({
  listMySessions: vi.fn(),
  revokeMySession: vi.fn(),
  revokeOtherMySessions: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import * as Sentry from "@sentry/nextjs";
import { listMySessions, revokeMySession, revokeOtherMySessions } from "@/server/account/actions";
import { useMySessions } from "./useMySessions";

const signedIn = () =>
  useSession.mockReturnValue({ data: { user: { id: "user-ada" } }, isPending: false });
const signedOut = () => useSession.mockReturnValue({ data: null, isPending: false });

const SESSION_A = {
  id: "session-a",
  userAgent: "ua-a",
  ipAddress: "1.1.1.1",
  lastUsedAt: new Date(),
  current: true,
};

beforeEach(() => {
  useSession.mockReset();
  vi.mocked(listMySessions).mockReset();
  vi.mocked(revokeMySession).mockReset();
  vi.mocked(revokeOtherMySessions).mockReset();
  vi.mocked(Sentry.captureException).mockReset();
});

// BAUTH-4 (docs/specs/core-better-auth.md): owns the request lifecycle for
// the "Active sessions" section on /account.
describe("useMySessions", () => {
  it("BAUTH-4: asks for nothing and reports no sessions when nobody is signed in", async () => {
    signedOut();

    const { result } = renderHook(() => useMySessions());

    await waitFor(() => expect(result.current.sessions).toEqual([]));
    expect(listMySessions).not.toHaveBeenCalled();
  });

  it("BAUTH-4: loads the signed-in user's sessions", async () => {
    signedIn();
    vi.mocked(listMySessions).mockResolvedValue([SESSION_A]);

    const { result } = renderHook(() => useMySessions());

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.sessions).toEqual([SESSION_A]);
  });

  it("BAUTH-4: reports an error state and reports it to Sentry when the list fails", async () => {
    signedIn();
    vi.mocked(listMySessions).mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useMySessions());

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it("BAUTH-4: refetches after revoking one session", async () => {
    signedIn();
    vi.mocked(listMySessions).mockResolvedValue([SESSION_A]);
    vi.mocked(revokeMySession).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useMySessions());
    await waitFor(() => expect(result.current.status).toBe("ready"));

    const outcome = await result.current.revokeSession("session-b");

    expect(outcome).toEqual({ success: true });
    await waitFor(() => expect(listMySessions).toHaveBeenCalledTimes(2));
  });

  it("BAUTH-4: does not refetch when revoking a session fails", async () => {
    signedIn();
    vi.mocked(listMySessions).mockResolvedValue([SESSION_A]);
    vi.mocked(revokeMySession).mockResolvedValue({ success: false, error: "unauthorized" });

    const { result } = renderHook(() => useMySessions());
    await waitFor(() => expect(result.current.status).toBe("ready"));

    const outcome = await result.current.revokeSession("session-b");

    expect(outcome).toEqual({ success: false, error: "unauthorized" });
    expect(listMySessions).toHaveBeenCalledTimes(1);
  });

  it("BAUTH-4: refetches after revoking every other session", async () => {
    signedIn();
    vi.mocked(listMySessions).mockResolvedValue([SESSION_A]);
    vi.mocked(revokeOtherMySessions).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useMySessions());
    await waitFor(() => expect(result.current.status).toBe("ready"));

    const outcome = await result.current.revokeOthers();

    expect(outcome).toEqual({ success: true });
    await waitFor(() => expect(listMySessions).toHaveBeenCalledTimes(2));
  });
});
