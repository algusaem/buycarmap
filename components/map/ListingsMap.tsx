"use client";

import { type MapLibreMap, type MapMouseEvent, Marker, Popup } from "maplibre-gl";
import {
  type MutableRefObject,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import type { CarListing } from "@/interfaces/listing";
import { formatPrice } from "@/lib/format";
import { lastInputWasKeyboard } from "@/lib/input-modality";
import { useMapLibre } from "@/lib/hooks/useMapLibre";
import { groupPins, hasCoordinates } from "@/lib/map/group-pins";
import { PIN_BASE_CLASSES } from "@/lib/map/pin-classes";
import { boundsOf, DEFAULT_VIEW, type LngLat } from "@/lib/map/view";
import { type MapZone, zoneBounds } from "@/lib/map/zone";
import { cn } from "@/lib/utils";
import { MapInstanceContext, useMapInstance } from "@/components/map/MapInstanceContext";
import { MapPreview, type PreviewController, type PreviewProps } from "@/components/map/MapPreview";
import { MapZoom } from "@/components/map/MapZoom";
import { MAP_PILL_CLASS } from "@/components/map/ResultsStates";
import { ZoneLayers } from "@/components/map/ZoneLayers";

// docs/specs/map-maplibre.md; docs/specs/redesign-map.md (MAPUI-24 to
// MAPUI-29, MAPUI-39, MAPUI-62). The search, saved and alert maps: one
// MapLibre map (lib/hooks/useMapLibre.ts) in the design's own style, a price
// pin per point, the desktop preview card, the alert's zone and the zoom
// buttons. The pins and the preview are React trees portaled into the
// elements MapLibre positions — a `Marker`'s element and a `Popup`'s content
// — so their buttons, names, focus and keys stay React's.

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
// MAPLIBRE-7: 40px of padding on every side and a maximum zoom of 13
// (Leaflet's 14, on MapLibre's 512px tiles), at once: the view a page's
// first results open on is the one the map first reports, not a frame of a
// flight still under way (MAPLIBRE-9).
interface FitBoundsProps {
  listings: CarListing[];
  zone?: MapZone;
  resetWhenEmpty: boolean;
}

function FitBounds({ listings, zone, resetWhenEmpty }: FitBoundsProps) {
  const map = useMapInstance();
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
    const points: LngLat[] = listingsRef.current
      .filter(hasCoordinates)
      .map((listing) => [listing.lng, listing.lat]);
    const fitZone = zoneRef.current;
    if (points.length === 0 && !fitZone) {
      if (resetRef.current) {
        mapRef.current.jumpTo({ center: DEFAULT_VIEW.center, zoom: DEFAULT_VIEW.zoom });
      }
      return;
    }
    if (fitZone) points.push(...zoneBounds(fitZone));
    mapRef.current.fitBounds(boundsOf(points), { padding: 40, maxZoom: 13, animate: false });
  }, []);

  return null;
}

/** The currently open pin's own close, so only that one preview is ever asked
 * to close (MAPUI-27). Shared by every PricePin and by
 * ClosePopupOnPreviewClear, one instance per ListingsMap. */
interface OpenPin {
  key: string;
  requestClose: () => void;
}
type OpenPinRef = MutableRefObject<OpenPin | null>;

// MAPUI-39: the desktop preview closes only through the open pin's own
// `requestClose()` — clearing `previewId` alone (lib/hooks/useMapPageState.ts's
// `pinActiveId`, e.g. when «Crear alerta» opens) would leave it on screen.
// `hadPreviewRef` tracks whether a preview was open so this only fires on the
// id -> null/undefined transition, never on mount.
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

/** Whether a press landed on a pin or the preview: elements over the map, not the map. */
function onMapElement(target: EventTarget | null): boolean {
  return (
    target instanceof Element && target.closest(".maplibregl-marker, .maplibregl-popup") !== null
  );
}

// MAPUI-62: the map itself was clicked or tapped, or a pan started. MapLibre
// reports a click on a pin as the map's too (the pins sit inside its canvas
// container), so a click whose target is a pin or the preview never counts.
// The latest callback is read through a ref, so the listeners are bound
// once, not on every render.
interface MapInteractionsProps {
  onMapInteract: () => void;
}

function MapInteractions({ onMapInteract }: MapInteractionsProps) {
  const map = useMapInstance();
  const callbackRef = useRef(onMapInteract);
  callbackRef.current = onMapInteract;

  useEffect(() => {
    const onClick = (event: MapMouseEvent) => {
      if (onMapElement(event.originalEvent.target)) return;
      callbackRef.current();
    };
    const onDragStart = () => callbackRef.current();
    map.on("click", onClick);
    map.on("dragstart", onDragStart);
    return () => {
      map.off("click", onClick);
      map.off("dragstart", onDragStart);
    };
  }, [map]);

  return null;
}

// The preview card's frame, restyled with important utilities because
// maplibre-gl.css is unlayered: no padding, no tip, the card's own radius,
// border, surface and shadow, 340px wide.
const POPUP_CLASS = [
  "[&_.maplibregl-popup-content]:w-85!",
  "[&_.maplibregl-popup-content]:rounded-preview!",
  "[&_.maplibregl-popup-content]:border!",
  "[&_.maplibregl-popup-content]:border-line!",
  "[&_.maplibregl-popup-content]:bg-surface!",
  "[&_.maplibregl-popup-content]:p-0!",
  "[&_.maplibregl-popup-content]:text-text!",
  "[&_.maplibregl-popup-content]:shadow-float!",
  "[&_.maplibregl-popup-tip]:hidden!",
].join(" ");

// docs/specs/redesign-map.md (MAPUI-25); docs/design/system/components/PricePin/README.md.
// The marker's element, which MapLibre centres on the point. The one whose
// pin is active is drawn over the others.
const MARKER_CLASS = "has-data-[active=true]:z-1";

/** The pill: drawn with the theme's utility classes; active and inactive switch at once, with no transition (MOTION-9). */
const PIN_CLASS = `relative block cursor-pointer border border-line bg-surface before:absolute before:top-1/2 before:left-1/2 before:size-11 before:-translate-x-1/2 before:-translate-y-1/2 ${PIN_BASE_CLASSES} data-[active=true]:border-transparent data-[active=true]:bg-lime data-[active=true]:font-extrabold data-[active=true]:text-on-lime data-[active=true]:shadow-pin-active focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-lime`;

// MAPLIBRE-6: the preview opens above its pin, where Leaflet put it — its
// popup's offset of 16px plus the 20px bottom margin leaflet.css gave every
// popup, so the card's bottom edge sits 36px above the point.
const PREVIEW_OFFSET = 36;
/** The room the open preview keeps from the map's edges once panned into view. */
const PREVIEW_MARGIN = 16;
/** Leaflet's autoPan duration, which a pointer's open keeps. */
const PREVIEW_PAN_MS = 250;

/** How far a span from `start` to `end` lies outside `min`..`max`: the start side wins, as in Leaflet's autoPan. */
function overflow(start: number, end: number, min: number, max: number): number {
  if (start < min) return start - min;
  if (end > max) return end - max;
  return 0;
}

/**
 * MAPLIBRE-6: pans the map by the least that brings the open preview card
 * fully inside it, 16px clear of its edges, as Leaflet's autoPan did — at
 * once when a key opened it (MOTION-11), animated otherwise.
 */
function panPreviewIntoView(map: MapLibreMap, card: Element) {
  const cardBox = card.getBoundingClientRect();
  const mapBox = map.getContainer().getBoundingClientRect();
  const dx = overflow(
    cardBox.left,
    cardBox.right,
    mapBox.left + PREVIEW_MARGIN,
    mapBox.right - PREVIEW_MARGIN,
  );
  const dy = overflow(
    cardBox.top,
    cardBox.bottom,
    mapBox.top + PREVIEW_MARGIN,
    mapBox.bottom - PREVIEW_MARGIN,
  );
  if (dx === 0 && dy === 0) return;
  map.panBy([dx, dy], lastInputWasKeyboard() ? { animate: false } : { duration: PREVIEW_PAN_MS });
}

/** A double-click on a pin is two presses on it, never the map's double-click zoom. */
function keepFromMap(event: Event) {
  event.stopPropagation();
}

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
  const map = useMapInstance();
  const [first] = group.listings;
  const { lat, lng } = first;
  // The elements MapLibre places on the map; React renders into them.
  const [markerElement] = useState(() => {
    const element = document.createElement("div");
    element.className = MARKER_CLASS;
    return element;
  });
  const [popupContent] = useState(() => document.createElement("div"));
  const [open, setOpen] = useState(false);
  const pinRef = useRef<HTMLButtonElement>(null);
  // MAPUI-27: the mounted MapPreview's own open/close control. Escape, the
  // outside press and the toggle call `requestClose()`, so the card fades out
  // (at once after a key, MOTION-11) before its popup is removed.
  const previewControlRef = useRef<PreviewController | null>(null);
  const markerLabel =
    group.listings.length === 1
      ? t("map.markerLabel", { title: first.title, price: formatPrice(first.price, locale) })
      : group.label;

  // The preview is gone: the popup comes off, the page hears it closed, and
  // focus goes back to the pin that opened it (MAPUI-27), once the close has
  // settled: not when another pin's preview opened in its place, nor when the
  // focus already moved on outside the map (to the «Crear alerta» card that
  // closed it, MAPUI-39).
  function finishClose() {
    // Another pin's preview opened in this one's place: the page's preview is
    // that one now, so this close is not reported as the preview closing.
    const replaced = openPinRef.current !== null && openPinRef.current.key !== group.key;
    if (!replaced) openPinRef.current = null;
    setOpen(false);
    if (!replaced) onPreviewClose?.();
    window.setTimeout(() => {
      if (openPinRef.current) return;
      const focused = document.activeElement;
      const focusLost =
        !focused?.isConnected || focused === document.body || map.getContainer().contains(focused);
      if (focusLost) pinRef.current?.focus({ preventScroll: true });
    }, 0);
  }

  function requestClose() {
    if (previewControlRef.current) previewControlRef.current.requestClose();
    else finishClose();
  }
  // Read by the document listeners and by the other pins, which outlive this render.
  const requestCloseRef = useRef(requestClose);
  requestCloseRef.current = requestClose;

  function openPreview() {
    // Opening another pin's preview while one is open fades that one out
    // through its own close; this one stays open (MAPUI-27).
    const openPin = openPinRef.current;
    if (openPin && openPin.key !== group.key) openPin.requestClose();
    openPinRef.current = { key: group.key, requestClose: () => requestCloseRef.current() };
    setOpen(true);
  }

  // Enter and Space reach here as the button's own click. A second activation
  // while the preview shows fades it out — or, mid-fade, cancels the exit and
  // refocuses it (MAPUI-27's toggle); a close leaves the pin inactive, as its
  // close reports.
  function activate() {
    if (!preview) {
      onActivate?.(first.id);
      return;
    }
    if (open) {
      const control = previewControlRef.current;
      if (control?.isClosing()) control.reset();
      else requestClose();
      return;
    }
    openPreview();
    onActivate?.(first.id);
  }

  // Layout effects, so the marker and the popup are on the page before any
  // effect of the trees portaled into them runs (the preview focuses its
  // first control as it mounts).
  useLayoutEffect(() => {
    const marker = new Marker({ element: markerElement, anchor: "center" })
      .setLngLat([lng, lat])
      .addTo(map);
    markerElement.addEventListener("dblclick", keepFromMap);
    return () => {
      markerElement.removeEventListener("dblclick", keepFromMap);
      marker.remove();
    };
  }, [map, markerElement, lat, lng]);

  // The preview's popup, while it is open. Escape inside the card closes it,
  // and so does a press anywhere outside the card and its pin, on the map or
  // the page (MAPUI-27) — captured, so nothing under it can stop it. A pin
  // that unmounts with its preview open (its car left the results) takes the
  // popup with it at once (MOTION-11).
  useLayoutEffect(() => {
    if (!open) return;
    const popup = new Popup({
      closeButton: false,
      closeOnClick: false,
      closeOnMove: false,
      focusAfterOpen: false,
      maxWidth: "none",
      anchor: "bottom",
      offset: PREVIEW_OFFSET,
      className: POPUP_CLASS,
    })
      .setLngLat([lng, lat])
      .setDOMContent(popupContent)
      .addTo(map);
    const popupElement = popup.getElement();
    panPreviewIntoView(map, popupElement);
    const closeOnEscape = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === "Escape") requestCloseRef.current();
    };
    const closeOnPressOutside = (pointerEvent: PointerEvent) => {
      const target = pointerEvent.target;
      if (!(target instanceof Node)) return;
      if (popupElement.contains(target) || markerElement.contains(target)) return;
      requestCloseRef.current();
    };
    popupElement.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnPressOutside, true);
    return () => {
      popupElement.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnPressOutside, true);
      popup.remove();
    };
  }, [open, map, popupContent, markerElement, lat, lng]);

  // A pin that unmounts with its preview open frees the open-pin slot.
  useEffect(() => {
    return () => {
      if (openPinRef.current?.key === group.key) openPinRef.current = null;
    };
  }, [openPinRef, group.key]);

  return (
    <>
      {createPortal(
        <button
          ref={pinRef}
          type="button"
          aria-label={markerLabel}
          data-active={active}
          onClick={activate}
          onKeyDown={(keyEvent) => {
            // Escape on the pin closes its preview.
            if (keyEvent.key === "Escape" && open) requestClose();
          }}
          className={PIN_CLASS}
        >
          {group.label}
        </button>,
        markerElement,
      )}
      {open &&
        createPortal(
          <MapPreview
            group={group}
            favoriteIds={favoriteIds}
            onToggleFavorite={onToggleFavorite}
            previewControlRef={previewControlRef}
            onExitComplete={finishClose}
          />,
          popupContent,
        )}
    </>
  );
}

/** No WebGL: the map's ground with a status pill over it, as F0-estado-mapa-no-disponible draws it (MAPLIBRE-15). */
function MapUnavailable() {
  const t = useTranslations();
  const text = t("map.unavailable");

  return (
    <div className="pointer-events-none absolute top-4.5 right-4.5 left-4.5 z-1000">
      {/* A status takes no name from its text, so it carries it as its label too. */}
      <span role="status" aria-label={text} className={cn("pointer-events-auto", MAP_PILL_CLASS)}>
        {text}
      </span>
    </div>
  );
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
  /** The car whose preview is open — unlike `activeId`, never set by a hover or focus (MAPUI-39). */
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
  /**
   * Whether the map cannot be drawn (no WebGL, MAPLIBRE-15): its own «map
   * unavailable» pill then replaces the page's pill over the map — one
   * StatusPill at a time (StatusPill/README.md).
   */
  onUnavailableChange?: (unavailable: boolean) => void;
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
  onUnavailableChange,
}: ListingsMapProps) {
  const t = useTranslations();
  const locale = useLocale();
  const groups = useMemo(() => groupPins(listings, { t, locale }), [listings, t, locale]);
  // One pin's close at a time is tracked here (see OpenPin above), shared by
  // every PricePin instance for as long as this ListingsMap stays mounted.
  const openPinRef = useRef<OpenPin | null>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { map, unavailable } = useMapLibre(containerRef, viewRef, { interactive: true });
  // The page draws its pill beside this map, so it hears when the map's own takes its place.
  const unavailableChangeRef = useRef(onUnavailableChange);
  unavailableChangeRef.current = onUnavailableChange;
  useEffect(() => {
    unavailableChangeRef.current?.(unavailable);
  }, [unavailable]);

  return (
    // `isolate`: the map's own layers stay inside it, so the header's
    // popovers and the results sheet stay above them. `data-map` and the view
    // MapLibre writes beside it are the e2e tests' hooks (spec › Contracts).
    <div ref={viewRef} data-map="listings" className="relative isolate size-full bg-map-ground">
      <div ref={containerRef} className={cn("size-full", unavailable && "invisible")} />
      {unavailable && <MapUnavailable />}
      {map && !unavailable && (
        <MapInstanceContext.Provider value={map}>
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
        </MapInstanceContext.Provider>
      )}
    </div>
  );
}
