import type { SelectedLocation, ShownPlace } from "@/interfaces/location";

/** A place the user chose, not «Tu ubicación», the browser's position standing in for one (MAP-32). */
export function isSelectedLocation(place: ShownPlace): place is SelectedLocation {
  return place.placeId !== undefined;
}
