// A controllable IntersectionObserver for jsdom. The real observer never fires
// in tests, so we record every observed instance and expose a helper that
// simulates the sentinel scrolling into view — the trigger for infinite scroll.
type Cb = IntersectionObserverCallback;

const observers: { cb: Cb; instance: IntersectionObserver }[] = [];

export class ControlledIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds: ReadonlyArray<number> = [];
  private cb: Cb;

  constructor(cb: Cb) {
    this.cb = cb;
  }

  observe = () => {
    observers.push({ cb: this.cb, instance: this });
  };
  unobserve = () => {
    /* tests reset observers via resetIntersectionObservers instead */
  };
  disconnect = () => {
    /* tests reset observers via resetIntersectionObservers instead */
  };
  takeRecords = () => [];
}

/** Simulate every observed sentinel becoming visible. */
export function triggerIntersection() {
  observers.forEach(({ cb, instance }) => {
    cb([{ isIntersecting: true } as IntersectionObserverEntry], instance);
  });
}

export function resetIntersectionObservers() {
  observers.length = 0;
}
