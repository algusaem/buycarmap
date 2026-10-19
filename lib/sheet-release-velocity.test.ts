import { describe, expect, it, vi } from "vitest";
import { releaseVelocity, samplePress } from "./sheet-release-velocity";

// docs/specs/redesign-map.md (MAPUI-60, worked examples «A fast flick on an
// idle page» and «A flick after a hold»); docs/specs/motion.md (MOTION-20):
// the release speed is measured from the pointer events themselves — the
// distance from the newest sample at least 100ms older than the release (or
// the press, when none is that old) to the release, over the time between
// them — in px/s, positive downward. When that reference would be the press
// and the next sample is more than 200ms after it, the next sample is the
// reference instead. A drag released faster than 800px/s moves the results
// sheet one position, and closes a phone bottom sheet.

describe("MAPUI-60: releaseVelocity reads the release's speed from the pointer samples", () => {
  it("MAPUI-60: with no sample 100ms older than the release, the press is the reference — 500→440 over 10ms is -6000px/s", () => {
    const samples = [
      { y: 500, time: 0 },
      { y: 440, time: 10 },
    ];
    expect(releaseVelocity(samples)).toBe(-6000);
  });

  it("MAPUI-60: the reference is the newest sample at least 100ms older than the release — t=80, not t=150 or the press", () => {
    // The release is at t=200. t=150 is only 50ms older and does not count;
    // t=0 and t=80 both do, and t=80 is the newest of them:
    // (160 - 100) / (200 - 80) * 1000 = 500px/s. The t=150 sample's y (140)
    // is off the line, so a reference of t=150 (400px/s) or of the press
    // (800px/s) would read a different number.
    const samples = [
      { y: 0, time: 0 },
      { y: 100, time: 80 },
      { y: 140, time: 150 },
      { y: 160, time: 200 },
    ];
    expect(releaseVelocity(samples)).toBe(500);
  });

  it("MAPUI-60: a flick after a hold — the press is over 200ms before the first move, so the move at 500ms is the reference: 30px up over 20ms is -1500px/s", () => {
    // Worked example «A flick after a hold»: pressed at 0ms and held, moved
    // 30px up at 500ms and 60px up at 516ms, released at 520ms at 60px. No
    // sample is 100ms older than the release but the press, and measured
    // from the press it would read 60px over 520ms, about -115px/s.
    const samples = [
      { y: 600, time: 0 },
      { y: 570, time: 500 },
      { y: 540, time: 516 },
      { y: 540, time: 520 },
    ];
    expect(releaseVelocity(samples)).toBe(-1500);
  });

  it("MAPUI-60: a single sample (no movement recorded) is 0", () => {
    const samples = [{ y: 123, time: 999 }];
    expect(releaseVelocity(samples)).toBe(0);
  });

  it("MAPUI-60: zero elapsed time is 0, not a division by zero", () => {
    const samples = [
      { y: 0, time: 50 },
      { y: 200, time: 50 },
    ];
    expect(releaseVelocity(samples)).toBe(0);
  });
});

/** A real pointer event with `timeStamp` and `pointerId` pinned, since the constructor cannot set `timeStamp`. */
function pointerEvent(
  type: string,
  {
    clientY,
    timeStamp,
    pointerId = 1,
    isPrimary = true,
  }: { clientY: number; timeStamp: number; pointerId?: number; isPrimary?: boolean },
): PointerEvent {
  const event = new PointerEvent(type, { clientY, pointerId, isPrimary });
  Object.defineProperty(event, "timeStamp", { value: timeStamp, configurable: true });
  return event;
}

describe("MOTION-20: samplePress trims to the press plus the release window, through real pointer events", () => {
  it("MOTION-20: a fast flick with no pause — press 100@0, move 120@50, move 160@150, up 180@200 — reports 400", () => {
    const onRelease = vi.fn();
    samplePress({ pointerId: 1, clientY: 100, timeStamp: 0 }, onRelease);

    window.dispatchEvent(pointerEvent("pointermove", { clientY: 120, timeStamp: 50 }));
    window.dispatchEvent(pointerEvent("pointermove", { clientY: 160, timeStamp: 150 }));
    window.dispatchEvent(pointerEvent("pointerup", { clientY: 180, timeStamp: 200 }));

    expect(onRelease).toHaveBeenCalledWith(400);
  });

  it("MOTION-20: a pause after the first move — press 0@0, move -10@50, move -40@400, move -70@416, up -70@420 — reports about -162.16; this failed before the trimming fix because the shift dropped the press instead of a middle sample", () => {
    const onRelease = vi.fn();
    samplePress({ pointerId: 1, clientY: 0, timeStamp: 0 }, onRelease);

    window.dispatchEvent(pointerEvent("pointermove", { clientY: -10, timeStamp: 50 }));
    window.dispatchEvent(pointerEvent("pointermove", { clientY: -40, timeStamp: 400 }));
    window.dispatchEvent(pointerEvent("pointermove", { clientY: -70, timeStamp: 416 }));
    window.dispatchEvent(pointerEvent("pointerup", { clientY: -70, timeStamp: 420 }));

    expect(onRelease).toHaveBeenCalledTimes(1);
    expect(onRelease.mock.calls[0][0]).toBeCloseTo(-60 / 0.37, 2);
  });

  it("MOTION-20: a pointercancel carries no position of its own — press 100@0, move 160@20, cancel@30 with clientY 999 — reports 3000, from the last move, not the cancel's clientY", () => {
    // The cancel's clientY (999) is never read: `end` only pushes a sample for
    // a "pointerup". With only the press and the one move, no sample is
    // 100ms older than the release (t=20) but the press itself, and
    // samples.length is 2 (not > 2), so `held` is false: the reference stays
    // the windowed sample (the press, via the `?? first` fallback), giving
    // (160 - 100) / (20 - 0) * 1000 = 3000px/s.
    const onRelease = vi.fn();
    samplePress({ pointerId: 1, clientY: 100, timeStamp: 0 }, onRelease);

    window.dispatchEvent(pointerEvent("pointermove", { clientY: 160, timeStamp: 20 }));
    window.dispatchEvent(pointerEvent("pointercancel", { clientY: 999, timeStamp: 30 }));

    expect(onRelease).toHaveBeenCalledWith(3000);
  });

  it("MAPUI-60: a flick after a hold, through samplePress — press 600@0, move 570@500, move 540@516, up 540@520 — reports -1500", () => {
    const onRelease = vi.fn();
    samplePress({ pointerId: 1, clientY: 600, timeStamp: 0 }, onRelease);

    window.dispatchEvent(pointerEvent("pointermove", { clientY: 570, timeStamp: 500 }));
    window.dispatchEvent(pointerEvent("pointermove", { clientY: 540, timeStamp: 516 }));
    window.dispatchEvent(pointerEvent("pointerup", { clientY: 540, timeStamp: 520 }));

    expect(onRelease).toHaveBeenCalledWith(-1500);
  });
});

describe("MOTION-20: samplePress follows one pointer until it is let go", () => {
  it("MOTION-20: another pointer's release does not end the press; its own release reports once", () => {
    const onRelease = vi.fn();
    samplePress({ pointerId: 1, clientY: 100, timeStamp: 0 }, onRelease);

    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 2, clientY: 300 }));
    expect(onRelease).not.toHaveBeenCalled();

    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1, clientY: 160 }));
    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1, clientY: 160 }));
    expect(onRelease).toHaveBeenCalledTimes(1);
  });

  it("MOTION-20: a press stopped before its release reports nothing", () => {
    const onRelease = vi.fn();
    const stop = samplePress({ pointerId: 1, clientY: 100, timeStamp: 0 }, onRelease);

    stop();
    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1, clientY: 160 }));

    expect(onRelease).not.toHaveBeenCalled();
  });
});
