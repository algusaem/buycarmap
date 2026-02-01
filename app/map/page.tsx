"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import * as motion from "motion/react-client";
import { ArrowLeft, Search, SlidersHorizontal, List } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/lib/i18n/client";
import { fadeIn } from "@/lib/animations";
import "leaflet/dist/leaflet.css";

// Dynamic import to avoid SSR issues with Leaflet
const ListingsMap = dynamic(
  () => import("@/components/map/ListingsMap").then((mod) => mod.ListingsMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm text-muted-foreground">Loading map...</span>
        </div>
      </div>
    ),
  },
);

export default function MapPage() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-background">
      {/* Top bar */}
      <motion.div
        className="absolute left-0 right-0 top-0 z-1000 border-b border-border/30 bg-background/80 backdrop-blur-md"
        {...fadeIn()}
      >
        <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-3 px-4">
          {/* Back button */}
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          {/* Search bar */}
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t.hero.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 border-border/50 bg-card/50 pl-9 text-sm backdrop-blur-sm"
            />
          </div>

          {/* Filter button */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-border/50 bg-card/50 backdrop-blur-sm"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
          </Button>

          {/* List view toggle */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-border/50 bg-card/50 backdrop-blur-sm"
          >
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">List</span>
          </Button>
        </div>
      </motion.div>

      {/* Map container - full screen */}
      <div className="absolute inset-0 top-14">
        <ListingsMap />
      </div>
    </div>
  );
}
