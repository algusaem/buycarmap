import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const auth = vi.hoisted(() => ({
  session: { data: null as { user: { id: string } } | null, isPending: false },
}));
const push = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/auth/auth-client", () => ({
  authClient: { useSession: () => auth.session },
}));

import { useSignInGate } from "./useSignInGate";

beforeEach(() => {
  push.mockClear();
  auth.session = { data: null, isPending: false };
});

// docs/specs/redesign-map.md (MAPUI-37, MAPUI-46); FAV-12, FAV-18. The gate's
// only public surface is `requireSession`: `status` and `redirectToSignIn`
// are private now that every caller goes through it, so these three cases —
// loading, signed out, signed in — are tested through its behaviour alone.
describe("useSignInGate requireSession", () => {
  it("FAV-18: returns false and redirects nowhere while the session is still loading", () => {
    auth.session = { data: null, isPending: true };
    const { result } = renderHook(() => useSignInGate());

    expect(result.current.requireSession("/map")).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });

  it("MAPUI-37: returns false and redirects to sign-in, with the full path and query as callbackUrl, when signed out", () => {
    // docs/specs/redesign-map.md, worked example "Sign-in return".
    const { result } = renderHook(() => useSignInGate());

    expect(result.current.requireSession("/map?make=Toyota&maxPrice=20000")).toBe(false);
    expect(push).toHaveBeenCalledWith(
      "/login?callbackUrl=%2Fmap%3Fmake%3DToyota%26maxPrice%3D20000",
    );
  });

  it("FAV-12: returns true and redirects nowhere when signed in", () => {
    auth.session = { data: { user: { id: "user-1" } }, isPending: false };
    const { result } = renderHook(() => useSignInGate());

    expect(result.current.requireSession("/map")).toBe(true);
    expect(push).not.toHaveBeenCalled();
  });
});
