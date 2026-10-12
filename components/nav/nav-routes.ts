// docs/specs/redesign-navigation.md (HEAD): which header each route takes and
// which section it belongs to. The worked-example table in the spec is the
// whole contract; these functions are its only reading.

/** The kind of header a route draws (spec › Decisions: one per kind of page). */
export type HeaderKind = "map" | "pages" | "landing" | "access" | "legal";

/** The three sections of the pages header and the bottom nav. */
export type Section = "map" | "saved" | "alerts";

const LEGAL_ROUTES = new Set(["/privacy", "/terms"]);

function isAlertsRoute(pathname: string) {
  return pathname === "/alerts" || pathname.startsWith("/alerts/");
}

/** The signed-in section pages: `/favorites`, `/alerts`, `/alerts/[id]` and `/account`. */
export function isSectionPage(pathname: string) {
  return pathname === "/favorites" || pathname === "/account" || isAlertsRoute(pathname);
}

/**
 * Every route without a drawn header of its own (`/palette`, `/typography`,
 * error and not-found pages) takes the sign-in header (spec › Edge cases).
 */
export function headerKind(pathname: string): HeaderKind {
  if (pathname === "/map") return "map";
  if (pathname === "/") return "landing";
  if (isSectionPage(pathname)) return "pages";
  if (LEGAL_ROUTES.has(pathname)) return "legal";
  return "access";
}

/** The section marked current (HEAD-4): none on `/account`, where the avatar is. */
export function currentSection(pathname: string): Section | undefined {
  if (pathname === "/favorites") return "saved";
  if (isAlertsRoute(pathname)) return "alerts";
  return undefined;
}

/** Mapa · Guardados · Alertas, in the order both the pages header and the bottom nav draw them. */
export const SECTIONS: readonly { section: Section; href: string; labelKey: string }[] = [
  { section: "map", href: "/map", labelKey: "nav.map" },
  { section: "saved", href: "/favorites", labelKey: "nav.saved" },
  { section: "alerts", href: "/alerts", labelKey: "nav.alerts" },
];
