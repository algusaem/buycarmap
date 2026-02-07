"use client";

import { X } from "lucide-react";
import * as motion from "motion/react-client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/lib/i18n/client";

const FUEL_OPTIONS = [
  { value: "gasoline", labelKey: "gasoline" },
  { value: "gasoil", labelKey: "gasoil" },
  { value: "electric-hybrid", labelKey: "electricHybrid" },
  { value: "hybride", labelKey: "hybrid" },
  { value: "hybride_plugin", labelKey: "hybridPlugin" },
  { value: "lpg", labelKey: "lpg" },
  { value: "cng", labelKey: "cng" },
] as const;

const TRANSMISSION_OPTIONS = [
  { value: "manual", labelKey: "manual" },
  { value: "automatic", labelKey: "automatic" },
  { value: "semiautomatic", labelKey: "semiautomatic" },
] as const;

const BRANDS = [
  "Alfa Romeo",
  "Aston Martin",
  "Audi",
  "BMW",
  "Citro\u00ebn",
  "Cupra",
  "Dacia",
  "DS",
  "Fiat",
  "Ford",
  "Honda",
  "Hyundai",
  "Jaguar",
  "Jeep",
  "Kia",
  "Land Rover",
  "Lexus",
  "Mazda",
  "Mercedes-Benz",
  "Mini",
  "Mitsubishi",
  "Nissan",
  "Opel",
  "Peugeot",
  "Porsche",
  "Renault",
  "Seat",
  "Skoda",
  "Smart",
  "Subaru",
  "Suzuki",
  "Tesla",
  "Toyota",
  "Volkswagen",
  "Volvo",
];

const BRAND_ANY = "__any__";

interface SearchFiltersProps {
  engine: string[];
  gearbox: string[];
  brand: string;
  onEngineChange: (engine: string[]) => void;
  onGearboxChange: (gearbox: string[]) => void;
  onBrandChange: (brand: string) => void;
  onClearAll: () => void;
}

function ToggleChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
        active
          ? "border-primary bg-primary/15 text-primary"
          : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

export function SearchFilters({
  engine,
  gearbox,
  brand,
  onEngineChange,
  onGearboxChange,
  onBrandChange,
  onClearAll,
}: SearchFiltersProps) {
  const { t } = useTranslation();

  const hasFilters = engine.length > 0 || gearbox.length > 0 || brand !== "";

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

        {/* Brand + Clear */}
        <div className="flex flex-wrap items-end gap-3">
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
      </div>
    </motion.div>
  );
}
