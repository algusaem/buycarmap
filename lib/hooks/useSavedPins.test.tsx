import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import { makeSortExampleCar } from "@/test/fixtures/favorite-listings";
import { useSavedPins } from "./useSavedPins";

// docs/specs/redesign-saved.md (SAVED-11, SAVED-12; Decisions › Values not
// drawn): a grouped pin scrolls the first of its cards in the list's order,
// opens its preview on its cheapest car, and outlines every card it holds. A
// car with no coordinates has no pin to activate.

function wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="es" messages={esMessages} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
}

// G at A's point in Madrid, at 19.750 €, first in the list: the pin holds A
// and G, A first by price, while G comes first in the list.
const G_AT_A = makeSortExampleCar("G", {
  price: 19750,
  location: "Madrid",
  lat: 40.4168,
  lng: -3.7038,
});
const LIST = [G_AT_A, makeSortExampleCar("A"), makeSortExampleCar("B")];

describe("SAVED-11: activating a grouped pin", () => {
  it("SAVED-11: A's pin, shared with G, returns G's index 0 to scroll to, outlines A and G, and opens the preview on A", () => {
    const { result } = renderHook(() => useSavedPins(LIST), { wrapper });

    let index = Number.NaN;
    act(() => {
      index = result.current.activatePin("wallapop-a");
    });

    expect(index).toBe(0);
    expect(result.current.activeIds).toEqual(new Set(["wallapop-a", "wallapop-g"]));
    expect(result.current.previewId).toBe("wallapop-a");
  });

  it("SAVED-11: a car with no coordinates has no pin: it returns -1 and opens no preview", () => {
    const withNoPoint = [...LIST, makeSortExampleCar("C", { lat: Number.NaN, lng: Number.NaN })];
    const { result } = renderHook(() => useSavedPins(withNoPoint), { wrapper });

    let index = Number.NaN;
    act(() => {
      index = result.current.activatePin("wallapop-c");
    });

    expect(index).toBe(-1);
    expect(result.current.previewId).toBeNull();
    expect(result.current.activeIds.size).toBe(0);
  });
});
