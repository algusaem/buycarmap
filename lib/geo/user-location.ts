import type { GeoPosition } from "@/interfaces/location";

let cachedPosition: GeoPosition | null = null;
let pending: Promise<void> | null = null;
// Set once the user makes a location choice — a place or «Toda España»
// (MAP-37): the position no longer stands in for the rest of the document,
// even if the map remounts, and the browser is not asked again. A reload
// resets the module, so the browser is asked again.
let dismissed = false;

/**
 * Two decimal places, about 1 km (MAP-35): the position is personal data the
 * search hands to Wallapop and «Crear alerta» stores, so nothing downstream
 * ever sees the precise fix.
 */
function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

export function initUserGeolocation(): void {
  // After a choice the position would be dropped anyway: no pointless prompt.
  if (pending || dismissed) return;

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    pending = Promise.resolve();
    return;
  }

  pending = new Promise<void>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        cachedPosition = {
          lat: roundCoordinate(position.coords.latitude),
          lng: roundCoordinate(position.coords.longitude),
        };
        resolve();
      },
      () => resolve(),
      { timeout: 5000, maximumAge: 300_000 },
    );
  });
}

export function getUserLocation(): GeoPosition | null {
  if (dismissed) return null;
  return cachedPosition;
}

/**
 * Drops the position for the rest of the visit, once the user makes a
 * location choice — a place or «Toda España» (MAP-37).
 */
export function dismissUserLocation(): void {
  dismissed = true;
}

/** Resolves when geolocation finishes (success or failure). */
export function waitForGeolocation(): Promise<void> {
  return pending ?? Promise.resolve();
}
