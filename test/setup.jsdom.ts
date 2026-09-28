import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, expect, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import * as axeMatchers from "vitest-axe/matchers";
import { server } from "./msw/server";
import {
  ControlledIntersectionObserver,
  resetIntersectionObservers,
} from "./mocks/intersection-observer";

expect.extend(axeMatchers);

// --- MSW lifecycle: unhandled requests fail loudly so tests stay deterministic.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetIntersectionObservers();
});
afterAll(() => server.close());

// --- Browser APIs jsdom doesn't implement but the app relies on. ---

// IntersectionObserver — the infinite-scroll sentinel in useListingsSearch.
// Controllable so tests can simulate the sentinel entering the viewport.
vi.stubGlobal("IntersectionObserver", ControlledIntersectionObserver);

// ResizeObserver — Radix UI primitives.
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal("ResizeObserver", MockResizeObserver);

// matchMedia — next-themes and motion's prefers-reduced-motion checks.
vi.stubGlobal(
  "matchMedia",
  vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
);

// geolocation — defaults to "unavailable" (error callback) so the app falls
// back to the Spain center. Tests wanting a real fix override navigator.geolocation.
Object.defineProperty(navigator, "geolocation", {
  configurable: true,
  value: {
    getCurrentPosition: vi.fn((_success: PositionCallback, error?: PositionErrorCallback | null) =>
      error?.({ code: 1, message: "denied" } as GeolocationPositionError),
    ),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  },
});

// Radix Select calls these on option elements; jsdom has no layout engine.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}
window.scrollTo = vi.fn();

// Pointer capture — jsdom implements no part of the Pointer Events API, and
// Radix Select's trigger calls these directly on pointerdown. Without them the
// trigger throws before the listbox ever opens.
Element.prototype.hasPointerCapture = vi.fn(() => false);
Element.prototype.setPointerCapture = vi.fn();
Element.prototype.releasePointerCapture = vi.fn();

// axe's colour-contrast rule reaches for a canvas jsdom doesn't implement.
// Stub getContext so the (skipped-anyway) contrast check stops warning.
HTMLCanvasElement.prototype.getContext =
  vi.fn() as unknown as typeof HTMLCanvasElement.prototype.getContext;
