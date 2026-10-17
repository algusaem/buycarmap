import Link from "next/link";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Headline } from "@/components/ui/Headline";
import { EMPTY_URL_FILTERS, mapSearchUrl } from "@/lib/search/url-state";
import { LandingSearch } from "./LandingSearch";
import { LandingMapPreview } from "./MapPreview";

// docs/specs/redesign-entry.md (ENTRY-4), worked example "Popular cars":
// brand and model strings verbatim — confirmed against
// components/map/search-filter-options.ts's own spelling ("Seat",
// "Volkswagen", "BMW", "Audi").
const POPULAR_CARS = [
  { label: "Golf", make: "Volkswagen", model: "Golf" },
  { label: "SEAT León", make: "Seat", model: "León" },
  { label: "BMW Serie 3", make: "BMW", model: "Serie 3" },
  { label: "Audi A4", make: "Audi", model: "A4" },
] as const;

function popularCarHref(make: string, model: string): string {
  return mapSearchUrl({ ...EMPTY_URL_FILTERS, brand: make, model });
}

const ILLUSTRATION = "/illus/vehicle-sale-lime.svg";

/**
 * docs/specs/redesign-entry.md (ENTRY-7, ENTRY-26, Contracts › Illustrations);
 * docs/design/system/README.md (illustrations): the desktop art layer, from
 * 1440px wide, under everything else and hidden from assistive technology —
 * the Storyset illustration bottom left and the arrow toward the map
 * preview, from the end of the headline (the other arrow, toward «Buscar»,
 * is PillArrow). Drawn on the board's 1440-wide frame, cropped to its 724px
 * content band and centred on the content, so it stays beside the
 * vertically centred search. The illustration keeps the board's place —
 * 150px from the left, 405px into the band, 540px wide — so it is drawn
 * whole, its ground line reaching into the footer row left of the links.
 */
function ArtLayer() {
  return (
    <div
      data-art-layer
      aria-hidden="true"
      className="pointer-events-none relative -z-10 hidden 3xl:col-span-full 3xl:row-span-full 3xl:block"
    >
      <div className="absolute top-1/2 -left-12 h-181 w-360 -translate-y-1/2">
        <Image
          src={ILLUSTRATION}
          alt=""
          width={750}
          height={500}
          className="absolute top-101.25 left-37.5 h-auto w-135"
        />
        <svg
          aria-hidden="true"
          viewBox="0 0 1440 724"
          className="absolute inset-0 size-full text-lime"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M750 272 C 790 252 822 256 852 268" />
          <path d="M841.9 255.6 L 852 268 L 836.1 269.9" />
        </svg>
      </div>
    </div>
  );
}

/**
 * docs/design/system/README.md (arrows): the arrow from the end of the
 * headline to the right side of «Buscar», drawn behind the pill. Its start
 * keeps the board's place beside the headline (702px from the pill's left
 * edge, which is the column's) and its tip stays 78px inside the pill's
 * right edge, under «Buscar», however wide the chosen values make the pill:
 * the curve stretches between the two, so the arrowhead never shows beside
 * «Buscar». At the default pill (684px) it is the board's own curve. Shown
 * from 1440 up, with the other arrow (ArtLayer).
 */
function PillArrow() {
  return (
    <svg
      aria-hidden="true"
      viewBox="654 414 96 134"
      preserveAspectRatio="none"
      className="pointer-events-none absolute -top-24.75 left-pill-arrow-left -z-10 hidden h-33.5 w-pill-arrow-width overflow-visible text-lime 3xl:block"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path vectorEffect="non-scaling-stroke" d="M750 414 C 800 470 770 548 654 548" />
      <path vectorEffect="non-scaling-stroke" d="M668 555.7 L 654 548 L 668 540.3" />
    </svg>
  );
}

// docs/specs/redesign-entry.md (ENTRY-1, ENTRY-2 to ENTRY-8). The landing's
// body: the brand headline, the search (LandingSearch.tsx, reused across
// both breakpoints through its own CSS-chosen regions), the desktop-only
// popular cars and the map preview — split into two always-mounted,
// testid-scoped regions (the same convention components/nav/SiteHeader.tsx
// uses for "header-desktop"/"header-phone"), since jsdom applies no
// responsive CSS. Reads no session: the signed-in/out difference lives in
// the header and tab bar only (ENTRY-8, SiteHeader.test.tsx, TabBar.test.tsx).
// A Server Component: the only interactive part is LandingSearch, which is
// its own client component.
//
// Desktop follows the board's 1440×900 frame: a two-column grid, the left
// column vertically centred (headline, line, pill, Populares 30px apart)
// and the 520px map preview at the board's 522×724 proportions. The desktop
// region uses `display: contents`, so its pieces take their own grid cells.
//
// That grid starts at 1440px wide (ENTRY-23). Laptop width, 1024px to
// 1439px, follows the 1024×900 board instead: one centred column —
// headline, line, pill, Populares, then the illustration whole, its drawn
// content 30px under Populares, as large as the room allows up to 480px
// wide — with no map preview and no arrows; app/page.tsx centres it, with
// the footer's links 24px under the drawn content.
export function Landing() {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-360 flex-1 flex-col lg:px-12">
      <div className="relative isolate flex min-h-0 flex-1 flex-col gap-4.5 px-5 pt-4.5 lg:gap-7.5 lg:px-0 lg:pt-0 lg:max-3xl:items-center lg:max-3xl:text-center 3xl:grid 3xl:grid-cols-landing 3xl:grid-rows-landing 3xl:justify-between 3xl:gap-x-14 3xl:gap-y-7.5 3xl:pt-10 3xl:pb-2">
        <div className="flex flex-col gap-4.5 lg:gap-7.5 lg:max-3xl:items-center 3xl:col-start-1 3xl:row-start-2">
          {/* The board trims the headline's box to its cap height and baseline
              (its `.display` class), which sets the 30px rhythm below it. */}
          <Headline
            question={t("hero.title")}
            punchline={t("hero.titleHighlight")}
            className="text-box-trim text-hero-mobile lg:text-hero"
          />
          <p className="m-0 text-body text-text-muted lg:max-w-140 lg:text-lead">
            {t("hero.subtitle")}
          </p>
        </div>

        {/* Sized to the pill at desktop width, so PillArrow can hold its tip
            to the pill's right edge. */}
        <div className="relative lg:w-fit 3xl:col-start-1 3xl:row-start-3">
          <LandingSearch />
          <PillArrow />
        </div>

        <div data-testid="landing-desktop" className="hidden lg:contents">
          <div
            data-testid="landing-popular"
            className="flex flex-wrap items-center gap-2.5 text-sm leading-tight lg:max-3xl:justify-center 3xl:col-start-1 3xl:row-start-4"
          >
            <span className="text-text-muted">{t("common.popular")}</span>
            {POPULAR_CARS.map((car) => (
              <Link
                key={car.label}
                href={popularCarHref(car.make, car.model)}
                className="rounded-pill border border-line px-3.5 py-2 font-semibold text-text transition-colors hover:text-lime"
              >
                {car.label}
              </Link>
            ))}
          </div>
          {/* Laptop width's illustration (ENTRY-24, ENTRY-26, ENTRY-29,
              ENTRY-30), in the column's flow, 30px under Populares: a slot
              as tall as the drawn content at its 480px cap, which shrinks
              when the screen is short. The image is sized from the slot's
              height (a size container) at its 3:2 proportions, and pulled up
              by the file's empty top band, so the slot's box is the drawn
              content's. The slot is dropped when the room left is under
              150px of drawing (app/page.tsx's `landing` container). First in
              the DOM, ahead of the art layer's. */}
          <div
            aria-hidden="true"
            className="pointer-events-none flex h-landing-illus-drawn min-h-0 w-full shrink justify-center @container-size/illus landing-illus-hidden:hidden 3xl:hidden"
          >
            <div className="w-landing-illus">
              <Image
                src={ILLUSTRATION}
                alt=""
                width={750}
                height={500}
                preload
                className="-mt-illus-band-vehicle block h-auto w-full"
              />
            </div>
          </div>
          <LandingMapPreview variant="desktop" label={t("hero.exploreMap")} locale={locale} />
          <ArtLayer />
        </div>

        {/* The phone map runs to the bottom of the screen — clearing the home
            indicator itself (pb-safe-bottom) when signed out — or to the top
            of the tab bar when the bar is shown (signed in, with-tab-bar):
            this body reads no session, so it follows the bar's own presence
            instead. */}
        <div
          data-testid="landing-phone"
          className="flex min-h-0 flex-1 flex-col pb-safe-bottom lg:hidden with-tab-bar:pb-sheet-above-tabs"
        >
          <LandingMapPreview variant="phone" label={t("hero.exploreMap")} locale={locale} />
        </div>
      </div>
    </div>
  );
}
