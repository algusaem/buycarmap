"use client";

import L, { type LeafletEvent } from "leaflet";
import { MapContainer, TileLayer, ZoomControl, Marker, Popup, useMap } from "react-leaflet";
import { useTheme } from "next-themes";
import { useMounted } from "@/lib/hooks/useMounted";
import type { CarListing } from "@/interfaces/listing";
import { useEffect, useMemo, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatPrice } from "@/lib/format";
import { env } from "@/lib/env";

const TILE_URLS = {
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  light: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
};

function withCartoKey(url: string): string {
  const key = env.NEXT_PUBLIC_CARTO_API_KEY;
  if (!key) return url;
  return `${url}?key=${encodeURIComponent(key)}`;
}

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

// MAP-25: fits once, on mount, and never again for as long as this instance
// stays mounted — so appending a page or toggling a favourite (which only
// change the `listings` prop, not the instance) never refits. `ListingsMap`
// gives this component `key={resultsGeneration}` below, so a new search's
// first results remount a fresh `FitBounds` and fit to them; `map` and
// `listings` are read through refs, not the effect's dependencies, because
// this same instance still re-renders with a new `listings` array on every
// appended page and must not re-fit then.
function FitBounds({ listings }: { listings: CarListing[] }) {
  const map = useMap();
  const mapRef = useRef(map);
  mapRef.current = map;
  const listingsRef = useRef(listings);
  listingsRef.current = listings;

  useEffect(() => {
    const current = listingsRef.current;
    if (current.length === 0) return;
    const bounds = L.latLngBounds(current.map((l) => [l.lat, l.lng]));
    mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, []);

  return null;
}

interface ListingsMapProps {
  listings?: CarListing[];
  resultsGeneration?: number;
}

export function ListingsMap({ listings = [], resultsGeneration }: ListingsMapProps) {
  const { resolvedTheme } = useTheme();
  const locale = useLocale();
  const t = useTranslations();
  const mounted = useMounted();

  const carIcon = useMemo(() => {
    if (!mounted) return undefined;
    return createCarIcon();
  }, [mounted]);

  const tileUrl = withCartoKey(
    mounted && resolvedTheme === "light" ? TILE_URLS.light : TILE_URLS.dark,
  );

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
        <FitBounds key={resultsGeneration} listings={listings} />
        {carIcon &&
          listings.map((listing) => {
            const markerLabel = t("map.markerLabel", {
              title: listing.title,
              price: formatPrice(listing.price, locale),
            });

            return (
              <Marker
                key={listing.id}
                position={[listing.lat, listing.lng]}
                icon={carIcon}
                eventHandlers={{
                  add: (e: LeafletEvent) => {
                    e.target.getElement()?.setAttribute("aria-label", markerLabel);
                  },
                }}
              >
                <Popup>
                  <div className="text-sm">
                    <p className="font-semibold">{listing.title}</p>
                    <p className="font-mono text-primary">{formatPrice(listing.price, locale)}</p>
                  </div>
                </Popup>
              </Marker>
            );
          })}
      </MapContainer>
    </div>
  );
}
