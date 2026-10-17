import { afterAll, beforeAll, vi } from "vitest";

// jsdom matches no media query and lays nothing out. These stand in for the
// two things a test of a width-dependent, virtualised page needs: a phone's
// media query, and boxes with a size.

/** The jsdom-wide stub from test/setup.jsdom.ts, which matches nothing (desktop). */
const desktopMatchMedia = window.matchMedia;

/** The query useIsPhone (lib/hooks/useIsPhone.ts) reads. */
const PHONE_QUERY = "(width < 64rem)";

type Width = "phone" | "desktop";

/**
 * Makes the width `initial`, until restoreMatchMedia: at "phone" only
 * useIsPhone's `(width < 64rem)` matches, at "desktop" no query does. The
 * returned `switchTo` changes it and fires `change` on every query listened
 * to, as resizing the window across `lg` does; call it inside `act()`.
 */
export function stubSwitchableWidth(initial: Width): { switchTo: (width: Width) => void } {
  let current = initial;
  const listeners = new Set<EventListenerOrEventListenerObject>();
  window.matchMedia = vi.fn((query: string) => ({
    get matches() {
      return current === "phone" && query === PHONE_QUERY;
    },
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === "change") listeners.add(listener);
    },
    removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === "change") listeners.delete(listener);
    },
    dispatchEvent: vi.fn(),
  }));
  return {
    switchTo(width) {
      current = width;
      const event = new Event("change");
      for (const listener of [...listeners]) {
        if (typeof listener === "function") listener(event);
        else listener.handleEvent(event);
      }
    },
  };
}

/** Makes useIsPhone (lib/hooks/useIsPhone.ts, `(width < 64rem)`) report a phone, until restoreMatchMedia. */
export function stubPhoneWidth(): void {
  stubSwitchableWidth("phone");
}

/** Puts the jsdom-wide stub back: no query matches, so the page is the desktop's. */
export function restoreMatchMedia(): void {
  window.matchMedia = desktopMatchMedia;
}

/**
 * For the whole file, every element reports a box `width` wide and `height`
 * tall. A virtualised list (@tanstack/react-virtual reads its scroll element's
 * offsetWidth and offsetHeight) would otherwise see a 0px view and mount
 * nothing; with a tall box it mounts every one of a test's few items, as a
 * real screen would.
 */
export function stubLayoutBox({ width, height = 4000 }: { width: number; height?: number }): void {
  const realHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
  const realWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get: () => height,
    });
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      get: () => width,
    });
  });
  afterAll(() => {
    if (realHeight) Object.defineProperty(HTMLElement.prototype, "offsetHeight", realHeight);
    if (realWidth) Object.defineProperty(HTMLElement.prototype, "offsetWidth", realWidth);
  });
}
