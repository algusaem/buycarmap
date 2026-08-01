import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { getProviders } from "next-auth/react";
import { useOAuthProviders } from "./useOAuthProviders";

vi.mock("next-auth/react", () => ({ getProviders: vi.fn() }));

type Providers = Awaited<ReturnType<typeof getProviders>>;

function provider(id: string, type: "oauth" | "credentials") {
  return {
    id,
    name: id,
    type,
    signinUrl: `http://localhost:3000/api/auth/signin/${id}`,
    callbackUrl: `http://localhost:3000/api/auth/callback/${id}`,
  };
}

describe("useOAuthProviders", () => {
  beforeEach(() => vi.mocked(getProviders).mockReset());

  it("returns only the OAuth providers, in the order NextAuth reports them", async () => {
    // Credentials is always registered; rendering a button for it would offer
    // a second, broken email/password flow.
    vi.mocked(getProviders).mockResolvedValue({
      credentials: provider("credentials", "credentials"),
      google: provider("google", "oauth"),
      github: provider("github", "oauth"),
    } as Providers);

    const { result } = renderHook(() => useOAuthProviders());

    await waitFor(() => expect(result.current).toEqual(["google", "github"]));
  });

  it("returns nothing when only credentials is configured", async () => {
    // This is what makes OAuthButtons render no divider on a deployment with
    // no provider secrets, rather than a row of buttons that cannot work.
    vi.mocked(getProviders).mockResolvedValue({
      credentials: provider("credentials", "credentials"),
    } as Providers);

    const { result } = renderHook(() => useOAuthProviders());

    await waitFor(() => expect(getProviders).toHaveBeenCalled());
    expect(result.current).toEqual([]);
  });

  it("starts empty so the buttons never flash before the answer arrives", () => {
    vi.mocked(getProviders).mockResolvedValue({
      google: provider("google", "oauth"),
    } as Providers);

    const { result } = renderHook(() => useOAuthProviders());

    expect(result.current).toEqual([]);
  });

  it("survives NextAuth reporting no providers at all", async () => {
    // `getProviders` resolves null when the endpoint cannot be reached.
    vi.mocked(getProviders).mockResolvedValue(null);

    const { result } = renderHook(() => useOAuthProviders());

    await waitFor(() => expect(getProviders).toHaveBeenCalled());
    expect(result.current).toEqual([]);
  });
});
