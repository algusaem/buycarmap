"use client";

import L from "leaflet";
import { MapContainer, TileLayer, ZoomControl, Marker, Popup, useMap } from "react-leaflet";
import { useTheme } from "next-themes";
import { useMounted } from "@/lib/hooks/useMounted";
import type { CarListing } from "@/interfaces/listing";
import { useEffect, useMemo } from "react";
import { useTranslation } from "@/lib/i18n/client";

const TILE_URLS = {
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  light: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
};

function createCarIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="
      width: 12px;
      height: 12px;
      background: var(--primary);
      border: 2px solid var(--foreground);
      border-radius: 50%;
      box-shadow: 0 0 6px color-mix(in oklch, var(--primary), transparent 50%);
    "></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

function FitBounds({ listings }: { listings: CarListing[] }) {
  const map = useMap();

  useEffect(() => {
    if (listings.length === 0) return;
    const bounds = L.latLngBounds(listings.map((l) => [l.lat, l.lng]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [map, listings]);

  return null;
}

interface ListingsMapProps {
  listings?: CarListing[];
}

export function ListingsMap({ listings = [] }: ListingsMapProps) {
  const { resolvedTheme } = useTheme();
  const { locale } = useTranslation();
  const mounted = useMounted();

  const carIcon = useMemo(() => {
    if (!mounted) return undefined;
    return createCarIcon();
  }, [mounted]);

  const tileUrl = mounted && resolvedTheme === "light" ? TILE_URLS.light : TILE_URLS.dark;

  return (
    <div className="h-full w-full">
      <MapContainer
        center={[40.4168, -3.7038]}
        zoom={6}
        zoomControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          key={tileUrl}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url={tileUrl}
        />
        <ZoomControl position="bottomright" />
        <FitBounds listings={listings} />
        {carIcon &&
          listings.map((listing) => (
            <Marker key={listing.id} position={[listing.lat, listing.lng]} icon={carIcon}>
              <Popup>
                <div className="text-sm">
                  <p className="font-semibold">{listing.title}</p>
                  <p className="font-mono text-primary">
                    {listing.price.toLocaleString(locale)} &euro;
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}
      </MapContainer>
    </div>
  );
}
