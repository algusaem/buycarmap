// docs/design/system/components/PricePin/README.md. The pill's shape and
// typography — shared, byte for byte, between the real map's pin
// (components/map/ListingsMap.tsx's `pinIcon`, a Leaflet divIcon built from
// an HTML string) and the landing's static example pin
// (components/landing/MapPreview.tsx's `ExamplePin`). Each caller still owns
// its own positioning (Leaflet's absolute/translate centring vs the landing's
// percentage placement) and its own active/inactive toggle (a Tailwind
// `group-data-*` variant for the real pin, a plain conditional class string
// for the static one) — only the shape the two pins must never drift apart on
// lives here.
export const PIN_BASE_CLASSES =
  "whitespace-nowrap rounded-pill px-2.75 py-1.5 font-sans text-pin font-bold text-text lg:px-3.25 lg:py-1.75 lg:text-sm";
