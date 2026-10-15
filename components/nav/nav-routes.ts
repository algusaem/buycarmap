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
function isSectionPage(pathname: string) {
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

/** The phone tab bar's tabs (MAPUI-52): the three sections plus «Cuenta». */
export type Tab = Section | "account";

/**
 * The tab marked current (MAPUI-52). Unlike `currentSection`, the map is a
 * tab of its own and `/account` marks «Cuenta», because on a phone the tab
 * bar, not the header, says where you are.
 */
export function currentTab(pathname: string): Tab | undefined {
  if (pathname === "/map") return "map";
  if (pathname === "/account") return "account";
  return currentSection(pathname);
}

/**
 * Where the tab bar shows: the map, for everyone, and the signed-in section
 * pages and landing (docs/specs/redesign-entry.md, ENTRY-8, amending
 * MAPUI-52: the landing was the one signed-in page without it).
 */
export function showsTabBar(pathname: string, signedIn: boolean) {
  if (pathname === "/map") return true;
  return signedIn && (isSectionPage(pathname) || pathname === "/");
}
