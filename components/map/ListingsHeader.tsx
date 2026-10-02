"use client";

import Link from "next/link";
import { AnimatePresence } from "motion/react";
import { ArrowLeft, Search, SlidersHorizontal, MapIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchFilters, type SearchFiltersProps } from "@/components/map/SearchFilters";
import { useTranslations } from "next-intl";

interface ListingsHeaderProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSearch: () => void;
  onShowMap: () => void;
  isLoading: boolean;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  activeFilterCount: number;
  filterProps: SearchFiltersProps;
}

export function ListingsHeader({
  searchQuery,
  onSearchChange,
  onSearch,
  onShowMap,
  isLoading,
  filtersOpen,
  onToggleFilters,
  activeFilterCount,
  filterProps,
}: ListingsHeaderProps) {
  const t = useTranslations();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onSearch();
    }
  };

  return (
    <div>
      <div className="border-b border-border/50 p-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            aria-label={t("map.backToHome")}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-card hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <div className="relative flex-1">
            {isLoading ? (
              <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />
            ) : (
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            )}
            <Input
              type="text"
              placeholder={t("hero.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-10 border-border/50 bg-card/50 pl-10 text-sm"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-10 gap-2 border-border/50"
            onClick={onSearch}
            disabled={isLoading}
            aria-label={t("common.search")}
          >
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">{t("common.search")}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className={`relative h-10 gap-2 border-border/50 ${filtersOpen ? "bg-primary/10 border-primary/30 text-primary" : ""}`}
            onClick={onToggleFilters}
            aria-label={t("map.filters")}
            aria-expanded={filtersOpen}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">{t("map.filters")}</span>
            {activeFilterCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-semibold text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-10 gap-2 border-border/50 lg:hidden"
            onClick={onShowMap}
            aria-label={t("hero.exploreMap")}
          >
            <MapIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <AnimatePresence>{filtersOpen && <SearchFilters {...filterProps} />}</AnimatePresence>
    </div>
  );
}
