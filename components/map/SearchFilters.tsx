"use client";

import { X } from "lucide-react";
import * as motion from "motion/react-client";
import { Button } from "@/components/ui/button";
import { RangeInput } from "@/components/ui/range-input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { LocationSearch } from "@/components/map/LocationSearch";
import { useTranslation } from "@/lib/i18n/client";
import { SelectedLocation } from "@/interfaces/location";
import {
  FUEL_OPTIONS,
  TRANSMISSION_OPTIONS,
  BRANDS,
  BRAND_ANY,
  TIME_FILTER_OPTIONS,
} from "@/components/map/search-filter-options";

export interface SearchFiltersProps {
  engine: string[];
  gearbox: string[];
  brand: string;
  minPrice: number | undefined;
  maxPrice: number | undefined;
  minKm: number | undefined;
  maxKm: number | undefined;
  minYear: number | undefined;
  maxYear: number | undefined;
  minHorsePower: number | undefined;
  maxHorsePower: number | undefined;
  timeFilter: "" | "today" | "lastWeek" | "lastMonth";
  selectedLocation: SelectedLocation | undefined;
  distanceInKm: number;
  onEngineChange: (engine: string[]) => void;
  onGearboxChange: (gearbox: string[]) => void;
  onBrandChange: (brand: string) => void;
  onMinPriceChange: (price: number | undefined) => void;
  onMaxPriceChange: (price: number | undefined) => void;
  onMinKmChange: (km: number | undefined) => void;
  onMaxKmChange: (km: number | undefined) => void;
  onMinYearChange: (year: number | undefined) => void;
  onMaxYearChange: (year: number | undefined) => void;
  onMinHorsePowerChange: (hp: number | undefined) => void;
  onMaxHorsePowerChange: (hp: number | undefined) => void;
  onTimeFilterChange: (timeFilter: "" | "today" | "lastWeek" | "lastMonth") => void;
  onLocationChange: (location: SelectedLocation | undefined) => void;
  onDistanceChange: (distance: number) => void;
  onClearAll: () => void;
}

export function SearchFilters({
  engine,
  gearbox,
  brand,
  minPrice,
  maxPrice,
  minKm,
  maxKm,
  minYear,
  maxYear,
  minHorsePower,
  maxHorsePower,
  timeFilter,
  selectedLocation,
  distanceInKm,
  onEngineChange,
  onGearboxChange,
  onBrandChange,
  onMinPriceChange,
  onMaxPriceChange,
  onMinKmChange,
  onMaxKmChange,
  onMinYearChange,
  onMaxYearChange,
  onMinHorsePowerChange,
  onMaxHorsePowerChange,
  onTimeFilterChange,
  onLocationChange,
  onDistanceChange,
  onClearAll,
}: SearchFiltersProps) {
  const { t } = useTranslation();

  const hasFilters =
    engine.length > 0 ||
    gearbox.length > 0 ||
    brand !== "" ||
    minPrice !== undefined ||
    maxPrice !== undefined ||
    minKm !== undefined ||
    maxKm !== undefined ||
    minYear !== undefined ||
    maxYear !== undefined ||
    minHorsePower !== undefined ||
    maxHorsePower !== undefined ||
    timeFilter !== "" ||
    selectedLocation !== undefined;

  function toggleEngine(value: string) {
    if (engine.includes(value)) {
      onEngineChange(engine.filter((v) => v !== value));
    } else {
      onEngineChange([...engine, value]);
    }
  }

  function toggleGearbox(value: string) {
    if (gearbox.includes(value)) {
      onGearboxChange(gearbox.filter((v) => v !== value));
    } else {
      onGearboxChange([...gearbox, value]);
    }
  }

  function handleBrandChange(value: string) {
    onBrandChange(value === BRAND_ANY ? "" : value);
  }

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="overflow-hidden border-b border-border/50"
    >
      <div className="flex flex-col gap-4 p-4">
        {/* Location */}
        <LocationSearch
          selectedLocation={selectedLocation}
          distanceInKm={distanceInKm}
          onLocationChange={onLocationChange}
          onDistanceChange={onDistanceChange}
        />

        {/* Fuel type */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t.filters.fuelType}
          </span>
          <div className="flex flex-wrap gap-2">
            {FUEL_OPTIONS.map((opt) => (
              <ToggleChip
                key={opt.value}
                label={t.filters.fuelTypes[opt.labelKey]}
                active={engine.includes(opt.value)}
                onClick={() => toggleEngine(opt.value)}
              />
            ))}
          </div>
        </div>

        {/* Transmission */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t.filters.transmission}
          </span>
          <div className="flex flex-wrap gap-2">
            {TRANSMISSION_OPTIONS.map((opt) => (
              <ToggleChip
                key={opt.value}
                label={t.filters.transmissions[opt.labelKey]}
                active={gearbox.includes(opt.value)}
                onClick={() => toggleGearbox(opt.value)}
              />
            ))}
          </div>
        </div>

        {/* Numeric ranges + Brand */}
        <div className="flex flex-wrap items-end gap-3">
          <RangeInput
            label={t.filters.price}
            minPlaceholder={t.filters.minPrice}
            maxPlaceholder={t.filters.maxPrice}
            minValue={minPrice}
            maxValue={maxPrice}
            onMinChange={onMinPriceChange}
            onMaxChange={onMaxPriceChange}
          />
          <RangeInput
            label={t.filters.mileage}
            minPlaceholder={t.filters.minKm}
            maxPlaceholder={t.filters.maxKm}
            minValue={minKm}
            maxValue={maxKm}
            onMinChange={onMinKmChange}
            onMaxChange={onMaxKmChange}
          />
          <RangeInput
            label={t.filters.year}
            minPlaceholder={t.filters.minYear}
            maxPlaceholder={t.filters.maxYear}
            minValue={minYear}
            maxValue={maxYear}
            onMinChange={onMinYearChange}
            onMaxChange={onMaxYearChange}
            min={1900}
          />
          <RangeInput
            label={t.filters.horsePower}
            minPlaceholder={t.filters.minHp}
            maxPlaceholder={t.filters.maxHp}
            minValue={minHorsePower}
            maxValue={maxHorsePower}
            onMinChange={onMinHorsePowerChange}
            onMaxChange={onMaxHorsePowerChange}
          />

          {/* Brand */}
          <div className="flex w-full flex-col gap-2 sm:w-56">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t.filters.brand}
            </span>
            <Select
              value={brand || BRAND_ANY}
              onValueChange={handleBrandChange}
            >
              <SelectTrigger>
                <SelectValue placeholder={t.filters.any} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={BRAND_ANY}>
                  {t.filters.any}
                </SelectItem>
                {BRANDS.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={onClearAll}
            >
              <X className="h-3.5 w-3.5" />
              {t.filters.clearFilters}
            </Button>
          )}
        </div>

        {/* Time filter */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t.filters.listed}
          </span>
          <div className="flex flex-wrap gap-2">
            {TIME_FILTER_OPTIONS.map((opt) => (
              <ToggleChip
                key={opt.value}
                label={t.filters.timeFilters[opt.labelKey]}
                active={timeFilter === opt.value}
                onClick={() =>
                  onTimeFilterChange(timeFilter === opt.value ? "" : opt.value)
                }
              />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
