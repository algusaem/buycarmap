"use client";

import Link from "next/link";
import { ArrowLeft, Search, SlidersHorizontal, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/lib/i18n/client";

interface ListingsHeaderProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onShowMap: () => void;
  listingsCount: number;
}

export function ListingsHeader({
  searchQuery,
  onSearchChange,
  onShowMap,
  listingsCount,
}: ListingsHeaderProps) {
  const { t } = useTranslation();

  return (
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
            onChange={(e) => onSearchChange(e.target.value)}
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
          onClick={onShowMap}
        >
          <Map className="h-4 w-4" />
        </Button>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{listingsCount}</span>{" "}
        cars found
      </p>
    </div>
  );
}
