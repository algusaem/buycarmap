import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { CarListing } from "@/interfaces/listing";
import { useMapPageState } from "./useMapPageState";

vi.mock("next/navigation", () => ({
  usePathname: () => "/map",
  useSearchParams: () => ({ toString: () => "" }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/lib/auth/auth-client", () => ({
  authClient: { useSession: () => ({ data: null, isPending: false }) },
}));

function listing(id: string): CarListing {
  return {
    id,
    image: "",
    title: id,
    subtitle: "",
    price: 1000,
    mileage: 1000,
    year: 2020,
    fuel: "gasoline",
    brand: "Seat",
    model: "Ibiza",
    location: "Madrid",
    source: "Wallapop",
    lat: 40.4168,
    lng: -3.7038,
    url: "https://example.test",
  };
}

// docs/specs/redesign-map.md (MAPUI-27): a preview whose car dropped out of
// the current results (a new search, a filter change) must not keep that
// pin marked active — otherwise the preview and the pin would point at a
// car that no longer appears anywhere in the list. And if that same car
// comes back in a later search, its pin starts inactive again: the id is
// reset for good, not just filtered out of the derived value while absent.
describe("useMapPageState preview outliving its pin", () => {
  it("MAPUI-27: clears previewId and the active pin once the previewed listing leaves the results", () => {
    const first = [listing("a"), listing("b")];
    const { result, rerender } = renderHook(({ listings }) => useMapPageState(listings, false), {
      initialProps: { listings: first },
    });

    act(() => result.current.activatePin("a"));
    expect(result.current.previewId).toBe("a");
    expect(result.current.activeId).toBe("a");

    // A new search's results no longer include "a".
    const next = [listing("c"), listing("d")];
    rerender({ listings: next });

    expect(result.current.previewId).toBeNull();
    expect(result.current.activeId).toBeNull();
  });

  it("MAPUI-27: leaves the preview alone while the previewed listing is still among the results", () => {
    const listings = [listing("a"), listing("b")];
    const { result } = renderHook(({ listings }) => useMapPageState(listings, false), {
      initialProps: { listings },
    });

    act(() => result.current.activatePin("b"));

    expect(result.current.previewId).toBe("b");
  });

  it("MAPUI-27: the car leaving and then coming back in a later search stays inactive and unpreviewed", () => {
    const first = [listing("a"), listing("b")];
    const { result, rerender } = renderHook(({ listings }) => useMapPageState(listings, false), {
      initialProps: { listings: first },
    });

    act(() => result.current.activatePin("a"));
    expect(result.current.previewId).toBe("a");

    // "a" drops out of a later search, then a search after that brings it back.
    rerender({ listings: [listing("c"), listing("d")] });
    rerender({ listings: [listing("a"), listing("b")] });

    expect(result.current.previewId).toBeNull();
    expect(result.current.activeId).toBeNull();
  });
});
