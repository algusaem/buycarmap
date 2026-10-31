import Link from "next/link";
import { CarPhoto } from "@/components/map/CarCard";
import type { CarListing } from "@/interfaces/listing";
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

interface PreviewCarCardProps {
  car: CarListing;
  /** The phone's card: in the flow, under the pins, with its photo on top. */
  compact: boolean;
  locale: string;
}

// What the preview shows with no listings to draw from (ENTRY-36): the spec's
// own worked figures, run through the app's own formatters (FRONT-11) rather
// than typed out as already-formatted strings.
const EXAMPLE_CAR: CarListing = {
  id: "landing-example",
  image: "",
  title: "Renault Clio TCe 90",
  subtitle: "",
  price: 9400,
  mileage: 71000,
  year: 2019,
  fuel: "",
  brand: "Renault",
  model: "Clio",
  location: "Zaragoza",
  source: "Wallapop",
  lat: 0,
  lng: 0,
  url: "",
};

/** The preview's car (ListingCard README › Tarjeta del mapa de la landing). */
function PreviewCarCard({ car, compact, locale }: PreviewCarCardProps) {
  const origin = [car.source, car.location].filter(Boolean).join(" · ");
  const meta = [car.year, formatMileage(car.mileage, locale)].filter(Boolean).join(" · ");

  return (
    <article
      data-testid="landing-preview-car-card"
      className={cn(
        "flex rounded-card border border-line bg-surface",
        // Desktop, on a laptop's narrower preview (its own container width):
        // a tighter card under 384px, and no photo under 320px.
        compact
          ? "relative flex-col overflow-hidden"
          : "absolute inset-x-5.5 bottom-5.5 items-center gap-3.5 p-3 @max-sm:inset-x-4 @max-sm:bottom-4 @max-sm:gap-2.5 @max-sm:p-2",
      )}
    >
      <CarPhoto
        listing={car}
        alt=""
        sizes={compact ? "100vw" : "120px"}
        badge={false}
        iconClassName="size-8"
        className={cn(
          compact
            ? "h-42.5 w-full"
            : "h-22.5 w-30 shrink-0 rounded-field @max-sm:h-15 @max-sm:w-20 @max-xs:hidden",
        )}
      />
      <div className={cn("flex min-w-0 flex-1 flex-col gap-0.75", compact && "px-3.5 pt-3 pb-3.5")}>
        <span className="truncate text-caption font-bold text-text-muted">{origin}</span>
        <strong className="truncate text-card-title text-text">{car.title}</strong>
        <span className="truncate text-small text-text-muted">{meta}</span>
        <strong className="font-display text-xl leading-tight font-extrabold text-lime">
          {formatPrice(car.price, locale)}
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

/** The phone preview's three roads and water, on a 350×680 grid; they fill the preview, whatever its size, reaching every edge. */
function PhoneRoads() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 350 680"
      preserveAspectRatio="xMinYMin slice"
      className="absolute inset-0 size-full"
      fill="none"
    >
      <path
        d="M-20 440 C 80 400 170 470 260 435 S 340 400 370 415 L 370 700 L -20 700 Z"
        className="fill-map-water"
      />
      <path d="M-10 120 C 100 150 200 90 360 135" strokeWidth="10" className="stroke-map-road" />
      <path
        d="M120 -10 C 140 130 185 250 195 370 S 225 590 250 700"
        strokeWidth="8"
        className="stroke-map-road-major"
      />
      <path d="M-10 305 C 120 295 240 335 360 290" strokeWidth="7" className="stroke-map-road" />
    </svg>
  );
}

export interface LandingMapPreviewProps {
  variant: "desktop" | "phone";
  label: string;
  locale: string;
  /** The visit's listings, the one for the card first (ENTRY-34). */
  listings?: CarListing[];
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
  { price: 14500, className: "top-15 left-9" },
  { price: 9400, active: true, className: "top-46.25 left-45" },
  { price: 16500, className: "top-75 left-13" },
];

/** Each pin with a listing's price: the featured one's on the active pin, the others' in order. */
function pricedPins(pins: PinSpec[], featured: CarListing, others: CarListing[]): PinSpec[] {
  const quietPins = pins.filter((pin) => !pin.active);
  return pins.map((pin) => ({
    ...pin,
    price: pin.active ? featured.price : (others[quietPins.indexOf(pin)]?.price ?? pin.price),
  }));
}

// docs/specs/redesign-entry.md (ENTRY-7, ENTRY-33, ENTRY-34, ENTRY-36): a
// static, non-interactive picture of the map — roads, price pins (the active
// one lime with its halo) and a car card — that is one link to /map as a
// whole. With a listing for every pin they are real, the card's on the active
// pin; with fewer, the example car and its prices. Desktop draws five pins;
// phone draws three over the card, a whole box as tall as they need, so the
// page scrolls on every phone.
export function LandingMapPreview({
  variant,
  label,
  locale,
  listings = [],
}: LandingMapPreviewProps) {
  const desktop = variant === "desktop";
  const examplePins = desktop ? DESKTOP_PINS : PHONE_PINS;
  const [featured, ...others] = listings;
  const real = featured !== undefined && listings.length >= examplePins.length;
  const pins = real ? pricedPins(examplePins, featured, others) : examplePins;
  const car = real ? featured : EXAMPLE_CAR;

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
          : "mb-5 block rounded-preview px-3 pt-92.5 pb-3",
      )}
    >
      <div aria-hidden="true">
        {desktop ? <DesktopRoads /> : <PhoneRoads />}
        {pins.map((pin) => (
          <ExamplePin
            key={pin.className}
            price={pin.price}
            locale={locale}
            active={pin.active}
            className={pin.className}
          />
        ))}
        <PreviewCarCard car={car} compact={!desktop} locale={locale} />
      </div>
    </Link>
  );
}
