"use client";

import L, { type PopupEvent } from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { type MutableRefObject, useEffect, useMemo, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { CarListing } from "@/interfaces/listing";
import { env } from "@/lib/env";
import { formatPrice } from "@/lib/format";
import { groupPins, hasCoordinates } from "@/lib/map/group-pins";
import { PIN_BASE_CLASSES } from "@/lib/map/pin-classes";
import { MapPreview, type PreviewController, type PreviewProps } from "@/components/map/MapPreview";
import { MapZoom } from "@/components/map/MapZoom";
import { ZoneLayers, zoneBounds } from "@/components/map/ZoneLayers";
import type { MapZone } from "@/lib/map/zone";

/** Where every map starts: Spain, whole (MAP-25). An alert's map comes back to it (ALERTUI-16). */
const DEFAULT_VIEW = { center: [40.4168, -3.7038] as L.LatLngTuple, zoom: 6 };

const TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

/** The basemap's tiles, with the CARTO key when one is configured: every map in the app draws the same ones. */
export function cartoTileUrl(): string {
  return withCartoKey(TILE_URL);
}

function withCartoKey(url: string): string {
  const key = env.NEXT_PUBLIC_CARTO_API_KEY;
  if (!key) return url;
  return `${url}?key=${encodeURIComponent(key)}`;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// docs/specs/redesign-map.md (MAPUI-25); docs/design/system/components/PricePin/README.md.
// Leaflet renders a divIcon from an HTML string, so the pin is drawn with the
// theme's utility classes (no inline colours). The marker element itself is
// a zero-size point at the coordinates; the pill is centred on it and never
// wraps. Its active state is the marker's `data-active`, toggled in place, so
// Leaflet never swaps the element (and its focus and listeners) for a new one.
// The active state turns on and off at once, with no transition (MOTION-9).
function pinIcon(label: string) {
  return L.divIcon({
    className: "group/pin focus-visible:outline-none",
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    html: `<span class="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-pointer border border-line bg-surface before:absolute before:top-1/2 before:left-1/2 before:size-11 before:-translate-x-1/2 before:-translate-y-1/2 ${PIN_BASE_CLASSES} group-data-[active=true]/pin:border-transparent group-data-[active=true]/pin:bg-lime group-data-[active=true]/pin:font-extrabold group-data-[active=true]/pin:text-on-lime group-data-[active=true]/pin:shadow-pin-active group-focus-visible/pin:outline-2 group-focus-visible/pin:outline-offset-3 group-focus-visible/pin:outline-lime">${escapeHtml(label)}</span>`,
  });
}

// MAP-25: fits once, on mount, and never again for as long as this instance
// stays mounted — so appending a page or toggling a favourite (which only
// change the `listings` prop, not the instance) never refits. `ListingsMap`
// gives this component `key={resultsGeneration}` below, so a new search's
// first results remount a fresh `FitBounds` and fit to them; `map` and
// `listings` are read through refs, not the effect's dependencies, because
// this same instance still re-renders with a new `listings` array on every
// appended page and must not re-fit then.
// An alert's map (docs/specs/redesign-alerts.md, ALERTUI-16) fits its zone
// and every pin together, once, when the alert opens: the alert's id is its
// generation. With neither a zone nor a pin it goes back to the default view
// (`resetWhenEmpty`), so the alert open before leaves no zone fitted behind;
// a search with no results keeps the view it had (MAP-25).
interface FitBoundsProps {
  listings: CarListing[];
  zone?: MapZone;
  resetWhenEmpty: boolean;
}

function FitBounds({ listings, zone, resetWhenEmpty }: FitBoundsProps) {
  const map = useMap();
  const mapRef = useRef(map);
  mapRef.current = map;
  const listingsRef = useRef(listings);
  listingsRef.current = listings;
  const zoneRef = useRef(zone);
  zoneRef.current = zone;
  const resetRef = useRef(resetWhenEmpty);
  resetRef.current = resetWhenEmpty;

  useEffect(() => {
    // A listing with no coordinates has no pin (groupPins), so it has no say
    // in the bounds either (redesign-saved.md › Edge cases).
    const current = listingsRef.current.filter(hasCoordinates);
    const fitZone = zoneRef.current;
    if (current.length === 0 && !fitZone) {
      if (resetRef.current) mapRef.current.setView(DEFAULT_VIEW.center, DEFAULT_VIEW.zoom);
      return;
    }
    const bounds = L.latLngBounds(current.map((l) => [l.lat, l.lng]));
    if (fitZone) bounds.extend(zoneBounds(fitZone));
    mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, []);

  return null;
}

/** The currently open pin's own close, so only that one popup is ever asked
 * to close — never a bare `map.closePopup()`, which cannot tell one marker's
 * popup from another's (MAPUI-27). Shared by every PricePin and by
 * ClosePopupOnPreviewClear, one instance per ListingsMap. */
interface OpenPin {
  key: string;
  requestClose: () => void;
}
type OpenPinRef = MutableRefObject<OpenPin | null>;

// MAPUI-39: the desktop preview is a Leaflet `Popup`, closed only through the
// open pin's own `requestClose()` (see MapPreview's own close button below)
// — clearing `previewId` alone (lib/hooks/useMapPageState.ts's `pinActiveId`,
// e.g. when «Crear alerta» opens) leaves it on screen. `hadPreviewRef` tracks
// whether a preview was open so this only fires on the id -> null/undefined
// transition, never on mount.
interface ClosePopupOnPreviewClearProps {
  previewId: string | null | undefined;
  openPinRef: OpenPinRef;
}

function ClosePopupOnPreviewClear({ previewId, openPinRef }: ClosePopupOnPreviewClearProps) {
  const hadPreviewRef = useRef(false);

  useEffect(() => {
    if (previewId) {
      hadPreviewRef.current = true;
      return;
    }
    if (hadPreviewRef.current) {
      openPinRef.current?.requestClose();
      hadPreviewRef.current = false;
    }
  }, [previewId, openPinRef]);

  return null;
}

// MAPUI-62: the map itself was clicked or tapped, or a pan started. A pin's
// click never reaches the map (Leaflet's markers do not bubble their mouse
// events to it), so a pin tap never counts. The latest callback is read
// through a ref, so the listeners are bound once, not on every render.
interface MapInteractionsProps {
  onMapInteract: () => void;
}

function MapInteractions({ onMapInteract }: MapInteractionsProps) {
  const callbackRef = useRef(onMapInteract);
  callbackRef.current = onMapInteract;
  const handlers = useMemo(
    () => ({ click: () => callbackRef.current(), dragstart: () => callbackRef.current() }),
    [],
  );
  useMapEvents(handlers);
  return null;
}

const POPUP_CLASS = [
  "[&_.leaflet-popup-content-wrapper]:rounded-preview!",
  "[&_.leaflet-popup-content-wrapper]:border!",
  "[&_.leaflet-popup-content-wrapper]:border-line!",
  "[&_.leaflet-popup-content-wrapper]:bg-surface!",
  "[&_.leaflet-popup-content-wrapper]:p-0!",
  "[&_.leaflet-popup-content-wrapper]:text-text!",
  "[&_.leaflet-popup-content-wrapper]:shadow-float!",
  "[&_.leaflet-popup-content]:m-0!",
  "[&_.leaflet-popup-tip-container]:hidden!",
].join(" ");

interface PricePinProps extends PreviewProps {
  active: boolean;
  preview: boolean;
  onActivate?: (listingId: string) => void;
  onPreviewClose?: () => void;
  openPinRef: OpenPinRef;
}

function PricePin({
  group,
  active,
  preview,
  onActivate,
  onPreviewClose,
  favoriteIds,
  onToggleFavorite,
  openPinRef,
}: PricePinProps) {
  const t = useTranslations();
  const locale = useLocale();
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);
  // Removes the open preview's Escape listener; Leaflet keeps one popup
  // element across openings, so each opening's listener goes on its close.
  const removePreviewListenersRef = useRef<(() => void) | null>(null);
  // Removes the click interception `add` installs below, on unmount.
  const removeClickInterceptRef = useRef<(() => void) | null>(null);
  // MAPUI-27: the mounted MapPreview's own open/close control. Escape and the
  // outside press call `requestClose()` instead of closing the popup
  // outright, so the card fades out before map.closePopup() tears it down;
  // `popupopen` calls `reset()` on every open, a reopen included, since the
  // card's React tree never actually unmounts between closes.
  const previewControlRef = useRef<PreviewController | null>(null);
  const icon = useMemo(() => pinIcon(group.label), [group.label]);
  const [first] = group.listings;
  const markerLabel =
    group.listings.length === 1
      ? t("map.markerLabel", { title: first.title, price: formatPrice(first.price, locale) })
      : group.label;

  // The pin's active state lives on Leaflet's own element (see pinIcon).
  useEffect(() => {
    markerRef.current?.getElement()?.setAttribute("data-active", String(active));
  }, [active]);

  // Its accessible name follows the label: a new price or a group that grows
  // renames the same element.
  useEffect(() => {
    markerRef.current?.getElement()?.setAttribute("aria-label", markerLabel);
  }, [markerLabel]);

  // A pin can unmount with its preview still open (its group left the
  // results while the popup was up), which leaves the document-level
  // pointerdown listener registered with nothing to close on its behalf.
  useEffect(() => {
    return () => {
      removePreviewListenersRef.current?.();
      removeClickInterceptRef.current?.();
    };
  }, []);

  return (
    <Marker
      ref={markerRef}
      position={[first.lat, first.lng]}
      icon={icon}
      zIndexOffset={active ? 1000 : 0}
      eventHandlers={{
        add: () => {
          const marker = markerRef.current;
          const element = marker?.getElement();
          if (!marker || !element) return;
          element.setAttribute("aria-label", markerLabel);
          element.setAttribute("data-active", String(active));
          // Enter and Space activate the pin like a click (MAPUI-27). Handled
          // on keydown, whose default prevented also stops Leaflet's own
          // Enter handling, so the preview never toggles twice. Escape on the
          // pin closes its preview. A second activation while the preview
          // already shows fades it out (`toggleOpenPreview`) instead of
          // letting Leaflet's native handling, triggered below by
          // `marker.fire("click")`, tear it down outright.
          element.addEventListener("keydown", (keyEvent) => {
            if (keyEvent.key === "Escape") {
              if (previewControlRef.current) previewControlRef.current.requestClose();
              else marker.closePopup();
              return;
            }
            if (keyEvent.key !== "Enter" && keyEvent.key !== " ") return;
            keyEvent.preventDefault();
            if (preview && marker.isPopupOpen()) {
              toggleOpenPreview(marker, previewControlRef);
              return;
            }
            marker.fire("click");
          });

          if (preview) {
            // react-leaflet's Popup child binds the marker's own click
            // listener (`bindPopup`, before this "add" handler runs, since
            // child effects run before the parent's), and that listener
            // closes an open popup outright on a second click, with no
            // fade. A capture-phase listener on `document` runs before the
            // event ever reaches the marker's element, so it can step in
            // first: a pointer press on an open pin fades the preview out
            // (or, mid-fade, cancels the exit and refocuses) instead of
            // reaching Leaflet's click-toggle at all.
            const interceptClick = (domEvent: MouseEvent) => {
              if (!(domEvent.target instanceof Node)) return;
              if (!element.contains(domEvent.target)) return;
              if (!marker.isPopupOpen()) return;
              domEvent.stopPropagation();
              toggleOpenPreview(marker, previewControlRef);
            };
            document.addEventListener("click", interceptClick, true);
            removeClickInterceptRef.current = () =>
              document.removeEventListener("click", interceptClick, true);
          }
        },
        click: () => {
          // Leaflet's own click-toggle (bound when the Popup child mounted,
          // before this one) has already opened or closed the popup by the
          // time this runs, since a toggle-close on an already-open pin is
          // intercepted above before either ever fires: a click that closed
          // it leaves the pin inactive, as its close reported (MAPUI-27).
          if (preview && !markerRef.current?.isPopupOpen()) return;
          onActivate?.(first.id);
        },
        popupopen: (event: PopupEvent) => {
          const popupElement = event.popup.getElement();
          if (!popupElement) return;
          // Opening another pin's preview while one is already open fades
          // the first out through its own `requestClose()` — never a bare
          // `map.closePopup()`, which cannot tell the two popups apart and,
          // called after this one has already opened, would risk tearing
          // this one down instead (MAPUI-27).
          const openPin = openPinRef.current;
          if (openPin && openPin.key !== group.key) openPin.requestClose();
          openPinRef.current = {
            key: group.key,
            requestClose: () => previewControlRef.current?.requestClose(),
          };
          // The card's React tree survives a close (react-leaflet portals it
          // into the popup's own content node for as long as that node
          // exists, open or closed), so this open — a reopen included — has
          // to put it back the way a fresh mount would.
          previewControlRef.current?.reset();
          // Escape inside the card closes it too.
          const closeOnEscape = (keyEvent: KeyboardEvent) => {
            if (keyEvent.key !== "Escape") return;
            if (previewControlRef.current) previewControlRef.current.requestClose();
            else event.popup.close();
          };
          // So does a press anywhere outside the card and its pin, on the map
          // or the page (MAPUI-27). Captured, so nothing under it can stop it.
          const closeOnPressOutside = (pointerEvent: PointerEvent) => {
            const target = pointerEvent.target;
            if (!(target instanceof Node)) return;
            if (popupElement.contains(target)) return;
            if (markerRef.current?.getElement()?.contains(target)) return;
            if (previewControlRef.current) previewControlRef.current.requestClose();
            else event.popup.close();
          };
          popupElement.addEventListener("keydown", closeOnEscape);
          document.addEventListener("pointerdown", closeOnPressOutside, true);
          removePreviewListenersRef.current = () => {
            popupElement.removeEventListener("keydown", closeOnEscape);
            document.removeEventListener("pointerdown", closeOnPressOutside, true);
          };
        },
        popupclose: () => {
          removePreviewListenersRef.current?.();
          removePreviewListenersRef.current = null;
          if (openPinRef.current?.key === group.key) openPinRef.current = null;
          onPreviewClose?.();
          const marker = markerRef.current;
          // Focus goes back to the pin that opened it (MAPUI-27), once the
          // close has settled: not when another pin's preview opened in its
          // place, nor when the focus already moved on outside the map (to
          // the «Crear alerta» card that closed it, MAPUI-39).
          window.setTimeout(() => {
            if (anyPopupOpen(map)) return;
            const focused = document.activeElement;
            const focusLost =
              !focused?.isConnected ||
              focused === document.body ||
              map.getContainer().contains(focused);
            if (focusLost) marker?.getElement()?.focus({ preventScroll: true });
          }, 0);
        },
      }}
    >
      {preview && (
        <Popup
          closeButton={false}
          minWidth={340}
          maxWidth={340}
          offset={[0, -16]}
          className={POPUP_CLASS}
          // Opening another pin must not instantly tear this one down —
          // the cross-fade is handled by hand in `popupopen` above, through
          // each pin's own `requestClose()` (MAPUI-27).
          autoClose={false}
        >
          <MapPreview
            group={group}
            favoriteIds={favoriteIds}
            onToggleFavorite={onToggleFavorite}
            previewControlRef={previewControlRef}
            onExitComplete={() => {
              // Closes only this marker's own popup, and only if Leaflet
              // still has it open — a pin that unmounted mid-exit has no
              // marker left to close (MAPUI-27).
              if (markerRef.current?.isPopupOpen()) markerRef.current.closePopup();
            }}
          />
        </Popup>
      )}
    </Marker>
  );
}

/**
 * Fades the preview out through `requestClose()`, or cancels an exit
 * already in flight and refocuses instead of reopening a second popup
 * (MAPUI-27's toggle). Shared by the pointer and keyboard paths in `add`
 * below, so neither one lets Leaflet's own click-toggle (bound by
 * react-leaflet's Popup child before this pin's own listeners attach) tear
 * the popup down without a fade.
 */
function toggleOpenPreview(
  marker: L.Marker,
  previewControlRef: MutableRefObject<PreviewController | null>,
) {
  const control = previewControlRef.current;
  if (control?.isClosing()) control.reset();
  else if (control) control.requestClose();
  else marker.closePopup();
}

/** Whether the map has a popup open: another pin's preview may open as this one closes. */
function anyPopupOpen(map: L.Map): boolean {
  let open = false;
  map.eachLayer((layer) => {
    if (layer instanceof L.Popup) open = true;
  });
  return open;
}

interface ListingsMapProps {
  listings?: CarListing[];
  /** Refits the map when it changes: a new search's first results, or the alert newly open. */
  resultsGeneration?: number | string;
  /** An alert's zone, drawn under the pins and fitted with them (ALERTUI-14, ALERTUI-16). */
  zone?: MapZone;
  /** A new generation with neither a zone nor a pin goes back to the default view: an alert's map (ALERTUI-16). */
  resetWhenEmpty?: boolean;
  /** The car whose pin is active: its preview is open or its card is hovered (MAPUI-27, MAPUI-28). */
  activeId?: string | null;
  /** The car whose preview popup is open — unlike `activeId`, never set by a hover or focus (MAPUI-39). */
  previewId?: string | null;
  /** A pin was activated, with the first car it holds. */
  onActivate?: (listingId: string) => void;
  onPreviewClose?: () => void;
  /** The map itself was clicked/tapped or a pan started — never a pin click (MAPUI-62). */
  onMapInteract?: () => void;
  /** Desktop: a pin opens the preview card and the zoom buttons show. Phone: neither (MAPUI-24, MAPUI-29). */
  desktop?: boolean;
  favoriteIds?: ReadonlySet<string>;
  onToggleFavorite?: (listing: CarListing, next: boolean) => void;
}

export function ListingsMap({
  listings = [],
  resultsGeneration,
  zone,
  resetWhenEmpty = false,
  activeId,
  previewId,
  onActivate,
  onPreviewClose,
  onMapInteract,
  desktop = true,
  favoriteIds,
  onToggleFavorite,
}: ListingsMapProps) {
  const t = useTranslations();
  const locale = useLocale();
  const groups = useMemo(() => groupPins(listings, { t, locale }), [listings, t, locale]);
  const tileUrl = cartoTileUrl();
  // One pin's close at a time is tracked here (see OpenPin above), shared by
  // every PricePin instance for as long as this ListingsMap stays mounted.
  const openPinRef = useRef<OpenPin | null>(null);

  return (
    // `isolate`: Leaflet's panes carry z-indexes up to 700; kept inside the
    // map, the header's popovers and the results sheet stay above them.
    <div className="isolate h-full w-full">
      <MapContainer
        center={DEFAULT_VIEW.center}
        zoom={DEFAULT_VIEW.zoom}
        zoomControl={false}
        // The preview card fades in with Motion, which honours reduced motion;
        // Leaflet's own CSS fade (popups and tiles) does not.
        fadeAnimation={false}
        // Leaflet's own instant close on a map click would race the fade our
        // own outside-press listener already plays through requestClose()
        // (MAPUI-27).
        closePopupOnClick={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url={tileUrl}
        />
        {zone && <ZoneLayers zone={zone} />}
        <FitBounds
          key={resultsGeneration}
          listings={listings}
          zone={zone}
          // No generation (an alert's map waiting for its next alert) is not a new one.
          resetWhenEmpty={resetWhenEmpty && resultsGeneration !== undefined}
        />
        <ClosePopupOnPreviewClear previewId={previewId} openPinRef={openPinRef} />
        {onMapInteract && <MapInteractions onMapInteract={onMapInteract} />}
        {groups.map((group) => (
          <PricePin
            key={group.key}
            group={group}
            active={group.listings.some((listing) => listing.id === activeId)}
            preview={desktop}
            onActivate={onActivate}
            onPreviewClose={onPreviewClose}
            favoriteIds={favoriteIds}
            onToggleFavorite={onToggleFavorite}
            openPinRef={openPinRef}
          />
        ))}
        {desktop && <MapZoom />}
      </MapContainer>
    </div>
  );
}
