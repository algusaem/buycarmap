export interface GeoPosition {
  lat: number;
  lng: number;
}

export interface SelectedLocation extends GeoPosition {
  placeId: number;
  displayName: string;
}
