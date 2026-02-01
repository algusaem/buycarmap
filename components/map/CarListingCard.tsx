"use client";

import Image from "next/image";
import { Heart } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface CarListingCardProps {
  id: string;
  image: string;
  title: string;
  subtitle: string;
  price: number;
  mileage: number;
  year: number;
  fuel: string;
  location: string;
  source: string;
  isFavorite?: boolean;
  onHover?: (id: string | null) => void;
}

export function CarListingCard({
  id,
  image,
  title,
  subtitle,
  price,
  mileage,
  year,
  fuel,
  location,
  source,
  isFavorite = false,
  onHover,
}: CarListingCardProps) {
  const [favorite, setFavorite] = useState(isFavorite);

  return (
    <article
      className="group cursor-pointer"
      onMouseEnter={() => onHover?.(id)}
      onMouseLeave={() => onHover?.(null)}
    >
      {/* Image container */}
      <div className="relative aspect-4/3 overflow-hidden rounded-xl bg-card">
        <Image
          src={image}
          alt={title}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />

        {/* Favorite button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setFavorite(!favorite);
          }}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm transition-colors hover:bg-background"
        >
          <Heart
            className={cn(
              "h-4 w-4 transition-colors",
              favorite
                ? "fill-destructive text-destructive"
                : "text-foreground",
            )}
          />
        </button>

        {/* Source badge */}
        <div className="absolute bottom-3 left-3 rounded-md bg-background/80 px-2 py-1 text-xs font-medium backdrop-blur-sm">
          {source}
        </div>
      </div>

      {/* Content */}
      <div className="mt-3 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-foreground line-clamp-1">
            {title}
          </h3>
          <span className="shrink-0 font-mono text-base font-semibold text-primary">
            {price.toLocaleString("es-ES")} €
          </span>
        </div>

        <p className="text-sm text-muted-foreground line-clamp-1">{subtitle}</p>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{year}</span>
          <span>·</span>
          <span className="font-mono">
            {mileage.toLocaleString("es-ES")} km
          </span>
          <span>·</span>
          <span>{fuel}</span>
        </div>

        <p className="text-sm text-muted-foreground">{location}</p>
      </div>
    </article>
  );
}
