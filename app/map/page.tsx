"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, Search, SlidersHorizontal, Map } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CarListingCard } from "@/components/map/CarListingCard";
import { useTranslation } from "@/lib/i18n/client";

const ListingsMap = dynamic(
  () => import("@/components/map/ListingsMap").then((mod) => mod.ListingsMap),
  { ssr: false },
);

const MOCK_LISTINGS = [
  {
    id: "1",
    image:
      "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&q=80",
    title: "2019 Volkswagen Golf",
    subtitle: "1.6 TDI Business Edition",
    price: 14500,
    mileage: 45230,
    year: 2019,
    fuel: "Diesel",
    location: "Madrid",
    source: "Wallapop",
  },
  {
    id: "2",
    image:
      "https://images.unsplash.com/photo-1619767886558-efdc259cde1a?w=800&q=80",
    title: "2020 Seat León",
    subtitle: "1.5 TSI FR",
    price: 18900,
    mileage: 32100,
    year: 2020,
    fuel: "Gasolina",
    location: "Barcelona",
    source: "Coches.net",
  },
  {
    id: "3",
    image:
      "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800&q=80",
    title: "2018 BMW Serie 3",
    subtitle: "320d xDrive",
    price: 24500,
    mileage: 67800,
    year: 2018,
    fuel: "Diesel",
    location: "Valencia",
    source: "Milanuncios",
  },
  {
    id: "4",
    image:
      "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800&q=80",
    title: "2021 Audi A4",
    subtitle: "35 TFSI S line",
    price: 32000,
    mileage: 21500,
    year: 2021,
    fuel: "Gasolina",
    location: "Sevilla",
    source: "AutoScout24",
  },
  {
    id: "5",
    image:
      "https://images.unsplash.com/photo-1603386329225-868f9b1ee6c9?w=800&q=80",
    title: "2017 Mercedes Clase C",
    subtitle: "220d AMG Line",
    price: 22800,
    mileage: 89000,
    year: 2017,
    fuel: "Diesel",
    location: "Málaga",
    source: "Wallapop",
  },
  {
    id: "6",
    image:
      "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&q=80",
    title: "2020 Toyota Corolla",
    subtitle: "Hybrid Active",
    price: 19500,
    mileage: 41200,
    year: 2020,
    fuel: "Híbrido",
    location: "Bilbao",
    source: "Coches.net",
  },
];

export default function MapPage() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [showMap, setShowMap] = useState(false);

  return (
    <div className="flex h-0 min-h-0 flex-1 overflow-hidden">
      {/* Left - Listings Panel */}
      <div className="flex h-full w-full flex-col border-r border-border/50 lg:w-200">
        <div className="border-b border-border/50 p-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-card hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>

            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t.hero.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 border-border/50 bg-card/50 pl-10 text-sm"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              className="h-10 gap-2 border-border/50"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-10 gap-2 border-border/50 lg:hidden"
              onClick={() => setShowMap(true)}
            >
              <Map className="h-4 w-4" />
            </Button>
          </div>

          <p className="mt-3 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">
              {MOCK_LISTINGS.length}
            </span>{" "}
            cars found
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {MOCK_LISTINGS.map((listing) => (
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
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute left-4 top-4 z-1000 flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-lg"
            onClick={() => setShowMap(false)}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <ListingsMap />
        </div>
      )}
    </div>
  );
}
