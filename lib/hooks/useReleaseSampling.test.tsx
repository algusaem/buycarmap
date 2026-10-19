import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useReleaseSampling } from "./useReleaseSampling";

function Harness({ onReady }: { onReady: (api: ReturnType<typeof useReleaseSampling>) => void }) {
  const api = useReleaseSampling();
  onReady(api);
  return <div data-testid="handle" onPointerDown={api.start} />;
}

/** Renders the harness and returns its hook API, with no definite-assignment assertion. */
function renderHarness() {
  let api: ReturnType<typeof useReleaseSampling> | undefined;
  const view = render(
    <Harness
      onReady={(value) => {
        api = value;
      }}
    />,
  );
  if (!api) throw new Error("Harness did not report the hook API");
  return { ...view, api };
}

/** A real pointer event with `timeStamp` pinned, since the constructor cannot set it. */
function pointerEventWithTimestamp(
  type: string,
  {
    clientY,
    timeStamp,
    pointerId = 1,
    isPrimary = true,
  }: { clientY: number; timeStamp: number; pointerId?: number; isPrimary?: boolean },
): PointerEvent {
  // `bubbles: true` so the press dispatched on the handle still reaches React's delegated
  // listener; the constructor defaults to false, unlike `fireEvent.pointerDown`'s own default.
  const event = new PointerEvent(type, {
    clientY,
    pointerId,
    isPrimary,
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, "timeStamp", { value: timeStamp, configurable: true });
  return event;
}

// docs/specs/motion.md (MOTION-20): `start` ignores a pointer that is not
// primary, so a second finger's pointerdown never begins sampling.
describe("useReleaseSampling start", () => {
  it("MOTION-20: a non-primary pointerdown starts nothing — its release does not change the stored velocity", () => {
    const { api } = renderHarness();

    fireEvent.pointerDown(screen.getByTestId("handle"), {
      pointerId: 2,
      isPrimary: false,
      clientY: 100,
    });
    window.dispatchEvent(
      new PointerEvent("pointerup", { pointerId: 2, isPrimary: false, clientY: 500 }),
    );

    expect(api.releaseVelocityRef.current).toBe(0);
    expect(api.pressRef.current).toBeNull();
  });

  it("MOTION-20: unmounting while a press is in progress removes its window listeners — a pointerup after unmount does not set the velocity", () => {
    const { api, unmount } = renderHarness();
    const releaseVelocityRef = api.releaseVelocityRef;

    fireEvent(
      screen.getByTestId("handle"),
      pointerEventWithTimestamp("pointerdown", { clientY: 100, timeStamp: 0, pointerId: 1 }),
    );
    expect(api.pressRef.current).not.toBeNull();

    unmount();

    // The unmount's cleanup effect already called the press's own `stop`, removing its window
    // listeners, so this release is never seen.
    window.dispatchEvent(
      pointerEventWithTimestamp("pointerup", { clientY: 160, timeStamp: 50, pointerId: 1 }),
    );

    expect(releaseVelocityRef.current).toBe(0);
  });

  it("MOTION-20: a second primary press stops the first's sampling — only the second pointer's release sets the velocity", () => {
    const { api } = renderHarness();
    const releaseVelocityRef = api.releaseVelocityRef;
    const handle = screen.getByTestId("handle");

    // Press 1 (pointerId 1) at clientY 100, t=0.
    fireEvent(
      handle,
      pointerEventWithTimestamp("pointerdown", { clientY: 100, timeStamp: 0, pointerId: 1 }),
    );

    // Press 2 (pointerId 2) at clientY 300, t=10ms, while 1 is still sampling: `start` stops
    // press 1 first, so its window listeners are gone before it can release.
    fireEvent(
      handle,
      pointerEventWithTimestamp("pointerdown", { clientY: 300, timeStamp: 10, pointerId: 2 }),
    );

    // Pointer 1's release: no listener is left for it, so this changes nothing.
    window.dispatchEvent(
      pointerEventWithTimestamp("pointerup", { clientY: 160, timeStamp: 50, pointerId: 1 }),
    );
    expect(releaseVelocityRef.current).toBe(0);

    // Pointer 2's release: 300→380 over 80ms. No sample is 100ms older than the release, so the
    // press itself (t=10) is the reference: (380 - 300) / (90 - 10) * 1000 = 1000px/s.
    window.dispatchEvent(
      pointerEventWithTimestamp("pointerup", { clientY: 380, timeStamp: 90, pointerId: 2 }),
    );
    expect(releaseVelocityRef.current).toBe(1000);
  });
});
