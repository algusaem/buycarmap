"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import type { CarListing } from "@/interfaces/listing";
import { CarListingCard } from "@/components/map/CarListingCard";
import { useTranslation } from "@/lib/i18n/client";

interface FavoritesListProps {
  favorites: CarListing[];
}

function EmptyState() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <Heart className="h-10 w-10 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{t.favorites.empty}</p>
      {/* No dead ends: the empty state has to lead somewhere. */}
      <Link
        href="/map"
        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        {t.favorites.emptyCta}
      </Link>
    </div>
  );
}

export function FavoritesList({ favorites }: FavoritesListProps) {
  if (favorites.length === 0) return <EmptyState />;

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {favorites.map((listing) => (
        <CarListingCard key={listing.id} {...listing} isFavorite />
      ))}
    </div>
  );
}
