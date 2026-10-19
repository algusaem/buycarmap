// docs/specs/motion.md (MOTION-20); docs/specs/redesign-map.md (MAPUI-60,
// worked examples «A fast flick on an idle page» and «A flick after a hold»).
// How fast a press on a sheet's handle was moving when it let go, measured
// from the pointer events themselves. The results sheet and the phone bottom
// sheets read it, not Motion's drag velocity: Motion stamps the press with the
// last frame it drew, which is stale when nothing was animating, so a flick
// drawn in a single frame read as almost no speed at all.

/** How far back a release's speed looks, in ms: the same window Motion's own drag velocity uses. */
const RELEASE_VELOCITY_WINDOW_MS = 100;

/** A press held still this long before its first move is not part of the flick, in ms. */
const HOLD_MS = 200;

/** Where a press's pointer was, and when (the event's own `timeStamp`, in ms). */
export interface PointerSample {
  y: number;
  time: number;
}

/** What a press is started from: a pointerdown, React's or the DOM's. */
interface PressStart {
  pointerId: number;
  clientY: number;
  timeStamp: number;
}

/**
 * The release's vertical speed in px/s, positive downward: from the last
 * sample back to the newest one at least the window older, or to the first
 * sample. When that is the first sample and the next one came more than
 * HOLD_MS after it (the press was held still), the next one is the reference.
 */
export function releaseVelocity(samples: PointerSample[]): number {
  const last = samples.at(-1);
  if (!last) return 0;
  const [first, second] = samples;
  const windowed =
    samples.findLast((sample) => last.time - sample.time >= RELEASE_VELOCITY_WINDOW_MS) ?? first;
  const held = windowed === first && samples.length > 2 && second.time - first.time > HOLD_MS;
  const reference = held ? second : windowed;
  const elapsed = last.time - reference.time;
  if (elapsed <= 0) return 0;
  return ((last.y - reference.y) / elapsed) * 1000;
}

/**
 * Samples the press that `start` began, every move of its pointer and its
 * release, on the window, and calls `onRelease` with the release's speed
 * (releaseVelocity) once that pointer is let go or cancelled. Other pointers
 * are ignored. Returns a function that stops sampling without calling it.
 */
export function samplePress(start: PressStart, onRelease: (velocity: number) => void): () => void {
  const { pointerId } = start;
  const samples: PointerSample[] = [{ y: start.clientY, time: start.timeStamp }];
  function stop() {
    window.removeEventListener("pointermove", track, { capture: true });
    window.removeEventListener("pointerup", end, { capture: true });
    window.removeEventListener("pointercancel", end, { capture: true });
  }
  function track(event: PointerEvent) {
    if (event.pointerId !== pointerId) return;
    samples.push({ y: event.clientY, time: event.timeStamp });
    // The press (index 0) is always kept, so a held press is still found as
    // the reference; only a middle sample past the window is dropped.
    const lastTime = event.timeStamp;
    while (samples.length > 3 && lastTime - samples[2].time >= RELEASE_VELOCITY_WINDOW_MS) {
      samples.splice(1, 1);
    }
  }
  function end(event: PointerEvent) {
    if (event.pointerId !== pointerId) return;
    stop();
    // A cancel carries no position of its own: the last move's is the release's.
    if (event.type === "pointerup") samples.push({ y: event.clientY, time: event.timeStamp });
    onRelease(releaseVelocity(samples));
  }
  window.addEventListener("pointermove", track, { capture: true });
  window.addEventListener("pointerup", end, { capture: true });
  window.addEventListener("pointercancel", end, { capture: true });
  return stop;
}
