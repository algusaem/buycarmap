import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { makeFavoriteInput } from "@/test/fixtures/favorites";

const useSession = vi.fn();
vi.mock("@/lib/auth/auth-client", () => ({
  authClient: { useSession: () => useSession() },
}));
vi.mock("@/server/favorites/actions", () => ({ listFavorites: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import * as Sentry from "@sentry/nextjs";
import { listFavorites } from "@/server/favorites/actions";
import { useFavorites } from "./useFavorites";

const signedIn = () =>
  useSession.mockReturnValue({
    data: { user: { id: "user-ada" } },
    isPending: false,
  });
const signedOut = () => useSession.mockReturnValue({ data: null, isPending: false });

beforeEach(() => {
  vi.mocked(listFavorites).mockReset();
  vi.mocked(Sentry.captureException).mockReset();
  useSession.mockReset();
});

describe("useFavorites", () => {
  it("FAV-16: exposes the ids of the listings the user has saved", async () => {
    signedIn();
    vi.mocked(listFavorites).mockResolvedValue({
      ok: true,
      value: [
        makeFavoriteInput({ id: "wallapop-abc123" }),
        makeFavoriteInput({ id: "cochesnet-99" }),
      ],
    });

    const { result } = renderHook(() => useFavorites());

    await waitFor(() => expect(result.current.favoriteIds.size).toBe(2));
    expect(result.current.favoriteIds.has("wallapop-abc123")).toBe(true);
    expect(result.current.favoriteIds.has("cochesnet-99")).toBe(true);
  });

  it("FAV-16: asks for nothing when nobody is signed in", async () => {
    signedOut();

    const { result } = renderHook(() => useFavorites());

    await waitFor(() => expect(result.current.favoriteIds.size).toBe(0));
    // A signed-out visitor has no favorites to reconcile against, and the
    // action would only refuse.
    expect(listFavorites).not.toHaveBeenCalled();
  });

  it("FAV-16: leaves the set empty when the request fails", async () => {
    signedIn();
    vi.mocked(listFavorites).mockResolvedValue({
      ok: false,
      error: { code: "invalidListing", messageKey: "favoriteErrors.invalidListing" },
    });

    const { result } = renderHook(() => useFavorites());

    await waitFor(() => expect(listFavorites).toHaveBeenCalled());
    // Showing every card as unsaved is the honest failure: claiming a car is
    // saved when the fetch failed would be worse than admitting we don't know.
    expect(result.current.favoriteIds.size).toBe(0);
  });

  it("PLAT-12: a rejecting listFavorites leaves the set empty without an unhandled rejection", async () => {
    signedIn();
    vi.mocked(listFavorites).mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useFavorites());

    await waitFor(() => expect(Sentry.captureException).toHaveBeenCalledTimes(1));
    expect(result.current.favoriteIds.size).toBe(0);
  });

  it("FAV-16: tracks a toggle the user just made without refetching", async () => {
    signedIn();
    vi.mocked(listFavorites).mockResolvedValue({ ok: true, value: [] });
    const { result } = renderHook(() => useFavorites());
    await waitFor(() => expect(listFavorites).toHaveBeenCalled());

    act(() => result.current.setFavorite("wallapop-abc123", true));
    expect(result.current.favoriteIds.has("wallapop-abc123")).toBe(true);

    act(() => result.current.setFavorite("wallapop-abc123", false));
    expect(result.current.favoriteIds.has("wallapop-abc123")).toBe(false);
    expect(listFavorites).toHaveBeenCalledTimes(1);
  });

  it("FAV-16: drops the saved set when the session ends", async () => {
    signedIn();
    vi.mocked(listFavorites).mockResolvedValue({
      ok: true,
      value: [makeFavoriteInput({ id: "wallapop-abc123" })],
    });
    const { result, rerender } = renderHook(() => useFavorites());
    await waitFor(() => expect(result.current.favoriteIds.size).toBe(1));

    signedOut();
    rerender();

    // Otherwise the next visitor on a shared machine sees the previous one's
    // saved cars highlighted.
    await waitFor(() => expect(result.current.favoriteIds.size).toBe(0));
  });
});
