"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { ListingsHeader } from "@/components/map/ListingsHeader";
import { CarListingCard } from "@/components/map/CarListingCard";
import { MobileMapOverlay } from "@/components/map/MobileMapOverlay";
import { CarListing } from "@/lib/mock/listings";

const ListingsMap = dynamic(
  () => import("@/components/map/ListingsMap").then((mod) => mod.ListingsMap),
  { ssr: false },
);

interface MapViewProps {
  listings: CarListing[];
}

export function MapView({ listings }: MapViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showMap, setShowMap] = useState(false);

  return (
    <div className="flex h-0 min-h-0 flex-1 overflow-hidden">
      {/* Left - Listings Panel */}
      <div className="flex h-full w-full flex-col border-r border-border/50 lg:w-200">
        <ListingsHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onShowMap={() => setShowMap(true)}
          listingsCount={listings.length}
        />

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {listings.map((listing) => (
              <CarListingCard key={listing.id} {...listing} />
            ))}
          </div>
        </div>
      </div>

      {/* Right - Map */}
      <div className="hidden lg:flex lg:flex-1">
        <ListingsMap />
      </div>

      {/* Mobile map */}
      {showMap && (
        <MobileMapOverlay onClose={() => setShowMap(false)}>
          <ListingsMap />
        </MobileMapOverlay>
      )}
    </div>
  );
}
