import { GeoPosition } from "@/interfaces/location";

let cachedPosition: GeoPosition | null = null;
let pending: Promise<void> | null = null;

export function initUserGeolocation(): void {
  if (pending) return;

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    pending = Promise.resolve();
    return;
  }

  pending = new Promise<void>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        cachedPosition = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        resolve();
      },
      () => resolve(),
      { timeout: 5000, maximumAge: 300_000 },
    );
  });
}

export function getUserLocation(): GeoPosition | null {
  return cachedPosition;
}

/** Resolves when geolocation finishes (success or failure). */
export function waitForGeolocation(): Promise<void> {
  return pending ?? Promise.resolve();
}
