// A stand-in for `maplibre-gl` in jsdom, which has no WebGL to draw a map
// with (docs/specs/map-maplibre.md › Decisions and rationale › Tests). Every
// test file that renders a map mocks the library with it:
//
//   vi.mock("maplibre-gl", () => import("@/test/utils/maplibre"));
//
// It records what the app's code asks of the map and keeps the DOM MapLibre
// would keep: a marker's element inside the map's canvas container, an open
// popup's content inside the map's container, and a click on the canvas
// container reported as the map's own `click`, the pins' included, as
// MapLibre reports it. Nothing is drawn and nothing is laid out, so the
// tests assert what the app asked for — never a pixel, a position or a size.
// Its methods live on the prototypes, so `vi.spyOn(MapLibreMap.prototype,
// "fitBounds")` sees every call.

import type { LngLatBoundsLike } from "maplibre-gl";
import { vi } from "vitest";

type Listener = (event: never) => void;
type LngLatTuple = [number, number];

interface LayerLike {
  id: string;
  [key: string]: unknown;
}

/** Every map alive, oldest first: a test finds the one it rendered here. */
const liveMaps: MapLibreMap[] = [];

class Evented {
  private listeners = new Map<string, Set<Listener>>();

  on(type: string, listener: Listener): this {
    const set = this.listeners.get(type) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(type, set);
    return this;
  }

  off(type: string, listener: Listener): this {
    this.listeners.get(type)?.delete(listener);
    return this;
  }

  /** Fires `type` with `event` to every listener, as MapLibre's own events do. */
  fire(type: string, event: object = {}): this {
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      (listener as (payload: object) => void)({ type, target: this, ...event });
    }
    return this;
  }
}

export class GPUInitializationError extends Error {}

let nextFailure: Error | undefined;

/** Makes the next map fail as it starts, as MapLibre does in a browser without WebGL. */
export function failNextMap(error: Error): void {
  nextFailure = error;
}

/** The app hands MapLibre its worker's URL; nothing loads a worker here. */
export const setWorkerUrl = vi.fn();

interface MapOptionsLike {
  container: HTMLElement;
  center?: LngLatTuple;
  zoom?: number;
  interactive?: boolean;
  [key: string]: unknown;
}

export class MapLibreMap extends Evented {
  readonly options: MapOptionsLike;
  readonly container: HTMLElement;
  readonly canvasContainer: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  center: LngLatTuple;
  zoom: number;
  readonly controls: Array<{ control: unknown; position?: string }> = [];
  readonly sources = new Map<string, unknown>();
  readonly layers: LayerLike[] = [];
  /** The markers on the map, in the order they were added. */
  readonly markers: Marker[] = [];
  removed = false;
  readonly touchZoomRotate = { disableRotation: () => undefined };
  readonly keyboard = { disableRotation: () => undefined };

  constructor(options: MapOptionsLike) {
    super();
    if (nextFailure) {
      const failure = nextFailure;
      nextFailure = undefined;
      // MapLibre has already put its canvas in the container when it fails.
      options.container.appendChild(document.createElement("canvas"));
      throw failure;
    }
    this.options = options;
    this.container = options.container;
    this.center = options.center ?? [0, 0];
    this.zoom = options.zoom ?? 0;
    this.container.classList.add("maplibregl-map");
    this.canvasContainer = document.createElement("div");
    this.canvasContainer.className = "maplibregl-canvas-container";
    // MapLibre reports a click anywhere in its canvas container — a marker
    // included — as the map's own `click`.
    this.canvasContainer.addEventListener("click", (originalEvent) =>
      this.fire("click", { originalEvent }),
    );
    this.canvas = document.createElement("canvas");
    this.canvas.className = "maplibregl-canvas";
    this.canvas.setAttribute("tabindex", options.interactive === false ? "-1" : "0");
    this.canvas.setAttribute("role", "region");
    this.canvas.setAttribute("aria-label", "Map");
    this.canvasContainer.appendChild(this.canvas);
    this.container.appendChild(this.canvasContainer);
    // MapLibre's control corners, after the canvas container: the app puts
    // its zoom buttons in the bottom-right one.
    const controlContainer = document.createElement("div");
    controlContainer.className = "maplibregl-control-container";
    for (const position of ["top-left", "top-right", "bottom-left", "bottom-right"]) {
      const corner = document.createElement("div");
      corner.className = `maplibregl-ctrl-${position}`;
      controlContainer.appendChild(corner);
    }
    this.container.appendChild(controlContainer);
    liveMaps.push(this);
  }

  /** The style is in the page's own code, so it is loaded at once. */
  once(type: string, listener: Listener): this {
    if (type === "style.load" || type === "load") {
      (listener as (payload: object) => void)({ type, target: this });
      return this;
    }
    const wrapped = ((event: never) => {
      this.off(type, wrapped);
      listener(event);
    }) as Listener;
    return this.on(type, wrapped);
  }

  getContainer(): HTMLElement {
    return this.container;
  }

  getCanvasContainer(): HTMLElement {
    return this.canvasContainer;
  }

  /** The canvas, named as MapLibre names it. */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  getCenter(): { lng: number; lat: number } {
    return { lng: this.center[0], lat: this.center[1] };
  }

  getZoom(): number {
    return this.zoom;
  }

  getBearing(): number {
    return 0;
  }

  getPitch(): number {
    return 0;
  }

  getStyle(): object | undefined {
    return this.removed ? undefined : { layers: this.layers };
  }

  addControl(control: unknown, position?: string): this {
    this.controls.push({ control, position });
    return this;
  }

  addSource(id: string, source: unknown): this {
    this.sources.set(id, source);
    return this;
  }

  removeSource(id: string): this {
    this.sources.delete(id);
    return this;
  }

  getSource(id: string): unknown {
    return this.sources.get(id);
  }

  addLayer(layer: LayerLike): this {
    this.layers.push(layer);
    return this;
  }

  removeLayer(id: string): this {
    const index = this.layers.findIndex((layer) => layer.id === id);
    if (index >= 0) this.layers.splice(index, 1);
    return this;
  }

  fitBounds(_bounds: [LngLatTuple, LngLatTuple], _options?: object): this {
    this.fire("moveend");
    return this;
  }

  jumpTo(options: { center?: LngLatTuple; zoom?: number }): this {
    if (options.center) this.center = options.center;
    if (options.zoom !== undefined) this.zoom = options.zoom;
    this.fire("moveend");
    return this;
  }

  /**
   * A point's pixel position in the map's container. Nothing is laid out
   * here, so the stand-in reads the longitude as x and the latitude as y:
   * a test places a pin at a pixel height by giving it that latitude.
   */
  project(lngLat: LngLatTuple): { x: number; y: number } {
    return { x: lngLat[0], y: lngLat[1] };
  }

  /** Records the pan the app asks for; nothing is laid out, so the view stays where it is. */
  panBy(_offset: [number, number], _options?: object): this {
    return this;
  }

  zoomIn(): this {
    this.zoom += 1;
    this.fire("moveend");
    return this;
  }

  zoomOut(): this {
    this.zoom -= 1;
    this.fire("moveend");
    return this;
  }

  remove(): void {
    this.removed = true;
    this.container.replaceChildren();
    this.container.classList.remove("maplibregl-map");
    const index = liveMaps.indexOf(this);
    if (index >= 0) liveMaps.splice(index, 1);
  }
}

export class Marker {
  private readonly element: HTMLElement;
  private map: MapLibreMap | undefined;
  lngLat: LngLatTuple | undefined;

  constructor(options: { element?: HTMLElement; anchor?: string } = {}) {
    this.element = options.element ?? document.createElement("div");
    this.element.classList.add("maplibregl-marker");
  }

  setLngLat(lngLat: LngLatTuple): this {
    this.lngLat = lngLat;
    return this;
  }

  addTo(map: MapLibreMap): this {
    map.getCanvasContainer().appendChild(this.element);
    map.markers.push(this);
    this.map = map;
    return this;
  }

  getElement(): HTMLElement {
    return this.element;
  }

  remove(): this {
    this.element.remove();
    const markers = this.map?.markers;
    const index = markers?.indexOf(this) ?? -1;
    if (markers && index >= 0) markers.splice(index, 1);
    this.map = undefined;
    return this;
  }
}

export class Popup {
  readonly options: { className?: string; [key: string]: unknown };
  private readonly container = document.createElement("div");
  lngLat: LngLatTuple | undefined;

  constructor(options: { className?: string; [key: string]: unknown } = {}) {
    this.options = options;
    this.container.className = ["maplibregl-popup", options.className].filter(Boolean).join(" ");
  }

  setLngLat(lngLat: LngLatTuple): this {
    this.lngLat = lngLat;
    return this;
  }

  setDOMContent(node: Node): this {
    const content = document.createElement("div");
    content.className = "maplibregl-popup-content";
    content.appendChild(node);
    this.container.replaceChildren(content);
    return this;
  }

  addTo(map: MapLibreMap): this {
    map.getContainer().appendChild(this.container);
    return this;
  }

  getElement(): HTMLElement {
    return this.container;
  }

  remove(): this {
    this.container.remove();
    return this;
  }
}

export class AttributionControl {
  readonly options: { compact?: boolean; customAttribution?: string };

  constructor(options: { compact?: boolean; customAttribution?: string } = {}) {
    this.options = options;
  }
}

/** The map whose container sits inside `element`, or the newest map alive. */
export function mapIn(element?: Element): MapLibreMap {
  const found = element
    ? liveMaps.find((map) => element.contains(map.getContainer()))
    : liveMaps.at(-1);
  if (!found) throw new Error("No map is rendered there.");
  return found;
}

/** Every map alive, oldest first. */
export function liveMapList(): readonly MapLibreMap[] {
  return liveMaps;
}

/** A `[lng, lat]` corner, as the app hands `fitBounds` its bounds. */
function corner(value: unknown): LngLatTuple {
  if (Array.isArray(value) && typeof value[0] === "number" && typeof value[1] === "number") {
    return [value[0], value[1]];
  }
  throw new Error("fitBounds was not given [lng, lat] corners.");
}

/** Whether bounds handed to `fitBounds` — south-west then north-east, longitude first — hold the point at `lat`, `lng`. */
export function fittedContains(bounds: LngLatBoundsLike, lat: number, lng: number): boolean {
  if (!Array.isArray(bounds) || bounds.length !== 2) {
    throw new Error("fitBounds was not given two corners.");
  }
  const [west, south] = corner(bounds[0]);
  const [east, north] = corner(bounds[1]);
  return lng >= west && lng <= east && lat >= south && lat <= north;
}
