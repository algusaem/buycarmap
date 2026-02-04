"use client";

import { MapContainer, TileLayer, ZoomControl } from "react-leaflet";
import { useTheme } from "next-themes";
import { useMounted } from "@/lib/hooks/useMounted";

const TILE_URLS = {
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  light: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
};

export function ListingsMap() {
  const { resolvedTheme } = useTheme();
  const mounted = useMounted();

  const tileUrl = mounted && resolvedTheme === "light" ? TILE_URLS.light : TILE_URLS.dark;

  return (
    <div className="h-full w-full">
      <MapContainer
        center={[40.4168, -3.7038]}
        zoom={6}
        zoomControl={false}
        style={{ height: "100%", width: "100%" }} // Mandatory for leaflet
      >
        <TileLayer
          key={tileUrl}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url={tileUrl}
        />
        <ZoomControl position="bottomright" />
      </MapContainer>
    </div>
  );
}
