export interface GeoPosition {
  lat: number;
  lng: number;
}

export interface SelectedLocation extends GeoPosition {
  placeId: number;
  displayName: string;
}

/** The browser's position as the search controls show it, «Tu ubicación» (MAP-32): no place id. */
interface PositionPlace {
  displayName: string;
  placeId?: undefined;
}

/** A place as the search controls show it: the chosen place, or the browser's position standing in for one. */
export type ShownPlace = SelectedLocation | PositionPlace;
