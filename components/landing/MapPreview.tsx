import Link from "next/link";
import { formatMileage, formatPrice } from "@/lib/format";
import { PIN_BASE_CLASSES } from "@/lib/map/pin-classes";
import { cn } from "@/lib/utils";

interface ExamplePinProps {
  price: number;
  locale: string;
  active?: boolean;
  className: string;
}

/**
 * A static price pin with PricePin's own look (`PIN_BASE_CLASSES`, shared
 * with components/map/ListingsMap.tsx's `pinIcon`), set at the font's own
 * line height as on the board; the active one has no border, so it draws
 * 2px smaller than the others.
 */
function ExamplePin({ price, locale, active = false, className }: ExamplePinProps) {
  return (
    <span
      className={cn(
        "absolute leading-font",
        PIN_BASE_CLASSES,
        active
          ? "bg-lime font-extrabold text-on-lime shadow-pin-active"
          : "border border-line bg-surface",
        className,
      )}
    >
      {formatPrice(price, locale)}
    </span>
  );
}

interface ExampleCarCardProps {
  /** The phone's tighter card: 8px padding, 10px gap and an 80×60 photo. */
  compact: boolean;
  locale: string;
}

// The map preview's illustrative example figures — not a real listing's
// (ListingCard README › Tarjeta del mapa de la landing) — but still real
// numbers, run through the app's own formatters (FRONT-11) rather than
// typed out as already-formatted strings.
const EXAMPLE_MILEAGE_KM = 71000;
const EXAMPLE_PRICE_EUR = 9400;

/**
 * The map preview's illustrative example — the spec's own worked figures, not a
 * real listing (ListingCard README › Tarjeta del mapa de la landing).
 */
function ExampleCarCard({ compact, locale }: ExampleCarCardProps) {
  return (
    <article
      data-testid="landing-preview-car-card"
      className={cn(
        "absolute flex items-center rounded-card border border-line bg-surface",
        // Desktop, on a laptop's narrower preview (its own container width):
        // the phone's tighter card under 384px, and no photo under 320px.
        compact
          ? "inset-x-4 bottom-4 gap-2.5 p-2"
          : "inset-x-5.5 bottom-5.5 gap-3.5 p-3 @max-sm:inset-x-4 @max-sm:bottom-4 @max-sm:gap-2.5 @max-sm:p-2",
      )}
    >
      <span
        className={cn(
          "shrink-0 rounded-field bg-photo-tint-6",
          compact ? "h-15 w-20" : "h-22.5 w-30 @max-sm:h-15 @max-sm:w-20 @max-xs:hidden",
        )}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.75">
        <span className="truncate text-caption font-bold text-text-muted">Wallapop · Zaragoza</span>
        <strong className="truncate text-card-title text-text">Renault Clio TCe 90</strong>
        <span className="truncate text-small text-text-muted">
          2019 · {formatMileage(EXAMPLE_MILEAGE_KM, locale)}
        </span>
        <strong className="font-display text-xl leading-tight font-extrabold text-lime">
          {formatPrice(EXAMPLE_PRICE_EUR, locale)}
        </strong>
      </div>
    </article>
  );
}

/**
 * The desktop preview's static roads and water, on the board's own 520×700
 * grid, drawn across the preview's full width so they scale with it.
 */
function DesktopRoads() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 520 700"
      className="absolute top-0 left-0 h-auto w-full"
      fill="none"
    >
      <path
        d="M-20 470 C 100 430 160 510 280 470 S 450 390 560 420 L 560 720 L -20 720 Z"
        className="fill-map-water"
      />
      <path
        d="M-10 130 C 120 170 230 100 350 160 S 480 240 540 220"
        strokeWidth="12"
        className="stroke-map-road"
      />
      <path
        d="M70 -10 C 110 160 190 260 210 400 S 240 600 270 720"
        strokeWidth="10"
        className="stroke-map-road-major"
      />
      <path d="M-10 320 C 140 310 290 350 540 310" strokeWidth="7" className="stroke-map-road" />
      <path
        d="M380 -10 C 360 140 400 250 460 340"
        strokeWidth="6"
        className="stroke-map-road-minor"
      />
    </svg>
  );
}

/** The phone preview's two roads, on the board's own 350×300 grid. */
function PhoneRoads() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 350 300"
      className="absolute top-0 left-0 h-75 w-87.5"
      fill="none"
    >
      <path d="M-10 90 C 100 120 200 70 360 110" strokeWidth="10" className="stroke-map-road" />
      <path
        d="M120 -10 C 140 100 160 200 150 310"
        strokeWidth="8"
        className="stroke-map-road-major"
      />
    </svg>
  );
}

export interface LandingMapPreviewProps {
  variant: "desktop" | "phone";
  label: string;
  locale: string;
}

interface PinSpec {
  price: number;
  active?: boolean;
  className: string;
}

// Each pin's place as a fraction of the preview's 520×722 inside (so it
// lands on the board's pixels at full width), named spacing tokens in
// app/globals.css (`--spacing-pin-<price>-*`) rather than arbitrary values —
// moving a pin means changing its two values there, not here. Under 320px
// only the phone's two pins remain, so none runs off the edge or onto the
// card.
const DESKTOP_PINS: PinSpec[] = [
  { price: 14500, className: "top-pin-14500-top left-pin-14500-left" },
  { price: 9400, active: true, className: "top-pin-9400-top left-pin-9400-left" },
  { price: 18900, className: "top-pin-18900-top left-pin-18900-left @max-xs:hidden" },
  { price: 16500, className: "top-pin-16500-top left-pin-16500-left @max-xs:hidden" },
  { price: 11900, className: "top-pin-11900-top left-pin-11900-left @max-xs:hidden" },
];

const PHONE_PINS: PinSpec[] = [
  { price: 14500, className: "top-15 left-10" },
  { price: 9400, active: true, className: "top-30 left-45" },
];

// docs/specs/redesign-entry.md (ENTRY-7): a static, non-interactive picture
// of the map — roads, price pins (the active one lime with its halo) and the
// example car card — that is one link to /map as a whole. Desktop draws five
// pins; phone draws two, with the card under the active one, and runs to the
// bottom of the screen.
export function LandingMapPreview({ variant, label, locale }: LandingMapPreviewProps) {
  const desktop = variant === "desktop";
  const pins = desktop ? DESKTOP_PINS : PHONE_PINS;

  return (
    <Link
      href="/map"
      aria-label={label}
      className={cn(
        "relative overflow-hidden border border-line-soft bg-map-ground transition-colors hover:border-line",
        // The desktop preview shows from 1440px wide only (ENTRY-23); CSS
        // chooses it, since the landing is a Server Component.
        desktop
          ? "@container hidden rounded-panel 3xl:col-start-2 3xl:row-span-full 3xl:row-start-1 3xl:block 3xl:aspect-map-preview 3xl:max-h-full 3xl:self-center"
          : "block min-h-0 flex-1 rounded-t-preview border-b-0",
      )}
    >
      <div aria-hidden="true">
        {desktop ? <DesktopRoads /> : <PhoneRoads />}
        {pins.map((pin) => (
          <ExamplePin
            key={pin.price}
            price={pin.price}
            locale={locale}
            active={pin.active}
            className={pin.className}
          />
        ))}
        <ExampleCarCard compact={!desktop} locale={locale} />
      </div>
    </Link>
  );
}
