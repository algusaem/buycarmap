"use client";

import { MapContainer, TileLayer, ZoomControl } from "react-leaflet";

export function ListingsMap() {
  return (
    <div className="h-full w-full">
      <MapContainer
        center={[40.4168, -3.7038]}
        zoom={6}
        zoomControl={false}
        style={{ height: "100%", width: "100%" }} // Mandatory for leaflet
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <ZoomControl position="bottomright" />
      </MapContainer>
    </div>
  );
}
