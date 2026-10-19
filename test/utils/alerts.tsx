import type { ComponentType } from "react";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, type Mock, vi } from "vitest";
import { AlertPage } from "@/components/alerts/AlertPage";
import { AlertsPage } from "@/components/alerts/AlertsPage";
import { Toaster } from "@/components/Toaster";
import type { AlertsPageData, AlertWithMatches } from "@/interfaces/alert";
import { adaAlerts, corollaMatches, ALERT_ID } from "@/test/fixtures/alert-listings";
import { type RenderWithI18nOptions, renderWithI18n } from "@/test/utils/render";
import { liveMapList, type MapLibreMap } from "@/test/utils/maplibre";
import { rows } from "@/test/utils/saved";

// The alerts pages as components/alerts/AlertsPage*.test.tsx and
// AlertPage*.test.tsx render them and look them up
// (docs/specs/redesign-alerts.md, ALERTUI). Each page is rendered with the
// app's Toaster, in Spanish, the copy the spec's worked examples quote.

type RenderOptions = Pick<RenderWithI18nOptions, "searchParams" | "onUrlUpdate">;

/** Ada's /alerts with the newest, Corolla híbrido, open (worked example "Open alert"). */
export function adaPage(overrides: Partial<AlertsPageData> = {}): AlertsPageData {
  return {
    alerts: adaAlerts(),
    openAlertId: ALERT_ID.corolla,
    matches: corollaMatches(),
    ...overrides,
  };
}

function alertsUi(data: AlertsPageData) {
  return (
    <>
      <AlertsPage {...data} />
      <Toaster />
    </>
  );
}

/** /alerts with `data`, opened at `searchParams`. `rerender` takes the server's next data. */
export function renderAlerts(data: AlertsPageData = adaPage(), options: RenderOptions = {}) {
  const view = renderWithI18n(alertsUi(data), { locale: "es", ...options });
  return { ...view, rerenderWith: (next: AlertsPageData) => view.rerender(alertsUi(next)) };
}

/** /alerts/[id] for `alert`. */
export function renderAlert(alert: AlertWithMatches, options: RenderOptions = {}) {
  return renderWithI18n(
    <>
      <AlertPage alert={alert} />
      <Toaster />
    </>,
    { locale: "es", ...options },
  );
}

/** The alert map, «Mapa de la alerta». */
export function mapRegion(): HTMLElement {
  return screen.getByRole("region", { name: "Mapa de la alerta" });
}

/** Whitespace collapsed, U+00A0 included, as Testing Library's matchers read text. */
export function normalized(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

/** The innermost element under `container` whose whole text reads `text`. */
export function byWholeText(container: HTMLElement, text: string): HTMLElement {
  const matches = Array.from(container.querySelectorAll<HTMLElement>("*")).filter(
    (element) =>
      normalized(element.textContent) === normalized(text) &&
      !Array.from(element.children).some(
        (child) => normalized(child.textContent) === normalized(text),
      ),
  );
  expect(matches, `an element reading «${text}»`).toHaveLength(1);
  return matches[0];
}

/** Whether `element` sits inside the alert map, when there is one. */
function inMap(element: HTMLElement): boolean {
  const map = screen.queryByRole("region", { name: "Mapa de la alerta" });
  return map?.contains(element) ?? false;
}

/**
 * The alerts' names as the list draws them, in order, the map's pill left
 * out, and so is a deleted card still fading out (aria-hidden while it does).
 */
export function listedAlertNames(names: readonly string[]): string[] {
  const pattern = new RegExp(
    `^(${names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})$`,
  );
  return screen
    .queryAllByText(pattern)
    .filter((element) => !inMap(element) && !element.closest("[aria-hidden='true']"))
    .map((element) => normalized(element.textContent));
}

/** The open AlertCard (ALERTUI-7): an article named by its alert's name. */
export function openCard(name: string): HTMLElement {
  return screen.getByRole("article", { name });
}

/** A folded AlertCard (ALERTUI-6, ALERTUI-11): one button named by its alert's name. */
export function foldedCard(name: string): HTMLElement {
  return screen.getByRole("button", { name });
}

/** The links to listings inside `container`, in order: the alert match cards, the Guardados cards. */
export function listingLinks(container: HTMLElement): HTMLAnchorElement[] {
  return within(container)
    .queryAllByRole("link")
    .filter((link): link is HTMLAnchorElement => link.getAttribute("target") === "_blank");
}

/** Whether the card holding `element` is outlined (`data-active`, as the Guardados card is). */
export function isOutlined(element: HTMLElement): boolean {
  return element.closest("[data-active='true']") !== null;
}

/** The accessible names of every pin on the map, sorted: each pin is a button in a MapLibre marker. */
export function pinNames(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>(".maplibregl-marker button"))
    .map((pin) => pin.getAttribute("aria-label") ?? "")
    .sort();
}

/**
 * The zone's shapes — the circle and the centre dot — as the GeoJSON features
 * of the "zone" source (components/map/ZoneLayers.tsx) on `map`, or on every
 * map alive. They are drawn on the canvas, under the pins (test/utils/maplibre.ts).
 */
export function zoneShapes(map?: MapLibreMap): ZoneFeature[] {
  const maps = map ? [map] : liveMapList();
  return maps.flatMap((each) => {
    const source = each.getSource("zone") as { data: { features: ZoneFeature[] } } | undefined;
    return source?.data.features ?? [];
  });
}

/** A zone shape: the circle's polygon or the centre's point. */
export interface ZoneFeature {
  geometry:
    | { type: "Polygon"; coordinates: number[][][] }
    | { type: "Point"; coordinates: number[] };
}

/** The compact row (phone) of the car named `title`: the button that opens its car sheet, as on /favorites. */
export function matchRow(title: string): HTMLElement {
  const found = rows().find((row) => row.textContent?.includes(title));
  expect(found, `the row of ${title}`).toBeDefined();
  return found as HTMLElement;
}

/** The Guardados cards (desktop /alerts/[id]): every article but the map's preview and the AlertCard. */
export function guardadosCards(): HTMLElement[] {
  return screen
    .queryAllByRole("article")
    .filter(
      (article) => !article.hasAttribute("aria-label") && !article.hasAttribute("aria-labelledby"),
    );
}

/** The props both alert routes' error.tsx take. */
interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * The tests both alert routes' error.tsx share (PLAT-14; ALERTUI-42): `name`
 * titles the first block, and `refresh` is the file's own mocked
 * `router.refresh`.
 *
 * PLAT-14 (docs/specs/core-platform.md): each route gets an error.tsx that
 * shows a translated message and a retry button, instead of the read silently
 * turning into an empty list (issue #48).
 *
 * docs/specs/redesign-alerts.md (ALERTUI-42; amends PLAT-14): the error file
 * is the page-error state of F0-estado-error-pagina
 * (components/ui/PageError.tsx), as /favorites' (SAVED-32): «¿Se ha roto
 * algo?» over «No es culpa tuya», its line, «Reintentar» and «Volver al
 * mapa». At desktop width the empty alert map sits beside it, hidden below
 * `lg` by CSS. components/ui/RouteError.tsx, whose only users were the two
 * alerts routes, is removed.
 */
export function describeAlertsRouteError(
  name: string,
  RouteError: ComponentType<RouteErrorProps>,
  refresh: Mock,
) {
  describe(name, () => {
    it("PLAT-14: shows a retry control that calls reset", async () => {
      const reset = vi.fn();
      renderWithI18n(<RouteError error={new Error("x")} reset={reset} />);

      const retry = screen.getByRole("button", { name: /retry/i });
      await userEvent.click(retry);

      expect(reset).toHaveBeenCalledTimes(1);
    });

    it("PLAT-14: retry also refreshes the route's server data", async () => {
      refresh.mockClear();
      const reset = vi.fn();
      renderWithI18n(<RouteError error={new Error("x")} reset={reset} />);

      const retry = screen.getByRole("button", { name: /retry/i });
      await userEvent.click(retry);

      expect(refresh).toHaveBeenCalledTimes(1);
      expect(reset).toHaveBeenCalledTimes(1);
    });

    it("PLAT-14: never shows the raw error message", () => {
      renderWithI18n(<RouteError error={new Error("x")} reset={vi.fn()} />);

      expect(screen.queryByText("x")).not.toBeInTheDocument();
    });
  });

  describe("ALERTUI-42: the page-error state", () => {
    it("ALERTUI-42: «¿Se ha roto algo?» over «No es culpa tuya» is the page's h1, over its line", () => {
      renderWithI18n(<RouteError error={new Error("x")} reset={vi.fn()} />, { locale: "es" });

      const headings = screen.getAllByRole("heading", { level: 1 });
      expect(headings).toHaveLength(1);
      expect(headings[0]).toHaveTextContent("¿Se ha roto algo?");
      expect(headings[0]).toHaveTextContent("No es culpa tuya");
      expect(
        screen.getByText(
          "Esta página no ha cargado. Vuelve a intentarlo y, si sigue, vuelve al mapa.",
        ),
      ).toBeInTheDocument();
    });

    it("ALERTUI-42: «Reintentar» refreshes the route's server data and resets the boundary", async () => {
      refresh.mockClear();
      const reset = vi.fn();
      renderWithI18n(<RouteError error={new Error("x")} reset={reset} />, { locale: "es" });

      await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));

      expect(refresh).toHaveBeenCalledTimes(1);
      expect(reset).toHaveBeenCalledTimes(1);
    });

    it("ALERTUI-42: «Volver al mapa» is a link to /map", () => {
      renderWithI18n(<RouteError error={new Error("x")} reset={vi.fn()} />, { locale: "es" });

      expect(screen.getByRole("link", { name: "Volver al mapa" })).toHaveAttribute("href", "/map");
    });

    it("ALERTUI-42: shows no «Alertas» heading, no card and not the thrown error", () => {
      renderWithI18n(
        <RouteError error={new Error("relation alerts does not exist")} reset={vi.fn()} />,
        { locale: "es" },
      );

      expect(screen.queryByRole("heading", { name: "Alertas" })).not.toBeInTheDocument();
      expect(screen.queryByRole("article")).not.toBeInTheDocument();
      expect(screen.queryByText(/relation alerts does not exist/)).not.toBeInTheDocument();
      expect(screen.queryByText("No se pudo cargar esta página. Inténtalo de nuevo.")).toBeNull();
    });

    it("ALERTUI-42: at desktop width the map region beside it shows no zone, no pin and no pill, and CSS hides it below lg", async () => {
      const { container } = renderWithI18n(<RouteError error={new Error("x")} reset={vi.fn()} />, {
        locale: "es",
      });

      const map = await screen.findByRole("region", { name: "Mapa de la alerta" });
      expect(map).toHaveClass("hidden", "lg:flex");
      expect(container.querySelector(".maplibregl-marker")).toBeNull();
      expect(zoneShapes()).toEqual([]);
      // No pill: neither the loading one, the empty one nor an alert's.
      expect(within(map).queryByText("Cargando…")).toBeNull();
      expect(within(map).queryByText("Aquí verás la zona de cada alerta")).toBeNull();
      expect(map.querySelector(".rounded-pill")).toBeNull();
    });
  });
}
