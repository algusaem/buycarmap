import { beforeEach, describe, expect, it, vi } from "vitest";

// The module caches both the position and the in-flight promise at module
// scope, with no reset hook. resetModules + a fresh import per test is the only
// way to get a clean one.
async function freshModule() {
  vi.resetModules();
  return import("./user-location");
}

function stubGeolocation(
  impl: (success: PositionCallback, error?: PositionErrorCallback | null) => void,
) {
  const getCurrentPosition = vi.fn(impl);
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition, watchPosition: vi.fn(), clearWatch: vi.fn() },
  });
  return getCurrentPosition;
}

const MADRID = { coords: { latitude: 40.4168, longitude: -3.7038 } };

beforeEach(() => vi.resetModules());

describe("initUserGeolocation", () => {
  it("CORE-8: asks the browser once however many callers there are", async () => {
    const getCurrentPosition = stubGeolocation((success) =>
      success(MADRID as GeolocationPosition),
    );
    const { initUserGeolocation, waitForGeolocation } = await freshModule();

    initUserGeolocation();
    initUserGeolocation();
    initUserGeolocation();
    await waitForGeolocation();

    // Three searches in a session must not mean three permission prompts.
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it("CORE-8: exposes the position once it has arrived", async () => {
    stubGeolocation((success) => success(MADRID as GeolocationPosition));
    const { initUserGeolocation, waitForGeolocation, getUserLocation } =
      await freshModule();

    initUserGeolocation();
    await waitForGeolocation();

    expect(getUserLocation()).toEqual({ lat: 40.4168, lng: -3.7038 });
  });

  it("CORE-9: resolves when the user denies the prompt", async () => {
    stubGeolocation((_success, error) =>
      error?.({ code: 1, message: "denied" } as GeolocationPositionError),
    );
    const { initUserGeolocation, waitForGeolocation, getUserLocation } =
      await freshModule();

    initUserGeolocation();

    // Resolving rather than rejecting is the point: the first search waits on
    // this, and a rejection would leave it hanging behind an ignored prompt.
    await expect(waitForGeolocation()).resolves.toBeUndefined();
    expect(getUserLocation()).toBeNull();
  });

  it("CORE-9: resolves when the browser has no geolocation at all", async () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: undefined,
    });
    const { initUserGeolocation, waitForGeolocation, getUserLocation } =
      await freshModule();

    initUserGeolocation();

    await expect(waitForGeolocation()).resolves.toBeUndefined();
    expect(getUserLocation()).toBeNull();
  });

  it("CORE-9: resolves for a caller that never called init", async () => {
    const { waitForGeolocation } = await freshModule();

    await expect(waitForGeolocation()).resolves.toBeUndefined();
  });
});
